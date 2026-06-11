"""
颐智康养 - 用药执行记录 API
"""
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import get_db, MedicationLog, Medication
from schemas import MedicationLogCreate, MedicationLogOut
from auth import RequirePermission

router = APIRouter(prefix="/api/medication-logs", tags=["用药执行记录"])


@router.get("/", response_model=list[MedicationLogOut], summary="服药记录列表")
def list_logs(
    medication_id: Optional[int] = Query(None, description="按用药计划筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("medication:view")),
):
    """服药记录列表，支持按用药计划筛选"""
    q = db.query(MedicationLog)
    if medication_id:
        q = q.filter(MedicationLog.medication_id == medication_id)
    q = q.order_by(MedicationLog.log_time.desc())
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.post("/", response_model=MedicationLogOut, status_code=201, summary="记录服药")
def create_log(
    data: MedicationLogCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RequirePermission("medication:log")),
):
    """记录一次服药执行"""
    med = db.query(Medication).filter(Medication.id == data.medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="用药记录不存在")
    if not med.is_active:
        raise HTTPException(status_code=400, detail="该用药已停用")

    log = MedicationLog(
        **data.model_dump(),
        nurse_id=current_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
