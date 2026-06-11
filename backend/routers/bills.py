"""
颐智康养 - 费用账单 API
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import get_db, Bill, Elder, PaymentStatus
from schemas import BillCreate, BillOut
from auth import RequirePermission

router = APIRouter(prefix="/api/bills", tags=["费用账单"])


@router.get("/", response_model=list[BillOut], summary="账单列表")
def list_bills(
    elder_id: Optional[int] = Query(None, description="按老人筛选"),
    status: Optional[str] = Query(None, description="按状态筛选: unpaid/paid/overdue"),
    bill_month: Optional[str] = Query(None, description="按月份筛选: 2026-05"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("bill:view")),
):
    """账单列表，支持按老人、状态、月份筛选"""
    q = db.query(Bill)
    if elder_id:
        q = q.filter(Bill.elder_id == elder_id)
    if status:
        q = q.filter(Bill.status == status)
    if bill_month:
        q = q.filter(Bill.bill_month == bill_month)
    q = q.order_by(Bill.due_date.desc())
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.post("/", response_model=BillOut, status_code=201, summary="创建账单")
def create_bill(
    data: BillCreate,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("bill:create")),
):
    """创建新账单"""
    elder = db.query(Elder).filter(Elder.id == data.elder_id).first()
    if not elder:
        raise HTTPException(status_code=404, detail="老人不存在")

    bill = Bill(**data.model_dump())
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


@router.post("/{bill_id}/pay", summary="确认缴费")
def pay_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("bill:pay")),
):
    """确认账单缴费"""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")

    bill.status = PaymentStatus.PAID.value
    bill.paid_amount = bill.total_amount
    bill.paid_date = date.today()
    db.commit()
    return {"message": "缴费成功", "bill_id": bill_id}


@router.get("/overdue", response_model=list[BillOut], summary="逾期账单")
def overdue_bills(
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("bill:view")),
):
    """查询全部逾期未缴账单"""
    return (
        db.query(Bill)
        .filter(
            Bill.status == PaymentStatus.UNPAID.value,
            Bill.due_date < date.today(),
        )
        .order_by(Bill.due_date)
        .all()
    )
