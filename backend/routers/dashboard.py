"""
颐智康养 - 院长看板 API
"""
from datetime import date, datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import get_db, Elder, CareRecord, Bill, User, ElderStatus, PaymentStatus
from schemas import DashboardOut
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api/dashboard", tags=["院长看板"])


@router.get("/", response_model=DashboardOut, summary="看板数据总览")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """院长看板数据总览：在住人数、入住率、营收、异常统计"""
    today = date.today()
    current_month = today.strftime("%Y-%m")

    # 在住老人
    checked_in = (
        db.query(func.count(Elder.id))
        .filter(Elder.status == ElderStatus.CHECKED_IN.value)
        .scalar()
    )

    # 今日入住/退住
    checked_in_today = (
        db.query(func.count(Elder.id))
        .filter(Elder.check_in_date == today)
        .scalar()
    )
    checked_out_today = (
        db.query(func.count(Elder.id))
        .filter(Elder.check_out_date == today)
        .scalar()
    )

    # 总床位 = 在住+空闲（暂按在住计算，实际需配置总床位数）
    total_beds = checked_in or 0

    # 入住率
    occupancy_rate = (checked_in / total_beds * 100) if total_beds > 0 else 0.0

    # 本月营收（已缴费账单）
    monthly_revenue = (
        db.query(func.coalesce(func.sum(Bill.paid_amount), 0))
        .filter(
            Bill.status == PaymentStatus.PAID.value,
            Bill.bill_month == current_month,
        )
        .scalar()
    )

    # 未缴费/逾期账单
    unpaid_bills = (
        db.query(func.count(Bill.id))
        .filter(Bill.status == PaymentStatus.UNPAID.value)
        .scalar()
    )
    overdue_bills = (
        db.query(func.count(Bill.id))
        .filter(
            Bill.status == PaymentStatus.UNPAID.value,
            Bill.due_date < today,
        )
        .scalar()
    )

    # 今日异常护理记录
    abnormal_today = (
        db.query(func.count(CareRecord.id))
        .filter(
            CareRecord.record_date == today,
            CareRecord.is_abnormal == True,
        )
        .scalar()
    )

    # 护理员总数
    total_nurses = (
        db.query(func.count(User.id))
        .filter(User.is_active == True)
        .scalar()
    )

    return DashboardOut(
        total_elders=checked_in or 0,
        checked_in_today=checked_in_today or 0,
        checked_out_today=checked_out_today or 0,
        occupancy_rate=round(occupancy_rate, 1),
        total_beds=total_beds,
        monthly_revenue=float(monthly_revenue or 0),
        unpaid_bills=unpaid_bills or 0,
        overdue_bills=overdue_bills or 0,
        abnormal_today=abnormal_today or 0,
        total_nurses=total_nurses or 0,
    )
