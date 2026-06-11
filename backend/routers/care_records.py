"""
颐智康养 - 护理记录 API
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import get_db, CareRecord, Elder
from schemas import CareRecordCreate, CareRecordOut
from auth import RequirePermission

router = APIRouter(prefix="/api/care-records", tags=["护理记录"])


@router.get("/", response_model=list[CareRecordOut], summary="护理记录列表")
def list_care_records(
    elder_id: Optional[int] = Query(None, description="按老人筛选"),
    record_date: Optional[date] = Query(None, description="按日期筛选"),
    is_abnormal: Optional[bool] = Query(None, description="是否异常"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("care:view")),
):
    """护理记录列表，支持按老人、日期、异常状态筛选"""
    q = db.query(CareRecord)
    if elder_id:
        q = q.filter(CareRecord.elder_id == elder_id)
    if record_date:
        q = q.filter(CareRecord.record_date == record_date)
    if is_abnormal is not None:
        q = q.filter(CareRecord.is_abnormal == is_abnormal)
    q = q.order_by(CareRecord.record_time.desc())
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.post("/", response_model=CareRecordOut, status_code=201, summary="新增护理记录")
def create_care_record(
    data: CareRecordCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RequirePermission("care:create")),
):
    """新增一条护理记录"""
    # 验证老人存在
    elder = db.query(Elder).filter(Elder.id == data.elder_id).first()
    if not elder:
        raise HTTPException(status_code=404, detail="老人不存在")

    record = CareRecord(
        **data.model_dump(),
        nurse_id=current_user.id,
        record_date=date.today(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/today", response_model=list[CareRecordOut], summary="今日护理记录")
def today_records(
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("care:view")),
):
    """查询今日全部护理记录"""
    return (
        db.query(CareRecord)
        .filter(CareRecord.record_date == date.today())
        .order_by(CareRecord.record_time.desc())
        .all()
    )
