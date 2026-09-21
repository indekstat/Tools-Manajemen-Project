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
    
    # Ustek fields
    status_selesai_substansi = Column(Boolean, default=False)
    status_selesai_administrasi = Column(Boolean, default=False)
    status_ustek_review = Column(String, default="Draft") # Draft, On Review, Approved
    status_penulisan_ustek = Column(String)
    deadline_penulisan_ustek = Column(Date, nullable=True)
    pic_ustek = Column(String)
    tim_ustek = Column(String, nullable=True)
    url_ustek = Column(String, nullable=True)

    # Finance & Admin fields
    admin = Column(String)
    tanggal_mulai_spk = Column(Date, nullable=True)
    tanggal_spk_berakhir = Column(Date, nullable=True)
    link_spk = Column(String, nullable=True)
    link_bast = Column(String, nullable=True)
    link_referensi = Column(String, nullable=True)

    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    stages = relationship("ProjectStage", back_populates="project", cascade="all, delete-orphan")
    bidding_stages = relationship("BiddingStage", back_populates="project", cascade="all, delete-orphan")
    billings = relationship("Billing", back_populates="project", cascade="all, delete-orphan")
    dashboards = relationship("ProjectDashboard", back_populates="project", cascade="all, delete-orphan")

class ProjectStage(Base):
    __tablename__ = "project_stages"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    nama_tahapan = Column(String)
    tanggal = Column(Date, nullable=True)
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

    project = relationship("Project", back_populates="billings")

class ProjectDashboard(Base):
    __tablename__ = "project_dashboards"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    url_dashboard = Column(String, nullable=False)
    keterangan = Column(String, nullable=True)

    project = relationship("Project", back_populates="dashboards")
