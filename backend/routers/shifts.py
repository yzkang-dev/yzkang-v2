"""
颐智康养 - 交接班记录 API
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import get_db, ShiftRecord, User
from schemas import ShiftRecordCreate, ShiftRecordOut
from auth import RequirePermission

router = APIRouter(prefix="/api/shifts", tags=["交接班记录"])


@router.get("/", response_model=list[ShiftRecordOut], summary="交接班记录列表")
def list_shifts(
    shift_date: Optional[date] = Query(None, description="按日期筛选"),
    shift_type: Optional[str] = Query(None, description="班次: morning/night"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("shift:view")),
):
    """交接班记录列表，支持按日期和班次筛选"""
    q = db.query(ShiftRecord)
    if shift_date:
        q = q.filter(ShiftRecord.shift_date == shift_date)
    if shift_type:
        q = q.filter(ShiftRecord.shift_type == shift_type)
    q = q.order_by(ShiftRecord.shift_date.desc(), ShiftRecord.created_at.desc())
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.post("/", response_model=ShiftRecordOut, status_code=201, summary="填写交接班记录")
def create_shift(
    data: ShiftRecordCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RequirePermission("shift:create")),
):
    """填写新的交接班记录"""
    # 验证接班人存在
    to_nurse = db.query(User).filter(User.id == data.to_nurse_id, User.is_active == True).first()
    if not to_nurse:
        raise HTTPException(status_code=404, detail="接班人不存在或已禁用")

    record = ShiftRecord(
        **data.model_dump(),
        from_nurse_id=current_user.id,
        shift_date=date.today(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
