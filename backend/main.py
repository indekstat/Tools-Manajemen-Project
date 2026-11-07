import os
import secrets
import datetime
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional

from database import engine, Base, get_db, SessionLocal
import models
import schemas
import auth
import tenaga_ahli
from access import project_or_404, visible_project_ids, live, soft_delete

# Create database tables
Base.metadata.create_all(bind=engine)

def ensure_columns():
    with engine.connect() as conn:
        from sqlalchemy import text
        # Kolom lama divisi_substansi sudah dihapus dari model; kategori_project kini satu-satunya penentu divisi.
        # Isi kategori_project yang kosong dari kolom lama (bila masih ada). Bila keduanya terisi tapi beda, kategori_project menang.
        try:
            conn.execute(text(
                "UPDATE projects SET kategori_project = divisi_substansi "
                "WHERE (kategori_project IS NULL OR kategori_project = '') AND divisi_substansi IN ('Gov', 'Pol')"))
            conn.commit()
        except Exception:
            pass
        for col in ["metode_pekerjaan", "jenis_pekerjaan", "pic_substansi"]:
            try:
                conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col} VARCHAR"))
                conn.commit()
            except Exception:
                pass
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN entitas VARCHAR"))
            conn.commit()
        except Exception:
            pass
        for tbl in ("projects", "billings", "project_stages", "bidding_stages", "project_dashboards",
                    "users", "tenaga_ahli", "ta_pendidikan", "ta_sertifikasi", "ta_penugasan"):
            for col, typ in [("deleted_at", "DATETIME"), ("deleted_by", "VARCHAR")]:
                try:
                    conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {typ}"))
                    conn.commit()
                except Exception:
                    pass
        for col, typ in [("link_bast", "VARCHAR"), ("link_dokumen_penagihan", "VARCHAR"), ("tanggal_uang_masuk", "DATE")]:
            try:
                conn.execute(text(f"ALTER TABLE billings ADD COLUMN {col} {typ}"))
                conn.commit()
                if col == "link_bast":
                    # BAST kini per termin: salin BAST level pekerjaan ke termin yang sudah ada (sekali saja)
                    conn.execute(text(
                        "UPDATE billings SET link_bast = (SELECT link_bast FROM projects WHERE projects.id = billings.project_id) "
                        "WHERE link_bast IS NULL"))
                    conn.commit()
            except Exception:
                pass
        try:
            conn.execute(text("ALTER TABLE project_stages ADD COLUMN deadline DATE"))
            conn.commit()
        except Exception:
            pass
        for col in ["approval_ustek", "approval_rab", "approval_ta"]:
            try:
                conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col} BOOLEAN DEFAULT 0"))
                conn.commit()
            except Exception:
                pass

ensure_columns()

app = FastAPI(title="Project Tracking System API (V2)")
app.include_router(tenaga_ahli.router)


@app.on_event("startup")
def startup_event():
    tenaga_ahli.seed_if_empty()
    db = SessionLocal()
    try:
        ensure_standard_bidding_stages(db, db.query(models.Project).filter(models.Project.deleted_at == None).all())
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Login lokal dimatikan: frontend memakai login HRIS (/api/auth/login/). Hash lokal bisa berisi kata sandi default
    # dari seed/sinkronisasi, sehingga endpoint ini jadi pintu belakang. Hidupkan kembali hanya dengan ALLOW_LOCAL_LOGIN=1.
    if os.getenv("ALLOW_LOCAL_LOGIN") != "1":
        raise HTTPException(status_code=403, detail="Login lokal dinonaktifkan. Gunakan login HRIS.")
    user = db.query(models.User).filter(models.User.username == form_data.username, models.User.deleted_at == None).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# ----------------- HRIS AUTH COMPLIANT API -----------------

@app.post("/api/auth/login/", response_model=schemas.AuthLoginResponse)
def hris_login(payload: schemas.AuthLoginRequest, db: Session = Depends(get_db)):
    username = payload.username
    password = payload.password

    if not username or not password:
        raise HTTPException(status_code=400, detail="username/password kosong")

    clean_u = username.strip().lower()

    # Alias map for users whose login username on PNC might differ from dot username
    alif_aliases = ["m.fadillah", "alif", "m.alif.hanif.fadillah", "m.alif.hanif.f", "alif131199", "m_fadillah"]
    candidates = [username]
    if clean_u in alif_aliases:
        candidates = [username, "alif", "m.fadillah", "alif131199", "m.alif.hanif.f", "m.alif.hanif.fadillah", "m_fadillah"]

    hris_url = os.getenv("HRIS_API_URL", "https://pnc.indekstat.com")
    resp = None
    hris_answered = False  # True jika HRIS sempat memberi jawaban valid (bukan error koneksi / 5xx)
    last_conn_error = None
    try:
        import requests
        for cand in candidates:
            try:
                r = requests.post(f"{hris_url.rstrip('/')}/api/auth/login/", json={"username": cand, "password": password}, timeout=5)
                if r.status_code < 500:
                    hris_answered = True
                else:
                    last_conn_error = f"HTTP {r.status_code}"
                if r.status_code == 200:
                    resp = r
                    break
            except Exception as e:
                last_conn_error = str(e)
                continue

        if not hris_answered:
            print("HRIS unreachable:", last_conn_error)
            raise HTTPException(status_code=503, detail="Server HRIS sedang bermasalah atau tidak dapat dihubungi. Silakan coba beberapa saat lagi.")

        if resp and resp.status_code == 200:
            hris_data = resp.json()
            u_info = hris_data.get("user", {})
            pnc_token = hris_data.get("token")

            if pnc_token:
                global LATEST_PNC_TOKEN
                LATEST_PNC_TOKEN = pnc_token

            clean_user = username.strip().lower()

            # Load PNC user list with the active logged-in token
            global PNC_CACHE_DATA
            PNC_CACHE_DATA = fetch_pnc_employees(db, pnc_token=pnc_token, force_refresh=True)

            pnc_match = None
            if PNC_CACHE_DATA:
                for pnc_user in PNC_CACHE_DATA:
                    pnc_u = pnc_user.username.strip().lower()
                    if pnc_u == clean_user or (clean_user in alif_aliases and pnc_u in alif_aliases):
                        pnc_match = pnc_user
                        break

            if pnc_match:
                first_name = pnc_match.first_name
                last_name = pnc_match.last_name
                full_name = f"{first_name} {last_name}".strip()
                email = pnc_match.email
                is_admin = pnc_match.is_staff or pnc_match.is_superuser
                dept = pnc_match.karyawan.departemen if pnc_match.karyawan else "System & Technology"
                level_jab = pnc_match.karyawan.level_jabatan if pnc_match.karyawan else "STAFF"
                role_label = pnc_match.karyawan.jabatan if pnc_match.karyawan else ("Superadmin" if is_admin else dept)
            else:
                first_name = u_info.get("first_name") or username
                last_name = u_info.get("last_name") or ""
                full_name = f"{first_name} {last_name}".strip() or username
                email = u_info.get("email") or f"{clean_user}@indekstat.com"
                is_admin = u_info.get("is_superuser") or u_info.get("is_staff") or (clean_user in alif_aliases)
                dept = "System & Technology"
                level_jab = "HEAD" if (clean_user in alif_aliases or is_admin) else "STAFF"
                role_label = "Superadmin" if is_admin else "IR"

            if clean_user in alif_aliases:
                target_username = "alif"
                # Search for target username first to prevent unique constraint error
                user = db.query(models.User).filter(models.User.username == target_username).first()
                if not user:
                    user = db.query(models.User).filter(models.User.username.in_(alif_aliases)).first()
            else:
                target_username = clean_user
                # Cocokkan persis pada username; pencocokan nama (ILIKE) bisa menimpa akun orang lain.
                user = db.query(models.User).filter(models.User.username == clean_user).first()

            if user and user.deleted_at:
                raise HTTPException(status_code=403, detail="Akun ini dinonaktifkan. Hubungi Superadmin.")

            # If alias user exists, delete duplicate alias rows BEFORE updating username
            if clean_user in alif_aliases and user:
                for dup in db.query(models.User).filter(
                    models.User.username.in_(alif_aliases),
                    models.User.id != user.id,
                    models.User.deleted_at == None
                ).all():
                    dup.username = f"{dup.username}#dup{dup.id}"  # username unik: lepaskan nama alias
                    soft_delete(dup, user)
                db.commit()

            if not user:
                user = models.User(
                    username=target_username,
                    password_hash=auth.get_password_hash(password),
                    role="Superadmin" if is_admin else role_label,
                    level=level_jab,
                    divisi=dept,
                    nama=full_name
                )
                db.add(user)
            else:
                user.username = target_username
                user.nama = full_name or user.nama
                user.divisi = dept
                user.level = level_jab
                if is_admin or clean_user in alif_aliases:
                    user.role = "Superadmin"
            db.commit()
            db.refresh(user)

            access_token = auth.create_access_token(data={"sub": user.username})

            karyawan_data = {
                "id": user.id,
                "nik": pnc_match.karyawan.nik if (pnc_match and pnc_match.karyawan) else None,
                "nip": pnc_match.karyawan.nip if (pnc_match and pnc_match.karyawan) else f"EMP-00{user.id}",
                "status": "PKWT",
                "status_karyawan": "PKWT",
                "tipe_kontrak": "PKWT",
                "tanggal_gabung": None,
                "departemen": dept,
                "divisi": dept,
                "jabatan": "Superadmin" if (user.role == "Superadmin" or is_admin) else role_label,
                "level_jabatan": level_jab,
                "lokasi_kerja": "Jakarta",
                "foto": None
            }

            return {
                "token": access_token,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_active": True,
                    "is_staff": (user.role == "Superadmin" or user.level in ["CHIEF", "HEAD"] or is_admin),
                    "is_superuser": (user.role == "Superadmin" or user.level in ["CHIEF", "HEAD"] or is_admin),
                    "karyawan": karyawan_data
                }
            }
        else:
            raise HTTPException(status_code=401, detail="Username atau Password salah (terverifikasi via pnc.indekstat.com)")
    except HTTPException:
        raise
    except Exception as err:
        print("HRIS connection error:", err)
        raise HTTPException(status_code=503, detail=f"Gagal terhubung ke server HRIS pnc.indekstat.com: {str(err)}")


@app.get("/api/auth/me/", response_model=schemas.AuthUserDetail)
def hris_me(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    global PNC_CACHE_DATA
    if not PNC_CACHE_DATA:
        PNC_CACHE_DATA = fetch_pnc_employees(db, force_refresh=True)

    clean_u = current_user.username.strip().lower()
    alif_aliases = ["m.fadillah", "alif", "m.alif.hanif.fadillah", "m.alif.hanif.f", "alif131199", "m_fadillah"]
    if PNC_CACHE_DATA:
        for pnc_user in PNC_CACHE_DATA:
            pnc_u = pnc_user.username.strip().lower()
            if pnc_u == clean_u or (clean_u in alif_aliases and pnc_u in alif_aliases):
                return pnc_user

    names = (current_user.nama or current_user.username).split(" ", 1)
    first_name = names[0]
    last_name = names[1] if len(names) > 1 else ""

    is_leader = current_user.level and current_user.level.upper() in ["CHIEF", "HEAD"]
    is_admin = is_leader or current_user.role in ["Superadmin", "Management", "Admin"]

    karyawan_info = schemas.KaryawanProfile(
        id=current_user.id,
        nik=None,
        nip=f"EMP-00{current_user.id}",
        status="PKWT",
        status_karyawan="PKWT",
        tipe_kontrak="PKWT",
        tanggal_gabung=None,
        departemen=current_user.divisi or "General",
        divisi=current_user.divisi or "General",
        jabatan="Superadmin" if is_leader else (current_user.role or current_user.divisi or "General"),
        level_jabatan=current_user.level or "STAFF",
        lokasi_kerja="Jakarta",
        foto=None
    )

    return schemas.AuthUserDetail(
        id=current_user.id,
        username=current_user.username,
        email=f"{current_user.username}@indekstat.com",
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        is_staff=is_admin,
        is_superuser=is_admin,
        karyawan=karyawan_info
    )


from fastapi import Response

@app.post("/api/auth/logout/")
def hris_logout():
    return Response(status_code=204)

PNC_CACHE_DATA = None
PNC_CACHE_TIME = 0
PNC_CACHE_TTL = 900  # 15 minutes cache
LATEST_PNC_TOKEN = None

def get_db_users_as_auth_detail(db: Session) -> List[schemas.AuthUserDetail]:
    db_users = db.query(models.User).filter(models.User.deleted_at == None).all()
    dedup_map = {}
    for u in db_users:
        clean_name = (u.nama or u.username).strip().lower()
        is_leader = u.level and u.level.upper() in ["CHIEF", "HEAD"]
        is_admin = u.role == "Superadmin" or is_leader
        dept = u.divisi or u.role or "General"
        role_name = u.role or "Staff"
        
        detail = schemas.AuthUserDetail(
            id=u.id,
            username=u.username,
            email=f"{u.username}@indekstat.com",
            first_name=u.nama or u.username,
            last_name="",
            is_active=True,
            is_staff=is_admin,
            is_superuser=u.role == "Superadmin",
            karyawan=schemas.KaryawanProfile(
                id=u.id,
                nik="3201xxxxxxxx",
                nip=f"EMP-00{u.id}",
                status="PKWT",
                status_karyawan="PKWT",
                tipe_kontrak="PKWT",
                tanggal_gabung=None,
                departemen=dept,
                divisi=dept,
                jabatan=role_name,
                level_jabatan=u.level or "STAFF",
                lokasi_kerja="Jakarta",
                foto=None
            )
        )
        if clean_name not in dedup_map:
            dedup_map[clean_name] = detail
        else:
            existing = dedup_map[clean_name]
            if "." in existing.username and "." not in u.username:
                dedup_map[clean_name] = detail

    return list(dedup_map.values())

# Nama divisi/departemen PNC -> nama divisi baku
DIVISI_ALIAS = {
    "IR": "Institutional Relationship",
    "Government": "Public Policy",
    "Politics": "Political Science",
    "Data Sains": "Data Science",
    "Finance": "Finance & Administration",
    "Engineering": "System & Technology",
}

# Divisi baku -> role sistem (dipakai untuk hak akses)
DIVISI_ROLE_MAP = {
    "Institutional Relationship": "IR",
    "Public Policy": "Gov",
    "Political Science": "Pol",
    "Data Science": "Pol",
    "Finance & Administration": "Finance",
    "System & Technology": "Systech",
}

def normalize_divisi(dept):
    return DIVISI_ALIAS.get(dept, dept)

def role_from_divisi(dept):
    return DIVISI_ROLE_MAP.get(normalize_divisi(dept), "Viewer")

def fetch_pnc_employees(db: Session, pnc_token: Optional[str] = None, force_refresh: bool = False):
    global PNC_CACHE_DATA, PNC_CACHE_TIME, LATEST_PNC_TOKEN
    import time
    now = time.time()
    if not force_refresh and PNC_CACHE_DATA and (now - PNC_CACHE_TIME < PNC_CACHE_TTL):
        return PNC_CACHE_DATA

    active_token = pnc_token or LATEST_PNC_TOKEN
    if not active_token:
        if not PNC_CACHE_DATA:
            PNC_CACHE_DATA = get_db_users_as_auth_detail(db)
        return PNC_CACHE_DATA or []

    try:
        import requests
        auth_header = f"Token {active_token}" if not active_token.startswith("Bearer ") and not active_token.startswith("Token ") else active_token
        resp = requests.get("https://pnc.indekstat.com/api/auth/users/", headers={"Authorization": auth_header}, timeout=10)

        results = []
        if resp.status_code == 200:
            data = resp.json()
            for u in data:
                k = u.get("karyawan")
                if not k:
                    continue
                username = u.get("username")
                if not username:
                    continue

                first_name = u.get("first_name") or ""
                last_name = u.get("last_name") or ""
                name = f"{first_name} {last_name}".strip() or username
                email = u.get("email") or f"{username}@indekstat.com"

                dept = k.get("departemen") or k.get("divisi") or "General"
                dept = normalize_divisi(dept)
                jab = k.get("jabatan") or k.get("level_jabatan") or "STAFF"

                jab_upper = str(jab).upper()
                if jab_upper in ["CHIEF", "DIRECTOR", "VP", "EXECUTIVE"] or dept == "Chief & Founder":
                    level_jabatan = "CHIEF"
                elif jab_upper in ["HEAD", "MANAGER", "LEAD"]:
                    level_jabatan = "HEAD"
                else:
                    level_jabatan = "STAFF"

                is_leader = level_jabatan in ["CHIEF", "HEAD"]
                assigned_role = "Superadmin" if is_leader else role_from_divisi(dept)

                # Sync to local DB for relational integrity
                alif_aliases_sync = ["m.fadillah", "alif", "m.alif.hanif.fadillah", "m.alif.hanif.f", "alif131199", "m_fadillah"]
                target_u = "alif" if username.strip().lower() in alif_aliases_sync else username

                db_user = db.query(models.User).filter(models.User.username == target_u).first()
                if not db_user:
                    db_user = db.query(models.User).filter(models.User.username == username).first()

                if not db_user:
                    db_user = models.User(
                        username=target_u,
                        password_hash=auth.get_password_hash(secrets.token_urlsafe(32)),  # tidak bisa dipakai login lokal
                        role=assigned_role,
                        level=level_jabatan,
                        divisi=dept,
                        nama=name
                    )
                    db.add(db_user)
                elif db_user.deleted_at:
                    pass  # akun dinonaktifkan lokal: jangan diubah/diaktifkan lagi oleh sinkronisasi HRIS
                else:
                    db_user.username = target_u
                    db_user.nama = name
                    db_user.role = assigned_role
                    db_user.divisi = dept
                    db_user.level = level_jabatan
                try:
                    db.commit()
                except Exception as commit_err:
                    db.rollback()
                    logger.warning(f"Skipped syncing user {username}: {commit_err}")

                karyawan_info = schemas.KaryawanProfile(
                    id=k.get("id") or u.get("id"),
                    nik=k.get("nik"),
                    nip=k.get("nip") or f"EMP-00{u.get('id')}",
                    status=k.get("status") or "PKWT",
                    status_karyawan=k.get("status_karyawan") or "PKWT",
                    tipe_kontrak=k.get("tipe_kontrak") or "PKWT",
                    tanggal_gabung=k.get("tanggal_gabung"),
                    departemen=dept,
                    divisi=dept,
                    jabatan=assigned_role,
                    level_jabatan=level_jabatan,
                    lokasi_kerja=k.get("lokasi_kerja") or "Jakarta",
                    foto=k.get("foto")
                )

                results.append(
                    schemas.AuthUserDetail(
                        id=u.get("id"),
                        username=username,
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        is_active=u.get("is_active", True),
                        is_staff=is_leader or u.get("is_staff", False),
                        is_superuser=is_leader or u.get("is_superuser", False),
                        karyawan=karyawan_info
                    )
                )

        if results:
            dedup_results = {}
            for u in results:
                name_key = f"{u.first_name} {u.last_name}".strip().lower() or u.username.strip().lower()
                if name_key not in dedup_results:
                    dedup_results[name_key] = u
            PNC_CACHE_DATA = list(dedup_results.values())
            PNC_CACHE_TIME = now
            return PNC_CACHE_DATA
    except Exception as e:
        print("Fetch PNC API error:", e)

    if not PNC_CACHE_DATA:
        PNC_CACHE_DATA = get_db_users_as_auth_detail(db)

    return PNC_CACHE_DATA or []

@app.get("/api/auth/users/", response_model=List[schemas.AuthUserDetail])
def hris_get_users(background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    global PNC_CACHE_DATA
    if not PNC_CACHE_DATA:
        PNC_CACHE_DATA = fetch_pnc_employees(db, force_refresh=True)
    if not PNC_CACHE_DATA:
        return get_db_users_as_auth_detail(db)
    return PNC_CACHE_DATA or []

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    users = db.query(models.User).filter(models.User.deleted_at == None).all()
    if not users:
        fetch_pnc_employees(db)
        users = db.query(models.User).filter(models.User.deleted_at == None).all()
    return users

@app.post("/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin", "Admin", "IR", "Gov"]))):
    raise HTTPException(status_code=400, detail="Pembuatan akun dari localhost tidak diizinkan. Seluruh akun harus terdaftar di HRIS pnc.indekstat.com")

def require_superadmin(current_user: models.User = Depends(auth.get_current_user)):
    # Pengelolaan akun hanya untuk role Superadmin (bukan sekadar level CHIEF/HEAD).
    if (current_user.role or "") != "Superadmin":
        raise HTTPException(status_code=403, detail="Hanya Superadmin yang boleh mengelola akun")
    return current_user

@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_update: schemas.UserBase, db: Session = Depends(get_db), current_user: models.User = Depends(require_superadmin)):
    db_user = live(db, models.User, user_id, "User not found")
    for key, value in user_update.model_dump(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_superadmin)):
    db_user = live(db, models.User, user_id, "User not found")
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri")
    soft_delete(db_user, current_user)  # dinonaktifkan: tidak bisa login, bisa dipulihkan Superadmin
    db.commit()
    return {"message": "User deleted successfully"}

@app.post("/users/bulk-delete")
def bulk_delete_users(request: schemas.BulkDeleteRequest, db: Session = Depends(get_db), current_user: models.User = Depends(require_superadmin)):
    ids = [i for i in request.ids if i != current_user.id]  # akun sendiri tidak ikut terhapus
    targets = db.query(models.User).filter(models.User.id.in_(ids), models.User.deleted_at == None).all()
    for u in targets:
        soft_delete(u, current_user)
    deleted_count = len(targets)
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} users", "count": deleted_count}


# ----------------- TEMPAT SAMPAH (daftar terhapus & pemulihan, khusus Superadmin) -----------------

TRASH_MODELS = {
    "project": (models.Project, "nama_pekerjaan"),
    "billing": (models.Billing, "nama"),
    "stage": (models.ProjectStage, "nama_tahapan"),
    "bidding-stage": (models.BiddingStage, "nama_tahapan"),
    "dashboard": (models.ProjectDashboard, "url_dashboard"),
    "user": (models.User, "username"),
    "tenaga-ahli": (models.TenagaAhli, "nama"),
    "ta-pendidikan": (models.TAPendidikan, "jurusan"),
    "ta-sertifikasi": (models.TASertifikasi, "nama_sertifikasi"),
    "ta-penugasan": (models.TAPenugasan, "posisi"),
}

def _trash_model(kind: str):
    if kind not in TRASH_MODELS:
        raise HTTPException(status_code=404, detail=f"Jenis tidak dikenal. Pilihan: {', '.join(TRASH_MODELS)}")
    return TRASH_MODELS[kind]

@app.get("/trash/{kind}")
def list_trash(kind: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_superadmin)):
    model, label = _trash_model(kind)
    rows = db.query(model).filter(model.deleted_at != None).order_by(model.deleted_at.desc()).all()
    return [{"id": r.id, "label": getattr(r, label, None), "deleted_at": r.deleted_at, "deleted_by": r.deleted_by} for r in rows]

@app.post("/trash/{kind}/{row_id}/restore")
def restore_trash(kind: str, row_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_superadmin)):
    model, _ = _trash_model(kind)
    row = db.query(model).filter(model.id == row_id, model.deleted_at != None).first()
    if not row:
        raise HTTPException(status_code=404, detail="Data terhapus tidak ditemukan")
    row.deleted_at = None
    row.deleted_by = None
    db.commit()
    return {"message": "Data dipulihkan"}


# ----------------- PROJECTS -----------------

STANDARD_BIDDING_STAGES = ["Upload PQ", "Evaluasi PQ", "Pembuktian", "Upload Penawaran", "Menunggu Pengumuman"]

class _SystemUser:
    username = "system"

SYSTEM_USER = _SystemUser()

def ensure_standard_bidding_stages(db: Session, projects) -> bool:
    """Pastikan tiap project Bidding punya tahapan standar, dan rapikan nama tahapan lama.
    Dipanggil saat startup dan saat project dibuat/diubah, bukan saat GET (GET hanya membaca)."""
    standard_stages = STANDARD_BIDDING_STAGES
    
    def get_initial_stage_status(stage_name: str, p_tahapan: str, p_status: str) -> str:
        if (p_status or "").strip().lower() == "menang":
            return "Selesai"
        t_clean = (p_tahapan or "Upload PQ").strip().lower()
        if "ustek" in t_clean or t_clean in ("penawaran", "upload penawaran"):
            t_clean = "upload penawaran"
        curr_idx = 0
        for idx, s in enumerate(standard_stages):
            if s.lower() in t_clean or t_clean in s.lower():
                curr_idx = idx
                break
        s_idx = -1
        for idx, s in enumerate(standard_stages):
            if s.lower() == stage_name.strip().lower():
                s_idx = idx
                break
        if s_idx != -1 and s_idx < curr_idx:
            return "Selesai"
        elif s_idx == curr_idx:
            return "Onprogress"
        return "Belum"

    modified = False
    for p in projects:
        if (p.jenis_mekanisme or "Bidding") == "Bidding":
            # Migrate legacy stage names Penyusunan Ustek / Upload Ustek / Penawaran to Upload Penawaran
            if p.bidding_stages:
                penawaran_stage = None
                legacy_stages = []
                for st in p.bidding_stages:
                    if st.nama_tahapan == "Upload Penawaran":
                        penawaran_stage = st
                    elif st.nama_tahapan in ["Penawaran", "Penyusunan Ustek", "Upload Ustek"]:
                        legacy_stages.append(st)
                
                if legacy_stages:
                    if not penawaran_stage:
                        penawaran_stage = legacy_stages[0]
                        penawaran_stage.nama_tahapan = "Upload Penawaran"
                        legacy_stages = legacy_stages[1:]
                        modified = True
                    for leg in legacy_stages:
                        soft_delete(leg, SYSTEM_USER)
                        modified = True

            existing_stage_names = [st.nama_tahapan for st in p.bidding_stages] if p.bidding_stages else []
            for name in standard_stages:
                if name not in existing_stage_names:
                    st_obj = models.BiddingStage(
                        project_id=p.id,
                        nama_tahapan=name,
                        status=get_initial_stage_status(name, p.tahapan, p.status_project),
                        tanggal_deadline=p.deadline_pengumuman if name == p.tahapan else None
                    )
                    db.add(st_obj)
                    modified = True

            if (p.tahapan or "") in ["Penawaran", "Penyusunan Ustek", "Upload Ustek"]:
                p.tahapan = "Upload Penawaran"
                modified = True

    if modified:
        db.commit()
    return modified

@app.get("/projects", response_model=List[schemas.ProjectResponse])
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Gov/Pol can only see their own projects, unless Superadmin/IR/Finance/Viewer
    query = db.query(models.Project).filter(models.Project.deleted_at == None)
    if current_user.role in ["Gov", "Pol"]:
        query = query.filter(models.Project.kategori_project == current_user.role)
    return query.all()  # murni baca: tahapan standar disiapkan saat startup / create / update

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create projects")
        
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Auto-initialize standard 4 bidding stages for Bidding tenders
    if (db_project.jenis_mekanisme or "Bidding") == "Bidding":
        standard_stages = ["Upload PQ", "Evaluasi PQ", "Pembuktian", "Upload Penawaran", "Menunggu Pengumuman"]
        t_clean = (db_project.tahapan or "Upload PQ").strip().lower()
        if "ustek" in t_clean or t_clean in ("penawaran", "upload penawaran"):
            t_clean = "upload penawaran"
        curr_idx = 0
        for idx, s in enumerate(standard_stages):
            if s.lower() in t_clean or t_clean in s.lower():
                curr_idx = idx
                break

        for idx, name in enumerate(standard_stages):
            if (db_project.status_project or "").lower() == "menang":
                st_status = "Selesai"
            elif idx < curr_idx:
                st_status = "Selesai"
            elif idx == curr_idx:
                st_status = "Onprogress"
            else:
                st_status = "Belum"

            stage_obj = models.BiddingStage(
                project_id=db_project.id,
                nama_tahapan=name,
                status=st_status,
                tanggal_deadline=db_project.deadline_pengumuman if name == db_project.tahapan else None
            )
            db.add(stage_obj)
        db.commit()
        db.refresh(db_project)
        db.refresh(db_project)

    return db_project

@app.put("/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: int, project: schemas.ProjectUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.deleted_at == None).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Viewer check
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot update projects")
        
    # Gov/Pol restriction
    if current_user.role in ["Gov", "Pol"]:
        if db_project.kategori_project != current_user.role:
            raise HTTPException(status_code=403, detail="Not allowed to edit other division's project")

    for key, value in project.model_dump(exclude_unset=True).items():
        setattr(db_project, key, value)
        
    # Sync status_ustek and status_penulisan_ustek
    if getattr(project, 'status_ustek', None) is not None:
        db_project.status_penulisan_ustek = db_project.status_ustek
    elif getattr(project, 'status_penulisan_ustek', None) is not None:
        db_project.status_ustek = db_project.status_penulisan_ustek

    # Auto-calculate status_selesai_substansi (Status Selesai Penawaran)
    # Status Selesai is True iff Ustek, RAB, and TA are all 'Selesai'
    ustek_done = (getattr(db_project, 'status_ustek', None) == 'Selesai' or getattr(db_project, 'status_penulisan_ustek', None) == 'Selesai')
    rab_done = (getattr(db_project, 'status_rab', None) == 'Selesai')
    ta_done = (getattr(db_project, 'status_ta', None) == 'Selesai')

    # If status_selesai_substansi was NOT explicitly passed in request, calculate from 3 aspects
    if getattr(project, 'status_selesai_substansi', None) is None:
        db_project.status_selesai_substansi = True if (ustek_done and rab_done and ta_done) else False

    db.commit()
    ensure_standard_bidding_stages(db, [db_project])
    db.refresh(db_project)
    return db_project

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.deleted_at == None).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot delete projects")
    if current_user.role in ["Gov", "Pol"] and db_project.kategori_project != current_user.role:
        raise HTTPException(status_code=403, detail="Not allowed to delete other division's project")
    db_project.deleted_at = datetime.datetime.utcnow()
    db_project.deleted_by = current_user.username
    db.commit()
    return {"message": "Project deleted successfully"}

@app.get("/projects-deleted")
def list_deleted_projects(db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin"]))):
    rows = db.query(models.Project).filter(models.Project.deleted_at != None).order_by(models.Project.deleted_at.desc()).all()
    return [{"id": p.id, "nama_pekerjaan": p.nama_pekerjaan, "status_project": p.status_project,
             "deleted_at": p.deleted_at, "deleted_by": p.deleted_by} for p in rows]

@app.post("/projects/{project_id}/restore")
def restore_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin"]))):
    p = db.query(models.Project).filter(models.Project.id == project_id, models.Project.deleted_at != None).first()
    if not p:
        raise HTTPException(status_code=404, detail="Deleted project not found")
    p.deleted_at = None
    p.deleted_by = None
    db.commit()
    return {"message": "Project restored successfully"}

# ----------------- STAGES (Multi-record) -----------------

@app.get("/projects/{project_id}/stages", response_model=List[schemas.ProjectStageResponse])
def get_project_stages(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project_or_404(db, project_id, current_user)
    return db.query(models.ProjectStage).filter(models.ProjectStage.project_id == project_id, models.ProjectStage.deleted_at == None).all()

@app.post("/projects/{project_id}/stages", response_model=schemas.ProjectStageResponse)
def create_project_stage(project_id: int, stage: schemas.ProjectStageBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project_or_404(db, project_id, current_user, write=True)
    db_stage = models.ProjectStage(**stage.model_dump(), project_id=project_id)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.put("/stages/{stage_id}", response_model=schemas.ProjectStageResponse)
def update_stage(stage_id: int, stage: schemas.ProjectStageUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_stage = live(db, models.ProjectStage, stage_id, "Stage not found")
    project_or_404(db, db_stage.project_id, current_user, write=True)
    for key, value in stage.model_dump(exclude_unset=True).items():
        if value is None and key in ("nama_tahapan", "status", "is_meeting"):
            continue
        setattr(db_stage, key, value)
    if not db_stage.is_meeting:
        db_stage.tipe_meeting = None
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.delete("/stages/{stage_id}")
def delete_stage(stage_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    stage = live(db, models.ProjectStage, stage_id, "Stage not found")
    project_or_404(db, stage.project_id, current_user, write=True)
    soft_delete(stage, current_user)
    db.commit()
    return {"message": "Stage deleted successfully"}

# ----------------- BILLINGS (Termin Penagihan Multi-record) -----------------

@app.get("/projects/{project_id}/billings", response_model=List[schemas.BillingResponse])
def get_project_billings(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project_or_404(db, project_id, current_user)
    return db.query(models.Billing).filter(models.Billing.project_id == project_id, models.Billing.deleted_at == None).all()

@app.post("/projects/{project_id}/billings", response_model=schemas.BillingResponse)
def create_project_billing(project_id: int, billing: schemas.BillingBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Finance"]))):
    project_or_404(db, project_id, current_user, write=True)
    db_billing = models.Billing(**billing.model_dump(), project_id=project_id)
    db.add(db_billing)
    db.commit()
    db.refresh(db_billing)
    return db_billing

@app.post("/projects/{project_id}/billings/bulk", response_model=List[schemas.BillingResponse])
def create_project_billings_bulk(project_id: int, payload: schemas.BillingBulkCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Finance"]))):
    project_or_404(db, project_id, current_user, write=True)
    if payload.jumlah < 1 or payload.jumlah > 50:
        raise HTTPException(status_code=400, detail="Jumlah termin harus 1-50")
    existing = db.query(models.Billing).filter(models.Billing.project_id == project_id, models.Billing.deleted_at == None).count()
    each = round(payload.total / payload.jumlah)
    created = []
    for i in range(payload.jumlah):
        nominal = payload.total - each * (payload.jumlah - 1) if i == payload.jumlah - 1 else each
        b = models.Billing(project_id=project_id, nama=f"Termin {existing + i + 1}", nominal=nominal)
        db.add(b)
        created.append(b)
    db.commit()
    for b in created:
        db.refresh(b)
    return created

@app.put("/billings/{billing_id}", response_model=schemas.BillingResponse)
def update_billing(billing_id: int, billing: schemas.BillingUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Finance", "Superadmin", "Gov", "Pol", "IR", "Systech"]))):
    db_billing = db.query(models.Billing).filter(models.Billing.id == billing_id, models.Billing.deleted_at == None).first()
    if not db_billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    project_or_404(db, db_billing.project_id, current_user, write=True)

    for key, value in billing.model_dump(exclude_unset=True).items():
        if value is not None or key in ("tanggal_penagihan", "tanggal_uang_masuk", "link_bast", "link_dokumen_penagihan", "catatan"):
            setattr(db_billing, key, value)
        
    db.commit()
    db.refresh(db_billing)
    return db_billing

@app.delete("/billings/{billing_id}")
def delete_billing(billing_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Finance"]))):
    billing = db.query(models.Billing).filter(models.Billing.id == billing_id, models.Billing.deleted_at == None).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    project_or_404(db, billing.project_id, current_user, write=True)
    soft_delete(billing, current_user)
    db.commit()
    return {"message": "Billing deleted successfully"}

# ----------------- PROJECT DASHBOARDS (Daftar Dashboard Project) -----------------

@app.get("/dashboards", response_model=List[schemas.ProjectDashboardResponse])
def get_project_dashboards(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.ProjectDashboard).filter(
        models.ProjectDashboard.deleted_at == None,
        models.ProjectDashboard.project_id.in_(visible_project_ids(db, current_user)),
    ).all()

@app.post("/dashboards", response_model=schemas.ProjectDashboardResponse)
def create_project_dashboard(dashboard: schemas.ProjectDashboardCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Systech"]))):
    project = db.query(models.Project).filter(models.Project.id == dashboard.project_id, models.Project.deleted_at == None).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_or_404(db, dashboard.project_id, current_user, write=True)
    db_dashboard = models.ProjectDashboard(
        project_id=dashboard.project_id,
        url_dashboard=dashboard.url_dashboard,
        keterangan=dashboard.keterangan
    )
    db.add(db_dashboard)
    db.commit()
    db.refresh(db_dashboard)
    return db_dashboard

@app.put("/dashboards/{dashboard_id}", response_model=schemas.ProjectDashboardResponse)
def update_project_dashboard(dashboard_id: int, dashboard: schemas.ProjectDashboardBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Systech"]))):
    db_dashboard = live(db, models.ProjectDashboard, dashboard_id, "Dashboard not found")
    
    for key, value in dashboard.model_dump(exclude_unset=True).items():
        setattr(db_dashboard, key, value)
        
    db.commit()
    db.refresh(db_dashboard)
    return db_dashboard

@app.delete("/dashboards/{dashboard_id}")
def delete_project_dashboard(dashboard_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Systech"]))):
    db_dashboard = live(db, models.ProjectDashboard, dashboard_id, "Dashboard not found")
    soft_delete(db_dashboard, current_user)
    db.commit()
    return {"message": "Dashboard deleted successfully"}

# ----------------- BIDDING STAGES (Multi-record Bidding Stages) -----------------

@app.get("/projects/{project_id}/bidding-stages", response_model=List[schemas.BiddingStageResponse])
def get_bidding_stages(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project_or_404(db, project_id, current_user)
    return db.query(models.BiddingStage).filter(models.BiddingStage.project_id == project_id, models.BiddingStage.deleted_at == None).all()

@app.post("/projects/{project_id}/bidding-stages", response_model=schemas.BiddingStageResponse)
def create_bidding_stage(project_id: int, stage: schemas.BiddingStageBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create bidding stages")
    project_or_404(db, project_id, current_user, write=True)
    db_stage = models.BiddingStage(**stage.model_dump(), project_id=project_id)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.put("/bidding-stages/{stage_id}", response_model=schemas.BiddingStageResponse)
def update_bidding_stage(stage_id: int, stage: schemas.BiddingStageUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot update bidding stages")
    db_stage = live(db, models.BiddingStage, stage_id, "Bidding Stage not found")
    project_or_404(db, db_stage.project_id, current_user, write=True)
    
    for key, value in stage.model_dump(exclude_unset=True).items():
        setattr(db_stage, key, value)
        
    db.commit()
    db.refresh(db_stage)

    # Sync project.tahapan with active Onprogress stage or updated stage
    project = db.query(models.Project).filter(models.Project.id == db_stage.project_id, models.Project.deleted_at == None).first()
    if project:
        active = db.query(models.BiddingStage).filter(
            models.BiddingStage.project_id == project.id,
            models.BiddingStage.deleted_at == None,
            models.BiddingStage.status == "Onprogress"
        ).first()
        if active:
            project.tahapan = active.nama_tahapan
        else:
            project.tahapan = db_stage.nama_tahapan
        db.commit()

    return db_stage

@app.delete("/bidding-stages/{stage_id}")
def delete_bidding_stage(stage_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot delete bidding stages")
    db_stage = live(db, models.BiddingStage, stage_id, "Bidding Stage not found")
    project_or_404(db, db_stage.project_id, current_user, write=True)
    soft_delete(db_stage, current_user)
    db.commit()
    return {"message": "Bidding stage deleted successfully"}

# ----------------- USTEK REVIEW & APPROVAL WORKFLOW -----------------

@app.put("/projects/{project_id}/submit-ustek-review")
def submit_ustek_review(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = project_or_404(db, project_id, current_user, write=True)
    project.status_ustek_review = "On Review"
    db.commit()
    return {"message": "Ustek submitted for review", "status_ustek_review": "On Review"}

@app.put("/projects/{project_id}/approve-ustek")
def approve_ustek(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Gov"]))):
    project = project_or_404(db, project_id, current_user, write=True)
    project.status_ustek_review = "Approved"
    project.status_selesai_substansi = True
    db.commit()
    return {"message": "Ustek approved successfully", "status_ustek_review": "Approved", "status_selesai_substansi": True}
