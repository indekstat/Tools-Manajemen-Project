from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class UserBase(BaseModel):
    username: str
    role: str
    level: Optional[str] = "STAFF"
    divisi: Optional[str] = None
    nama: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class AuthLoginRequest(BaseModel):
    username: str
    password: str

class KaryawanProfile(BaseModel):
    id: Optional[int] = 10
    nik: Optional[str] = "3201xxxxxxxx"
    nip: Optional[str] = "EMP-0010"
    status: Optional[str] = "Tetap"
    status_karyawan: Optional[str] = "Tetap"
    tipe_kontrak: Optional[str] = "PKWTT"
    tanggal_gabung: Optional[str] = "2022-01-10"
    departemen: Optional[str] = "IT"
    divisi: Optional[str] = "Engineering"
    jabatan: Optional[str] = "Staff"
    level_jabatan: Optional[str] = "Staff"
    lokasi_kerja: Optional[str] = "Jakarta"
    foto: Optional[str] = None

class AuthUserDetail(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: bool = True
    is_staff: bool = False
    is_superuser: bool = False
    karyawan: Optional[KaryawanProfile] = None

class AuthLoginResponse(BaseModel):
    token: str
    user: AuthUserDetail

class BulkDeleteRequest(BaseModel):
    ids: List[int]

class ProjectStageBase(BaseModel):
    nama_tahapan: str
    tanggal: Optional[date] = None
    status: Optional[str] = "Ongoing"
    keterangan: Optional[str] = None
    is_meeting: bool = False
    tipe_meeting: Optional[str] = None

class ProjectStageCreate(ProjectStageBase):
    project_id: int

class ProjectStageResponse(ProjectStageBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True

class BiddingStageBase(BaseModel):
    nama_tahapan: str
    tanggal_deadline: Optional[date] = None
    status: Optional[str] = "Pending"
    keterangan: Optional[str] = None

class BiddingStageCreate(BiddingStageBase):
    project_id: int

class BiddingStageUpdate(BaseModel):
    nama_tahapan: Optional[str] = None
    tanggal_deadline: Optional[date] = None
    status: Optional[str] = None
    keterangan: Optional[str] = None

class BiddingStageResponse(BiddingStageBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    task: str
    deskripsi: Optional[str] = None
    jenis_tahapan: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[date] = None
    tanggal_mulai: Optional[date] = None
    tanggal_selesai: Optional[date] = None
    pic: Optional[str] = None

class TaskCreate(TaskBase):
    project_id: int

class TaskResponse(TaskBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True

class BillingBase(BaseModel):
    nama: str
    nominal: float = 0.0
    tanggal_penagihan: Optional[date] = None
    status: Optional[str] = "Belum ditagih"
    catatan: Optional[str] = None

class BillingCreate(BillingBase):
    project_id: int

class BillingUpdate(BaseModel):
    nama: Optional[str] = None
    nominal: Optional[float] = None
    tanggal_penagihan: Optional[date] = None
    status: Optional[str] = None
    catatan: Optional[str] = None

class BillingResponse(BillingBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True

class ProjectDashboardBase(BaseModel):
    url_dashboard: str
    keterangan: Optional[str] = None

class ProjectDashboardCreate(ProjectDashboardBase):
    project_id: int

class ProjectDashboardResponse(ProjectDashboardBase):
    id: int
    project_id: int
    project: Optional['ProjectBase'] = None
    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    nama_pekerjaan: str
    nilai_kontrak: float = 0.0
    jenis_mekanisme: Optional[str] = "Bidding"
    tahapan: Optional[str] = "Upload PQ"
    status: Optional[str] = None
    status_project: Optional[str] = "Ongoing"
    lokasi: Optional[str] = "Pusat"
    kategori_project: Optional[str] = "Gov"
    divisi_substansi: Optional[str] = "Gov"
    pemberi_kerja: Optional[str] = None
    satuan_kerja: Optional[str] = None
    pic: Optional[str] = None
    deadline_pengumuman: Optional[date] = None
    peringkat: Optional[str] = None
    keterangan_tender: Optional[str] = None
    prioritas: Optional[str] = "Priority"
    metode_pekerjaan: Optional[str] = None
    jenis_pekerjaan: Optional[str] = None

    status_selesai_substansi: bool = False
    status_selesai_administrasi: bool = False
    status_ustek_review: Optional[str] = "Draft"
    status_penulisan_ustek: Optional[str] = None
    status_ustek: Optional[str] = "Belum"
    deadline_penulisan_ustek: Optional[date] = None
    pic_ustek: Optional[str] = None
    tim_ustek: Optional[str] = None
    url_ustek: Optional[str] = None
    url_rab: Optional[str] = None
    status_rab: Optional[str] = "Belum"
    url_ta: Optional[str] = None
    status_ta: Optional[str] = "Belum"

    admin: Optional[str] = None
    tanggal_mulai_spk: Optional[date] = None
    tanggal_spk_berakhir: Optional[date] = None
    link_spk: Optional[str] = None
    link_bast: Optional[str] = None
    link_referensi: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    nama_pekerjaan: Optional[str] = None
    nilai_kontrak: Optional[float] = None
    jenis_mekanisme: Optional[str] = None
    tahapan: Optional[str] = None
    status: Optional[str] = None
    status_project: Optional[str] = None
    lokasi: Optional[str] = None
    kategori_project: Optional[str] = None
    divisi_substansi: Optional[str] = None
    pemberi_kerja: Optional[str] = None
    satuan_kerja: Optional[str] = None
    pic: Optional[str] = None
    deadline_pengumuman: Optional[date] = None
    peringkat: Optional[str] = None
    keterangan_tender: Optional[str] = None
    prioritas: Optional[str] = None
    metode_pekerjaan: Optional[str] = None
    jenis_pekerjaan: Optional[str] = None

    status_selesai_substansi: Optional[bool] = None
    status_selesai_administrasi: Optional[bool] = None
    status_ustek_review: Optional[str] = None
    status_penulisan_ustek: Optional[str] = None
    status_ustek: Optional[str] = None
    deadline_penulisan_ustek: Optional[date] = None
    pic_ustek: Optional[str] = None
    tim_ustek: Optional[str] = None
    url_ustek: Optional[str] = None
    url_rab: Optional[str] = None
    status_rab: Optional[str] = None
    url_ta: Optional[str] = None
    status_ta: Optional[str] = None

    admin: Optional[str] = None
    tanggal_mulai_spk: Optional[date] = None
    tanggal_spk_berakhir: Optional[date] = None
    link_spk: Optional[str] = None
    link_bast: Optional[str] = None
    link_referensi: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    tasks: List[TaskResponse] = []
    stages: List[ProjectStageResponse] = []
    bidding_stages: List[BiddingStageResponse] = []
    billings: List[BillingResponse] = []
    class Config:
        from_attributes = True
