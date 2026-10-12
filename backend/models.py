from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String) # IR, Gov, Pol, Finance, Viewer, Superadmin
    level = Column(String, default="STAFF") # CHIEF, HEAD, STAFF
    divisi = Column(String, nullable=True)
    nama = Column(String, nullable=True)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    nama_pekerjaan = Column(String, index=True)
    nilai_kontrak = Column(Float, default=0.0)
    nilai_project_deal = Column(Float, default=0.0, nullable=True)
    jenis_mekanisme = Column(String, default="Bidding") # Bidding, PL
    tahapan = Column(String) # Upload PQ, Evaluasi PQ, Pembuktian, Penyusunan Ustek, Upload Ustek
    status = Column(String)
    status_project = Column(String, default="Ongoing") # Ongoing, Menang, Kalah, Batal, Tidak Memenuhi Ambang Batas
    lokasi = Column(String, default="Pusat") # Pusat, Cabang Jatim, Cabang Jateng
    kategori_project = Column(String) # Gov, Pol
    divisi_substansi = Column(String) # Gov, Pol
    pemberi_kerja = Column(String)
    satuan_kerja = Column(String)
    pic = Column(String)
    deadline_pengumuman = Column(Date, nullable=True)
    peringkat = Column(String, nullable=True)
    keterangan_tender = Column(Text, nullable=True)
    prioritas = Column(String, default="Priority") # Priority, Non-Priority, Deal Undertable
    metode_pekerjaan = Column(String, nullable=True) # Survey, Kajian, Development
    jenis_pekerjaan = Column(String, nullable=True) # IT, Bisnis Intelligence, Indeks, Peta Potensi, Evaluasi Program, Manajemen, Pendampingan, Survei Politik, Analisa Dapil, Kelola Relawan
    
    # Ustek & Penawaran fields
    status_selesai_substansi = Column(Boolean, default=False)
    status_selesai_administrasi = Column(Boolean, default=False)
    status_ustek_review = Column(String, default="Draft") # Draft, On Review, Approved
    status_penulisan_ustek = Column(String)
    status_ustek = Column(String, default="Belum") # Belum, On Progress, Selesai
    deadline_penulisan_ustek = Column(Date, nullable=True)
    pic_ustek = Column(String)
    pic_substansi = Column(String, nullable=True)
    tim_ustek = Column(String, nullable=True)
    url_ustek = Column(String, nullable=True)
    url_rab = Column(String, nullable=True)
    status_rab = Column(String, default="Belum") # Belum, On Progress, Selesai
    url_ta = Column(String, nullable=True)
    status_ta = Column(String, default="Belum") # Belum, On Progress, Selesai

    # Approval fields
    approval_ustek = Column(Boolean, default=False)
    approval_rab = Column(Boolean, default=False)
    approval_ta = Column(Boolean, default=False)

    # Finance & Admin fields
    admin = Column(String)
    tanggal_mulai_spk = Column(Date, nullable=True)
    tanggal_spk_berakhir = Column(Date, nullable=True)
    link_spk = Column(String, nullable=True)
    link_bast = Column(String, nullable=True)
    link_referensi = Column(String, nullable=True)
    entitas = Column(String, nullable=True) # PT, Yayasan

    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    stages = relationship("ProjectStage", back_populates="project", cascade="all, delete-orphan")
    bidding_stages = relationship("BiddingStage", back_populates="project", cascade="all, delete-orphan")
    billings = relationship("Billing", back_populates="project", cascade="all, delete-orphan")
    dashboards = relationship("ProjectDashboard", back_populates="project", cascade="all, delete-orphan")
    penugasan_ta = relationship("TAPenugasan", back_populates="project", cascade="all, delete-orphan")

class ProjectStage(Base):
    __tablename__ = "project_stages"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    nama_tahapan = Column(String)
    tanggal = Column(Date, nullable=True)
    deadline = Column(Date, nullable=True)
    status = Column(String) # Ongoing, Selesai, Pending
    keterangan = Column(String, nullable=True)
    is_meeting = Column(Boolean, default=False)
    tipe_meeting = Column(String, nullable=True) # Online, Offline

    project = relationship("Project", back_populates="stages")

class BiddingStage(Base):
    __tablename__ = "bidding_stages"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    nama_tahapan = Column(String, nullable=False) # Upload PQ, Evaluasi PQ, Pembuktian, Penyusunan Ustek, Upload Ustek
    tanggal_deadline = Column(Date, nullable=True)
    status = Column(String, default="Pending") # Pending, Ongoing, Selesai, Batal
    keterangan = Column(String, nullable=True)

    project = relationship("Project", back_populates="bidding_stages")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    task = Column(String)
    deskripsi = Column(String)
    jenis_tahapan = Column(String)
    status = Column(String)
    deadline = Column(Date, nullable=True)
    tanggal_mulai = Column(Date, nullable=True)
    tanggal_selesai = Column(Date, nullable=True)
    pic = Column(String)

    project = relationship("Project", back_populates="tasks")

class Billing(Base):
    __tablename__ = "billings"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    nama = Column(String) # Termin 1, Termin 2, dst.
    nominal = Column(Float, default=0.0)
    tanggal_penagihan = Column(Date, nullable=True)
    status = Column(String, default="Belum ditagih") # Belum ditagih, Sudah ditagih, Sudah dibayarkan
    catatan = Column(String, nullable=True)
    link_bast = Column(String, nullable=True)
    link_dokumen_penagihan = Column(String, nullable=True)
    tanggal_uang_masuk = Column(Date, nullable=True)

    project = relationship("Project", back_populates="billings")

class ProjectDashboard(Base):
    __tablename__ = "project_dashboards"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    url_dashboard = Column(String, nullable=False)
    keterangan = Column(String, nullable=True)

    project = relationship("Project", back_populates="dashboards")

class TenagaAhli(Base):
    __tablename__ = "tenaga_ahli"
    id = Column(Integer, primary_key=True, index=True)
    kode = Column(String, unique=True, index=True) # TA-0001
    nama = Column(String, index=True)
    kategori_bidang = Column(String, nullable=True)
    status = Column(String, default="Eksternal") # Internal, Eksternal, Research Associate, Levner
    no_hp = Column(String, nullable=True)
    bidang_keahlian = Column(Text, nullable=True)
    domisili = Column(String, nullable=True)
    pengalaman_tahun = Column(Float, nullable=True)
    kategori_pengalaman = Column(String, nullable=True)
    prioritas = Column(String, nullable=True) # Level 1, 2, 3
    sumber_data = Column(String, nullable=True)
    catatan = Column(Text, nullable=True)

    pendidikan = relationship("TAPendidikan", back_populates="tenaga_ahli", cascade="all, delete-orphan")
    sertifikasi = relationship("TASertifikasi", back_populates="tenaga_ahli", cascade="all, delete-orphan")
    penugasan = relationship("TAPenugasan", back_populates="tenaga_ahli", cascade="all, delete-orphan")

class TAPendidikan(Base):
    __tablename__ = "ta_pendidikan"
    id = Column(Integer, primary_key=True, index=True)
    ta_id = Column(Integer, ForeignKey("tenaga_ahli.id"), nullable=False)
    jenjang = Column(String) # S1, S2, S3, D3, D4, ...
    jurusan = Column(String, nullable=True)
    universitas = Column(String, nullable=True)
    tahun_lulus = Column(Integer, nullable=True)

    tenaga_ahli = relationship("TenagaAhli", back_populates="pendidikan")

class TASertifikasi(Base):
    __tablename__ = "ta_sertifikasi"
    id = Column(Integer, primary_key=True, index=True)
    ta_id = Column(Integer, ForeignKey("tenaga_ahli.id"), nullable=False)
    nama_sertifikasi = Column(Text)
    tahun = Column(Integer, nullable=True)

    tenaga_ahli = relationship("TenagaAhli", back_populates="sertifikasi")

class TAPenugasan(Base):
    __tablename__ = "ta_penugasan"
    id = Column(Integer, primary_key=True, index=True)
    ta_id = Column(Integer, ForeignKey("tenaga_ahli.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    posisi = Column(String, nullable=True) # Team Leader, Tenaga Ahli Desa, dst.
    fee = Column(Float, nullable=True)
    tanggal_mulai = Column(Date, nullable=True)
    tanggal_selesai = Column(Date, nullable=True)
    status = Column(String, default="Diajukan") # Diajukan, Konfirmasi, Aktif, Selesai, Batal
    catatan = Column(String, nullable=True)

    tenaga_ahli = relationship("TenagaAhli", back_populates="penugasan")
    project = relationship("Project", back_populates="penugasan_ta")
