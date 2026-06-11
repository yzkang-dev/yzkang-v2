"""
颐智康养 - 用药管理 API
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import get_db, Medication, Elder
from schemas import MedicationCreate, MedicationUpdate, MedicationOut
from auth import RequirePermission

router = APIRouter(prefix="/api/medications", tags=["用药管理"])


@router.get("/", response_model=list[MedicationOut], summary="用药列表")
def list_medications(
    elder_id: Optional[int] = Query(None, description="按老人筛选"),
    is_active: Optional[bool] = Query(None, description="是否在用"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("medication:view")),
):
    """用药列表，支持按老人和启用状态筛选"""
    q = db.query(Medication)
    if elder_id:
        q = q.filter(Medication.elder_id == elder_id)
    if is_active is not None:
        q = q.filter(Medication.is_active == is_active)
    q = q.order_by(Medication.is_active.desc(), Medication.start_date.desc())
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.post("/", response_model=MedicationOut, status_code=201, summary="添加用药")
def create_medication(
    data: MedicationCreate,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("medication:create")),
):
    """为老人添加新的用药计划"""
    elder = db.query(Elder).filter(Elder.id == data.elder_id).first()
    if not elder:
        raise HTTPException(status_code=404, detail="老人不存在")

    med = Medication(**data.model_dump())
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@router.put("/{med_id}", response_model=MedicationOut, summary="更新用药")
def update_medication(
    med_id: int,
    data: MedicationUpdate,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("medication:edit")),
):
    """更新用药信息"""
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="用药记录不存在")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(med, key, val)
    db.commit()
    db.refresh(med)
    return med


@router.post("/{med_id}/toggle", summary="启用/停用用药")
def toggle_medication(
    med_id: int,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("medication:edit")),
):
    """切换用药的启用/停用状态"""
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="用药记录不存在")
    med.is_active = not med.is_active
    if not med.is_active:
        med.end_date = date.today()
    else:
        med.end_date = None
    db.commit()
    return {"message": "已停用" if not med.is_active else "已启用", "is_active": med.is_active}
