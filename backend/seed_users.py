import models
import auth
from database import SessionLocal

USERS_DATA = [
    {"username": "superadmin", "password": "password", "role": "Superadmin", "level": "CHIEF", "divisi": "Pusat", "nama": "System Admin"},
    {"username": "budi.santoso", "password": "rahasia123", "role": "IR", "level": "STAFF", "divisi": "Engineering", "nama": "Budi Santoso"},
    {"username": "ir.user", "password": "password", "role": "IR", "level": "STAFF", "divisi": "Pusat", "nama": "User IR"},
    {"username": "gov.user", "password": "password", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "User Gov"},
    {"username": "pol.user", "password": "password", "role": "Pol", "level": "STAFF", "divisi": "Politics", "nama": "User Pol"},
    {"username": "finance.user", "password": "password", "role": "Finance", "level": "STAFF", "divisi": "Finance", "nama": "User Finance"},
    {"username": "viewer.user", "password": "password", "role": "Viewer", "level": "STAFF", "divisi": "General", "nama": "User Viewer"},
    {"username": "titis.pratiknyo", "password": "user123", "role": "Gov", "level": "CHIEF", "divisi": "Government", "nama": "Titis Pratiknyo"},
    {"username": "m.ali.mahmudin", "password": "user123", "role": "Gov", "level": "HEAD", "divisi": "Government", "nama": "M Ali Mahmudin"},
    {"username": "siti.rosidah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Siti Rosidah"},
    {"username": "saiful.muhjab", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Saiful Muhjab"},
    {"username": "mohamad.syahroni", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Mohamad Syahroni"},
    {"username": "mochammad.rizky.mahesa", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Mochammad Rizky Mahesa"},
    {"username": "amanda.febriani", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Amanda Febriani"},
    {"username": "gagas.adi.kusuma", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Gagas Adi Kusuma"},
    {"username": "moch.hafidz.syarifuddin", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Moch Hafidz Syarifuddin"},
    {"username": "wahyu.nursalim", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Wahyu Nursalim"},
    {"username": "tri.pudji.darmanti", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Tri Pudji Darmanti"},
    {"username": "khulaify", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Khulaify"},
    {"username": "abraham.khalil.gibran", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Abraham Khalil Gibran"},
    {"username": "agita.tri.wahyu.ningsih", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Agita Tri Wahyu Ningsih"},
    {"username": "ananto.setiawan", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Ananto Setiawan"},
    {"username": "aria.damar.pangestu", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Aria Damar Pangestu"},
    {"username": "mohammad.sifa", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Mohammad Sifa"},
    {"username": "lisa.nuronila", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Lisa Nuronila"},
    {"username": "silviana.agustina.putri", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Silviana Agustina Putri"},
    {"username": "nadhila.dhea.firlana", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Nadhila Dhea Firlana"},
    {"username": "achmad.fajrul.falah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Achmad Fajrul Falah"},
    {"username": "nisfi.wulandari", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Nisfi Wulandari"},
    {"username": "nurus.shobibah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Nurus Shobibah"},
    {"username": "hafsah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Hafsah"},
    {"username": "silvy.kusuma.wardani", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Silvy Kusuma Wardani"},
    {"username": "wina.anindita", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Wina Anindita"},
    {"username": "fika.arizka", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Fika Arizka"},
    {"username": "putri.amelia.khikmah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Putri Amelia Khikmah"},
    {"username": "viga.amanda.pratiwi", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Viga Amanda Pratiwi"},
]

def seed():
    db = SessionLocal()
    try:
        # Migrate old underscore usernames to dot notation if any
        all_users = db.query(models.User).all()
        for u in all_users:
            if "_" in u.username and u.username not in ["budi.santoso"]:
                dot_username = u.username.replace("_", ".")
                existing_dot = db.query(models.User).filter(models.User.username == dot_username).first()
                if not existing_dot:
                    u.username = dot_username
                else:
                    db.delete(u)
        db.commit()

        count = 0
        for udata in USERS_DATA:
            user = db.query(models.User).filter(models.User.username == udata["username"]).first()
            if not user:
                pwd_hash = auth.get_password_hash(udata["password"])
                user = models.User(
                    username=udata["username"],
                    password_hash=pwd_hash,
                    role=udata["role"],
                    level=udata["level"],
                    divisi=udata["divisi"],
                    nama=udata["nama"],
                )
                db.add(user)
                count += 1
            else:
                user.role = udata["role"]
                user.level = udata["level"]
                user.divisi = udata["divisi"]
                user.nama = udata["nama"]
        db.commit()
        print(f"Seeded/Updated users. Total users in DB: {db.query(models.User).count()}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
