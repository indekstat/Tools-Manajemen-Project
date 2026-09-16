from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from database import engine, Base, get_db
import models
import schemas
import auth

# Create database tables
Base.metadata.create_all(bind=engine)

import seed_users
try:
    seed_users.seed()
except Exception as e:
    print("Auto-seed users notice:", e)

app = FastAPI(title="Project Tracking System API (V2)")

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

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.User).all()

@app.post("/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["Superadmin", "Admin", "IR", "Gov"]))):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        password_hash=hashed_password,
        role=user.role,
        level=user.level,
        divisi=user.divisi,
        nama=user.nama or user.username
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

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
    return query.all()

@app.post("/projects", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["IR"]))):
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Auto-initialize standard 5 bidding stages for Bidding tenders
    if (db_project.jenis_mekanisme or "Bidding") == "Bidding":
        standard_stages = [
            ("Upload PQ", "Ongoing" if db_project.tahapan == "Upload PQ" else "Pending"),
            ("Evaluasi PQ", "Ongoing" if db_project.tahapan == "Evaluasi PQ" else "Pending"),
            ("Pembuktian", "Ongoing" if db_project.tahapan == "Pembuktian" else "Pending"),
            ("Penyusunan Ustek", "Ongoing" if db_project.tahapan == "Penyusunan Ustek" else "Pending"),
            ("Upload Ustek", "Ongoing" if db_project.tahapan == "Upload Ustek" else "Pending"),
        ]
        for name, status in standard_stages:
            stage_obj = models.BiddingStage(
                project_id=db_project.id,
                nama_tahapan=name,
                status=status,
                tanggal_deadline=db_project.deadline_pengumuman if name == db_project.tahapan else None
            )
            db.add(stage_obj)
        db.commit()
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
def create_bidding_stage(project_id: int, stage: schemas.BiddingStageBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["IR"]))):
    db_stage = models.BiddingStage(**stage.model_dump(), project_id=project_id)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.put("/bidding-stages/{stage_id}", response_model=schemas.BiddingStageResponse)
def update_bidding_stage(stage_id: int, stage: schemas.BiddingStageUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_stage = db.query(models.BiddingStage).filter(models.BiddingStage.id == stage_id).first()
    if not db_stage:
        raise HTTPException(status_code=404, detail="Bidding Stage not found")
    
    for key, value in stage.model_dump(exclude_unset=True).items():
        setattr(db_stage, key, value)
        
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.delete("/bidding-stages/{stage_id}")
def delete_bidding_stage(stage_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.check_role(["IR"]))):
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
