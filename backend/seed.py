from database import SessionLocal, engine, Base
import models
from auth import get_password_hash
import datetime

def seed_data():
    db = SessionLocal()
    
    # 1. Users
    users_to_create = [
        {"username": "ir_user", "password": "password", "role": "IR"},
        {"username": "gov_user", "password": "password", "role": "Gov"},
        {"username": "pol_user", "password": "password", "role": "Pol"},
        {"username": "finance_user", "password": "password", "role": "Finance"},
        {"username": "viewer", "password": "password", "role": "Viewer"},
        {"username": "superadmin", "password": "password", "role": "Superadmin"},
    ]
    
    for user_data in users_to_create:
        existing_user = db.query(models.User).filter(models.User.username == user_data["username"]).first()
        if not existing_user:
            new_user = models.User(
                username=user_data["username"],
                password_hash=get_password_hash(user_data["password"]),
                role=user_data["role"]
            )
            db.add(new_user)
            
    db.commit()

    # 2. Sample Projects
    if db.query(models.Project).count() == 0:
        p1 = models.Project(
            nama_pekerjaan="Kajian Strategis Pembangunan Daerah Jabar 2026",
            nilai_kontrak=450000000,
            jenis_mekanisme="Bidding",
            tahapan="Penyusunan Ustek",
            status_project="Menang",
            lokasi="Cabang Jatim",
            kategori_project="Gov",
            divisi_substansi="Gov",
            pemberi_kerja="Bappeda Provinsi Jabar",
            satuan_kerja="Bidang Perencanaan Ekonomi",
            pic="Ahmad IR",
            deadline_pengumuman=datetime.date(2026, 10, 15),
            peringkat="1",
            keterangan_tender="Pemenang tender peringkat pertama",
            status_selesai_substansi=False,
            status_penulisan_ustek="Sedang Disusun",
            deadline_penulisan_ustek=datetime.date(2026, 9, 25),
            pic_ustek="Budi Gov",
            tim_ustek="Budi Gov, Siti Analyst",
            url_ustek="https://drive.google.com/ustek-jabar-2026",
            admin="Proses",
            tanggal_mulai_spk=datetime.date(2026, 9, 1),
            tanggal_spk_berakhir=datetime.date(2026, 9, 20),
            link_spk="https://drive.google.com/spk-jabar",
            link_bast=None,
            link_referensi=None
        )

        p2 = models.Project(
            nama_pekerjaan="Survei Persepsi Publik & Pemetaan Konstituen Pilkada",
            nilai_kontrak=300000000,
            jenis_mekanisme="PL",
            tahapan="Upload Ustek",
            status_project="Menang",
            lokasi="Pusat",
            kategori_project="Pol",
            divisi_substansi="Pol",
            pemberi_kerja="DPD Partai Pol Jabar",
            satuan_kerja="Sekretariat DPD",
            pic="Dewi IR",
            keterangan_tender="Penunjukan Langsung (PL)",
            status_selesai_substansi=True,
            status_penulisan_ustek="Selesai",
            pic_ustek="Eko Pol",
            tim_ustek="Eko Pol, Rian Researcher",
            url_ustek="https://drive.google.com/ustek-pilkada",
            admin="Selesai",
            tanggal_mulai_spk=datetime.date(2026, 8, 1),
            tanggal_spk_berakhir=datetime.date(2026, 11, 30),
            link_spk="https://drive.google.com/spk-pilkada",
            link_bast="https://drive.google.com/bast-pilkada",
            link_referensi="https://drive.google.com/ref-pilkada"
        )

        p3 = models.Project(
            nama_pekerjaan="Penyusunan Masterplan Smart City Kota Bandung",
            nilai_kontrak=250000000,
            jenis_mekanisme="Bidding",
            tahapan="Evaluasi PQ",
            status_project="Ongoing",
            lokasi="Pusat",
            kategori_project="Gov",
            divisi_substansi="Gov",
            pemberi_kerja="Diskominfo Kota Bandung",
            satuan_kerja="Bidang E-Gov",
            pic="Ahmad IR",
            deadline_pengumuman=datetime.date(2026, 10, 1),
            peringkat="Pending",
            keterangan_tender="Tahap Evaluasi Dokumen Kualifikasi PQ",
            status_selesai_substansi=False
        )

        db.add_all([p1, p2, p3])
        db.commit()

        # Stages for P1
        s1 = models.ProjectStage(project_id=p1.id, nama_tahapan="Upload PQ", tanggal=datetime.date(2026, 8, 10), status="Selesai", keterangan="Dokumen PQ lengkap")
        s2 = models.ProjectStage(project_id=p1.id, nama_tahapan="Evaluasi PQ", tanggal=datetime.date(2026, 8, 18), status="Selesai", keterangan="Lolos kualifikasi")
        s3 = models.ProjectStage(project_id=p1.id, nama_tahapan="Penyusunan Ustek", tanggal=datetime.date(2026, 9, 5), status="Ongoing", keterangan="Proses penyusunan draft ustek")
        
        # Stages for P2
        s4 = models.ProjectStage(project_id=p2.id, nama_tahapan="Penunjukan Langsung (PL)", tanggal=datetime.date(2026, 8, 1), status="Selesai", keterangan="SPK disetujui")

        db.add_all([s1, s2, s3, s4])

        # Billings for P1 & P2
        b1 = models.Billing(project_id=p1.id, nama="Termin 1 (DP 30%)", nominal=135000000, tanggal_penagihan=datetime.date(2026, 9, 10), status="Sudah dibayarkan", catatan="Pembayaran DP")
        b2 = models.Billing(project_id=p1.id, nama="Termin 2 (Pelaporan 40%)", nominal=180000000, tanggal_penagihan=datetime.date(2026, 10, 15), status="Belum ditagih", catatan="Menunggu BAST 1")
        b3 = models.Billing(project_id=p1.id, nama="Termin 3 (Pelunasan 30%)", nominal=135000000, tanggal_penagihan=datetime.date(2026, 11, 20), status="Belum ditagih", catatan="Pelunasan akhir")

        b4 = models.Billing(project_id=p2.id, nama="Termin 1 (Pelunasan 100%)", nominal=300000000, tanggal_penagihan=datetime.date(2026, 8, 15), status="Sudah dibayarkan", catatan="Lunas 100%")

        db.add_all([b1, b2, b3, b4])
        db.commit()

    db.close()
    print("Seed data updated successfully.")

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_data()
