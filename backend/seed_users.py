import models
import auth
from database import SessionLocal

USERS_DATA = [
    {"username": "admin", "password": "adminpassword", "role": "Superadmin", "level": "CHIEF", "divisi": "Pusat", "nama": "System Admin"},
    {"username": "ir_user", "password": "irpassword", "role": "IR", "level": "STAFF", "divisi": "Pusat", "nama": "User IR"},
    {"username": "gov_user", "password": "govpassword", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "User Gov"},
    {"username": "pol_user", "password": "polpassword", "role": "Pol", "level": "STAFF", "divisi": "Politics", "nama": "User Pol"},
    {"username": "finance_user", "password": "financepassword", "role": "Finance", "level": "STAFF", "divisi": "Finance", "nama": "User Finance"},
    {"username": "titis_pratiknyo", "password": "user123", "role": "Gov", "level": "CHIEF", "divisi": "Government", "nama": "Titis Pratiknyo"},
    {"username": "m_ali_mahmudin", "password": "user123", "role": "Gov", "level": "HEAD", "divisi": "Government", "nama": "M Ali Mahmudin"},
    {"username": "siti_rosidah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Siti Rosidah"},
    {"username": "saiful_muhjab", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Saiful Muhjab"},
    {"username": "mohamad_syahroni", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Mohamad Syahroni"},
    {"username": "mochammad_rizky_mahesa", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Mochammad Rizky Mahesa"},
    {"username": "amanda_febriani", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Amanda Febriani"},
    {"username": "gagas_adi_kusuma", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Gagas Adi Kusuma"},
    {"username": "moch_hafidz_syarifuddin", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Moch Hafidz Syarifuddin"},
    {"username": "wahyu_nursalim", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Wahyu Nursalim"},
    {"username": "tri_pudji_darmanti", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Tri Pudji Darmanti"},
    {"username": "khulaify", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Khulaify"},
    {"username": "abraham_khalil_gibran", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Abraham Khalil Gibran"},
    {"username": "agita_tri_wahyu_ningsih", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Agita Tri Wahyu Ningsih"},
    {"username": "ananto_setiawan", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Ananto Setiawan"},
    {"username": "aria_damar_pangestu", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Aria Damar Pangestu"},
    {"username": "mohammad_sifa", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Mohammad Sifa"},
    {"username": "lisa_nuronila", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Lisa Nuronila"},
    {"username": "silviana_agustina_putri", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Silviana Agustina Putri"},
    {"username": "nadhila_dhea_firlana", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Nadhila Dhea Firlana"},
    {"username": "achmad_fajrul_falah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Achmad Fajrul Falah"},
    {"username": "nisfi_wulandari", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Nisfi Wulandari"},
    {"username": "nurus_shobibah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Nurus Shobibah"},
    {"username": "hafsah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Hafsah"},
    {"username": "silvy_kusuma_wardani", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Silvy Kusuma Wardani"},
    {"username": "wina_anindita", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Wina Anindita"},
    {"username": "fika_arizka", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Fika Arizka"},
    {"username": "putri_amelia_khikmah", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Putri Amelia Khikmah"},
    {"username": "viga_amanda_pratiwi", "password": "user123", "role": "Gov", "level": "STAFF", "divisi": "Government", "nama": "Viga Amanda Pratiwi"},
]

def seed():
    db = SessionLocal()
    try:
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
        print(f"Seeded {count} new users. Total users in DB: {db.query(models.User).count()}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
