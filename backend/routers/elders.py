"""
颐智康养 - 老人管理 API
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import get_db, Elder, ElderStatus
from schemas import ElderCreate, ElderUpdate, ElderOut
from auth import RequirePermission

router = APIRouter(prefix="/api/elders", tags=["老人管理"])


@router.get("/", response_model=list[ElderOut], summary="老人列表")
def list_elders(
    status: Optional[str] = Query(None, description="筛选状态: checked_in/checked_out"),
    keyword: Optional[str] = Query(None, description="搜索姓名"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("elder:view")),
):
    """老人列表，支持按状态和姓名搜索"""
    q = db.query(Elder)
    if status:
        q = q.filter(Elder.status == status)
    if keyword:
        q = q.filter(Elder.name.contains(keyword))
    q = q.order_by(Elder.check_in_date.desc())
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.get("/{elder_id}", response_model=ElderOut, summary="老人详情")
def get_elder(
    elder_id: int,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("elder:view")),
):
    """查看老人详细信息"""
    elder = db.query(Elder).filter(Elder.id == elder_id).first()
    if not elder:
        raise HTTPException(status_code=404, detail="老人不存在")
    return elder


@router.post("/", response_model=ElderOut, status_code=201, summary="登记入住")
def create_elder(
    data: ElderCreate,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("elder:create")),
):
    """登记新入住的老人"""
    elder = Elder(**data.model_dump())
    elder.status = ElderStatus.CHECKED_IN.value
    db.add(elder)
    db.commit()
    db.refresh(elder)
    return elder


@router.put("/{elder_id}", response_model=ElderOut, summary="更新老人信息")
def update_elder(
    elder_id: int,
    data: ElderUpdate,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("elder:edit")),
):
    """更新老人基本信息"""
    elder = db.query(Elder).filter(Elder.id == elder_id).first()
    if not elder:
        raise HTTPException(status_code=404, detail="老人不存在")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(elder, key, val)
    db.commit()
    db.refresh(elder)
    return elder


@router.post("/{elder_id}/checkout", summary="办理退住")
def checkout_elder(
    elder_id: int,
    check_out_date: date = None,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("elder:edit")),
):
    """为老人办理退住手续"""
    elder = db.query(Elder).filter(Elder.id == elder_id).first()
    if not elder:
        raise HTTPException(status_code=404, detail="老人不存在")
    elder.status = ElderStatus.CHECKED_OUT.value
    elder.check_out_date = check_out_date or date.today()
    db.commit()
    return {"message": "退住成功", "elder_id": elder_id}
