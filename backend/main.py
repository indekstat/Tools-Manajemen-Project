import os
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional

from database import engine, Base, get_db
import models
import schemas
import auth

# Create database tables
Base.metadata.create_all(bind=engine)

def ensure_columns():
    with engine.connect() as conn:
        from sqlalchemy import text
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN metode_pekerjaan VARCHAR"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN jenis_pekerjaan VARCHAR"))
            conn.commit()
        except Exception:
            pass

app = FastAPI(title="Project Tracking System API (V2)")

@app.on_event("startup")
def startup_event():
    pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
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

    hris_url = os.getenv("HRIS_API_URL", "https://pnc.indekstat.cloud")
    resp = None
    try:
        import requests
        for cand in candidates:
            try:
                r = requests.post(f"{hris_url.rstrip('/')}/api/auth/login/", json={"username": cand, "password": password}, timeout=5)
                if r.status_code == 200:
                    resp = r
                    break
            except Exception:
                continue

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
                user = db.query(models.User).filter(
                    (models.User.username.in_(alif_aliases)) |
                    (models.User.nama.ilike("%Alif Hanif%"))
                ).first()
            else:
                target_username = clean_user
                user = db.query(models.User).filter(
                    (models.User.username == clean_user) | 
                    (models.User.nama.ilike(f"%{clean_user}%"))
                ).first()

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

            # Clean up duplicate records if any
            if target_username == "alif":
                db.query(models.User).filter(
                    models.User.username.in_(alif_aliases),
                    models.User.id != user.id
                ).delete(synchronize_session=False)
                db.commit()

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
            raise HTTPException(status_code=401, detail="Username atau Password salah (terverifikasi via pnc.indekstat.cloud)")
    except HTTPException:
        raise
    except Exception as err:
        print("HRIS connection error:", err)
        raise HTTPException(status_code=503, detail=f"Gagal terhubung ke server HRIS pnc.indekstat.cloud: {str(err)}")


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
    db_users = db.query(models.User).all()
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
        resp = requests.get("https://pnc.indekstat.cloud/api/auth/users/", headers={"Authorization": auth_header}, timeout=10)

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
                if dept == "IR":
                    dept = "Institutional Relationship"
                jab = k.get("jabatan") or k.get("level_jabatan") or "STAFF"

                jab_upper = str(jab).upper()
                if jab_upper in ["CHIEF", "DIRECTOR", "VP", "EXECUTIVE"] or dept == "Chief & Founder":
                    level_jabatan = "CHIEF"
                elif jab_upper in ["HEAD", "MANAGER", "LEAD"]:
                    level_jabatan = "HEAD"
                else:
                    level_jabatan = "STAFF"

                is_leader = level_jabatan in ["CHIEF", "HEAD"]
                assigned_role = "Superadmin" if is_leader else dept

                # Sync to local DB for relational integrity
                db_user = db.query(models.User).filter(models.User.username == username).first()
                if not db_user:
                    db_user = models.User(
                        username=username,
                        password_hash=auth.get_password_hash("password"),
                        role=assigned_role,
                        level=level_jabatan,
                        divisi=dept,
                        nama=name
                    )
                    db.add(db_user)
                else:
                    db_user.nama = name
                    db_user.role = assigned_role
                    db_user.divisi = dept
                    db_user.level = level_jabatan
                db.commit()

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
    users = db.query(models.User).all()
    if not users:
        fetch_pnc_employees(db)
        users = db.query(models.User).all()
    return users

@app.post("/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin", "Admin", "IR", "Gov"]))):
    raise HTTPException(status_code=400, detail="Pembuatan akun dari localhost tidak diizinkan. Seluruh akun harus terdaftar di HRIS pnc.indekstat.cloud")

@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_update: schemas.UserBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin", "Admin", "IR", "Gov"]))):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in user_update.model_dump(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin", "Admin", "IR", "Gov"]))):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}

@app.post("/users/bulk-delete")
def bulk_delete_users(request: schemas.BulkDeleteRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin", "Admin", "IR", "Gov"]))):
    deleted_count = db.query(models.User).filter(models.User.id.in_(request.ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} users", "count": deleted_count}


# ----------------- PROJECTS -----------------

@app.get("/projects", response_model=List[schemas.ProjectResponse])
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Gov/Pol can only see their own projects, unless Superadmin/IR/Finance/Viewer
    query = db.query(models.Project)
    if current_user.role in ["Gov", "Pol"]:
        query = query.filter(models.Project.divisi_substansi == current_user.role)
    projects = query.all()

    # Ensure all Bidding projects have standard 5 stage records created
    standard_stages = ["Upload PQ", "Evaluasi PQ", "Pembuktian", "Penyusunan Ustek", "Upload Ustek"]
    
    def get_initial_stage_status(stage_name: str, p_tahapan: str, p_status: str) -> str:
        if (p_status or "").strip().lower() == "menang":
            return "Selesai"
        t_clean = (p_tahapan or "Upload PQ").strip().lower()
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
        return "Onprogress"

    modified = False
    for p in projects:
        if (p.jenis_mekanisme or "Bidding") == "Bidding":
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
    if modified:
        db.commit()
        for p in projects:
            db.refresh(p)

    return projects

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create projects")
        
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Auto-initialize standard 5 bidding stages for Bidding tenders
    if (db_project.jenis_mekanisme or "Bidding") == "Bidding":
        standard_stages = ["Upload PQ", "Evaluasi PQ", "Pembuktian", "Penyusunan Ustek", "Upload Ustek"]
        t_clean = (db_project.tahapan or "Upload PQ").strip().lower()
        curr_idx = 0
        for idx, s in enumerate(standard_stages):
            if s.lower() in t_clean or t_clean in s.lower():
                curr_idx = idx
                break

        for idx, name in enumerate(standard_stages):
            st_status = "Selesai" if idx < curr_idx or (db_project.status_project or "").lower() == "menang" else "Onprogress"
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
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Viewer check
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot update projects")
        
    # Gov/Pol restriction
    if current_user.role in ["Gov", "Pol"]:
        if db_project.divisi_substansi != current_user.role:
            raise HTTPException(status_code=403, detail="Not allowed to edit other division's project")

    for key, value in project.model_dump(exclude_unset=True).items():
        setattr(db_project, key, value)
        
    db.commit()
    db.refresh(db_project)
    return db_project

# ----------------- STAGES (Multi-record) -----------------

@app.get("/projects/{project_id}/stages", response_model=List[schemas.ProjectStageResponse])
def get_project_stages(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.ProjectStage).filter(models.ProjectStage.project_id == project_id).all()

@app.post("/projects/{project_id}/stages", response_model=schemas.ProjectStageResponse)
def create_project_stage(project_id: int, stage: schemas.ProjectStageBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_stage = models.ProjectStage(**stage.model_dump(), project_id=project_id)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.delete("/stages/{stage_id}")
def delete_stage(stage_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    stage = db.query(models.ProjectStage).filter(models.ProjectStage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    db.delete(stage)
    db.commit()
    return {"message": "Stage deleted successfully"}

# ----------------- BILLINGS (Termin Penagihan Multi-record) -----------------

@app.get("/projects/{project_id}/billings", response_model=List[schemas.BillingResponse])
def get_project_billings(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Billing).filter(models.Billing.project_id == project_id).all()

@app.post("/projects/{project_id}/billings", response_model=schemas.BillingResponse)
def create_project_billing(project_id: int, billing: schemas.BillingBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Finance"]))):
    db_billing = models.Billing(**billing.model_dump(), project_id=project_id)
    db.add(db_billing)
    db.commit()
    db.refresh(db_billing)
    return db_billing

@app.put("/billings/{billing_id}", response_model=schemas.BillingResponse)
def update_billing(billing_id: int, billing: schemas.BillingUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Finance", "Superadmin", "Gov", "Pol", "IR", "Systech"]))):
    db_billing = db.query(models.Billing).filter(models.Billing.id == billing_id).first()
    if not db_billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    
    for key, value in billing.model_dump(exclude_unset=True).items():
        if value is not None or key == "tanggal_penagihan":
            setattr(db_billing, key, value)
        
    db.commit()
    db.refresh(db_billing)
    return db_billing

@app.delete("/billings/{billing_id}")
def delete_billing(billing_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Finance"]))):
    billing = db.query(models.Billing).filter(models.Billing.id == billing_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    db.delete(billing)
    db.commit()
    return {"message": "Billing deleted successfully"}

# ----------------- PROJECT DASHBOARDS (Daftar Dashboard Project) -----------------

@app.get("/dashboards", response_model=List[schemas.ProjectDashboardResponse])
def get_project_dashboards(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.ProjectDashboard).all()

@app.post("/dashboards", response_model=schemas.ProjectDashboardResponse)
def create_project_dashboard(dashboard: schemas.ProjectDashboardCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Systech"]))):
    project = db.query(models.Project).filter(models.Project.id == dashboard.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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
    db_dashboard = db.query(models.ProjectDashboard).filter(models.ProjectDashboard.id == dashboard_id).first()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    for key, value in dashboard.model_dump(exclude_unset=True).items():
        setattr(db_dashboard, key, value)
        
    db.commit()
    db.refresh(db_dashboard)
    return db_dashboard

@app.delete("/dashboards/{dashboard_id}")
def delete_project_dashboard(dashboard_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Systech"]))):
    db_dashboard = db.query(models.ProjectDashboard).filter(models.ProjectDashboard.id == dashboard_id).first()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.delete(db_dashboard)
    db.commit()
    return {"message": "Dashboard deleted successfully"}

# ----------------- BIDDING STAGES (Multi-record Bidding Stages) -----------------

@app.get("/projects/{project_id}/bidding-stages", response_model=List[schemas.BiddingStageResponse])
def get_bidding_stages(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.BiddingStage).filter(models.BiddingStage.project_id == project_id).all()

@app.post("/projects/{project_id}/bidding-stages", response_model=schemas.BiddingStageResponse)
def create_bidding_stage(project_id: int, stage: schemas.BiddingStageBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create bidding stages")
    db_stage = models.BiddingStage(**stage.model_dump(), project_id=project_id)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.put("/bidding-stages/{stage_id}", response_model=schemas.BiddingStageResponse)
def update_bidding_stage(stage_id: int, stage: schemas.BiddingStageUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot update bidding stages")
    db_stage = db.query(models.BiddingStage).filter(models.BiddingStage.id == stage_id).first()
    if not db_stage:
        raise HTTPException(status_code=404, detail="Bidding Stage not found")
    
    for key, value in stage.model_dump(exclude_unset=True).items():
        setattr(db_stage, key, value)
        
    db.commit()
    db.refresh(db_stage)

    # Sync project.tahapan with active Onprogress stage or updated stage
    project = db.query(models.Project).filter(models.Project.id == db_stage.project_id).first()
    if project:
        active = db.query(models.BiddingStage).filter(
            models.BiddingStage.project_id == project.id,
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
    db_stage = db.query(models.BiddingStage).filter(models.BiddingStage.id == stage_id).first()
    if not db_stage:
        raise HTTPException(status_code=404, detail="Bidding Stage not found")
    db.delete(db_stage)
    db.commit()
    return {"message": "Bidding stage deleted successfully"}

# ----------------- USTEK REVIEW & APPROVAL WORKFLOW -----------------

@app.put("/projects/{project_id}/submit-ustek-review")
def submit_ustek_review(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.status_ustek_review = "On Review"
    db.commit()
    return {"message": "Ustek submitted for review", "status_ustek_review": "On Review"}

@app.put("/projects/{project_id}/approve-ustek")
def approve_ustek(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Gov"]))):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.status_ustek_review = "Approved"
    project.status_selesai_substansi = True
    db.commit()
    return {"message": "Ustek approved successfully", "status_ustek_review": "Approved", "status_selesai_substansi": True}
