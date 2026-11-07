"""Pengecekan akses & hapus-lunak yang dipakai bersama oleh main.py dan tenaga_ahli.py."""
import datetime
from fastapi import HTTPException
import models


def project_or_404(db, project_id: int, user, write: bool = False) -> models.Project:
    """Project yang belum dihapus dan boleh diakses user (Gov/Pol hanya project divisinya; Viewer tidak boleh menulis)."""
    p = db.query(models.Project).filter(models.Project.id == project_id, models.Project.deleted_at == None).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if write and user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot modify projects")
    if user.role in ("Gov", "Pol") and p.kategori_project != user.role:
        raise HTTPException(status_code=403, detail="Not allowed for other division's project")
    return p


def visible_project_ids(db, user):
    """Subquery id project yang belum dihapus dan terlihat oleh user."""
    q = db.query(models.Project.id).filter(models.Project.deleted_at == None)
    if user.role in ("Gov", "Pol"):
        q = q.filter(models.Project.kategori_project == user.role)
    return q


def live(db, model, row_id: int, detail: str):
    """Ambil baris yang belum dihapus-lunak, atau 404."""
    row = db.query(model).filter(model.id == row_id, model.deleted_at == None).first()
    if not row:
        raise HTTPException(status_code=404, detail=detail)
    return row


def soft_delete(row, user) -> None:
    row.deleted_at = datetime.datetime.utcnow()
    row.deleted_by = user.username
