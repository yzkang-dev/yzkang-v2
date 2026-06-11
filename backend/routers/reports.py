"""
颐智康养 - 报表中心 API
"""
from datetime import date, datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from models import get_db, Elder, CareRecord, Bill, MedicationLog, VitalSigns, Alert, ShiftRecord, User
from auth import RequirePermission

router = APIRouter(prefix="/api/reports", tags=["报表中心"])


# ==================== 1. 入住率报表 ====================

@router.get("/occupancy", summary="入住率报表")
def report_occupancy(
    year: int = Query(..., description="年份"),
    month: int = Query(None, description="月份(不传则全年)"),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("report:view")),
):
    """入住率统计：按月统计入住/退住/在住人数及入住率"""
    results = []

    if month:
        months = [(year, month)]
    else:
        months = [(year, m) for m in range(1, 13)]

    for y, m in months:
        month_start = date(y, m, 1)
        if m == 12:
            month_end = date(y + 1, 1, 1)
        else:
            month_end = date(y, m + 1, 1)

        # 月初在住 = 该月1号之前入住且未退住的
        checked_in_before = db.query(func.count(Elder.id)).filter(
            Elder.check_in_date < month_start,
            (Elder.check_out_date.is_(None)) | (Elder.check_out_date >= month_start)
        ).scalar() or 0

        # 本月新入住
        new_checkins = db.query(func.count(Elder.id)).filter(
            Elder.check_in_date >= month_start,
            Elder.check_in_date < month_end
        ).scalar() or 0

        # 本月退住
        checkouts = db.query(func.count(Elder.id)).filter(
            Elder.check_out_date >= month_start,
            Elder.check_out_date < month_end
        ).scalar() or 0

        # 月末在住 = 月初 + 新入住 - 退住
        month_end_count = checked_in_before + new_checkins - checkouts

        # 总床位（假设所有录入过的房间号即为总床位）
        total_beds = db.query(func.count(func.distinct(Elder.room_number))).filter(
            Elder.room_number.isnot(None)
        ).scalar() or 0
        if total_beds == 0:
            total_beds = month_end_count or 1

        occupancy_rate = round(month_end_count / total_beds * 100, 1) if total_beds > 0 else 0

        results.append({
            "year": y,
            "month": m,
            "label": f"{y}年{m}月",
            "begin_count": checked_in_before,
            "new_checkins": new_checkins,
            "checkouts": checkouts,
            "end_count": month_end_count,
            "total_beds": total_beds,
            "occupancy_rate": occupancy_rate,
        })

    return {"data": results}


# ==================== 2. 费用营收报表 ====================

@router.get("/revenue", summary="费用营收报表")
def report_revenue(
    year: int = Query(..., description="年份"),
    month: int = Query(None, description="月份(不传则全年)"),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("report:view")),
):
    """营收统计：按月统计应收/实收/欠费及收款率"""
    results = []

    if month:
        months = [(year, month)]
    else:
        months = [(year, m) for m in range(1, 13)]

    for y, m in months:
        bill_month_str = f"{y}-{m:02d}"

        bills = db.query(Bill).filter(Bill.bill_month == bill_month_str).all()

        total_bills = len(bills)
        total_amount = sum(b.total_amount for b in bills)
        paid_amount = sum(b.paid_amount for b in bills)
        unpaid_amount = total_amount - paid_amount
        unpaid_count = sum(1 for b in bills if b.status in ("unpaid", "overdue"))
        overdue_count = sum(1 for b in bills if b.status == "overdue")

        collection_rate = round(paid_amount / total_amount * 100, 1) if total_amount > 0 else 0

        results.append({
            "year": y,
            "month": m,
            "label": f"{y}年{m}月",
            "total_bills": total_bills,
            "total_amount": round(total_amount, 2),
            "paid_amount": round(paid_amount, 2),
            "unpaid_amount": round(unpaid_amount, 2),
            "unpaid_count": unpaid_count,
            "overdue_count": overdue_count,
            "collection_rate": collection_rate,
        })

    return {"data": results}


# ==================== 3. 护理工作量报表 ====================

@router.get("/care-workload", summary="护理工作量报表")
def report_care_workload(
    start_date: str = Query(..., description="开始日期 YYYY-MM-DD"),
    end_date: str = Query(..., description="结束日期 YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("report:view")),
):
    """护理工作量统计：按护理员统计护理次数及异常次数"""
    sd = datetime.strptime(start_date, "%Y-%m-%d").date()
    ed = datetime.strptime(end_date, "%Y-%m-%d").date()

    # 按护理员 + 护理类型分组统计
    records = db.query(
        CareRecord.nurse_id,
        CareRecord.care_type,
        func.count(CareRecord.id).label("count"),
        func.sum(CareRecord.is_abnormal.cast(int)).label("abnormal_count"),
    ).filter(
        CareRecord.record_date >= sd,
        CareRecord.record_date <= ed,
    ).group_by(CareRecord.nurse_id, CareRecord.care_type).all()

    # 按护理员汇总
    nurse_map = {}
    for r in records:
        nurse_id, care_type, count, abnormal = r
        if nurse_id not in nurse_map:
            user = db.query(User).filter(User.id == nurse_id).first()
            nurse_map[nurse_id] = {
                "nurse_id": nurse_id,
                "nurse_name": user.real_name if user else "未知",
                "total_count": 0,
                "abnormal_count": 0,
                "details": [],
            }
        nurse_map[nurse_id]["total_count"] += count
        nurse_map[nurse_id]["abnormal_count"] += abnormal
        nurse_map[nurse_id]["details"].append({
            "care_type": care_type,
            "count": count,
            "abnormal_count": abnormal,
        })

    results = sorted(nurse_map.values(), key=lambda x: x["total_count"], reverse=True)

    return {"data": results, "period": {"start": start_date, "end": end_date}}


# ==================== 4. 用药执行报表 ====================

@router.get("/medication-compliance", summary="用药依从性报表")
def report_medication_compliance(
    start_date: str = Query(..., description="开始日期 YYYY-MM-DD"),
    end_date: str = Query(..., description="结束日期 YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("report:view")),
):
    """用药依从性统计：按时服药率、按老人分组"""
    sd = datetime.strptime(start_date, "%Y-%m-%d").date()
    ed = datetime.strptime(end_date, "%Y-%m-%d").date()

    logs = db.query(MedicationLog).filter(
        func.date(MedicationLog.log_time) >= sd,
        func.date(MedicationLog.log_time) <= ed,
    ).all()

    taken = sum(1 for l in logs if l.is_taken)
    missed = sum(1 for l in logs if not l.is_taken)
    total = len(logs)
    compliance_rate = round(taken / total * 100, 1) if total > 0 else 0

    # 按老人分组
    elder_map = {}
    for l in logs:
        med = l.medication_id  # 需要通过medication表找elder
        # 简单处理：通过medication关联
        from models import Medication
        med_obj = db.query(Medication).filter(Medication.id == l.medication_id).first()
        if not med_obj:
            continue
        eid = med_obj.elder_id
        if eid not in elder_map:
            elder = db.query(Elder).filter(Elder.id == eid).first()
            elder_map[eid] = {
                "elder_id": eid,
                "elder_name": elder.name if elder else "未知",
                "taken": 0,
                "missed": 0,
            }
        if l.is_taken:
            elder_map[eid]["taken"] += 1
        else:
            elder_map[eid]["missed"] += 1

    return {
        "data": {
            "summary": {
                "total": total,
                "taken": taken,
                "missed": missed,
                "compliance_rate": compliance_rate,
            },
            "by_elder": list(elder_map.values()),
        },
        "period": {"start": start_date, "end": end_date},
    }


# ==================== 5. 健康体征报表 ====================

@router.get("/health-summary", summary="健康体征汇总报表")
def report_health_summary(
    elder_id: int = Query(None, description="老人ID(不传则全部)"),
    start_date: str = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: str = Query(None, description="结束日期 YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("report:view")),
):
    """健康体征汇总：按老人汇总各项指标的平均值/最高/最低/异常次数"""
    query = db.query(VitalSigns)

    if elder_id:
        query = query.filter(VitalSigns.elder_id == elder_id)

    if start_date:
        sd = datetime.strptime(start_date, "%Y-%m-%d").date()
        query = query.filter(VitalSigns.record_date >= sd)
    if end_date:
        ed = datetime.strptime(end_date, "%Y-%m-%d").date()
        query = query.filter(VitalSigns.record_date <= ed)

    records = query.all()

    # 按老人分组
    elder_map = {}
    for r in records:
        eid = r.elder_id
        if eid not in elder_map:
            elder = db.query(Elder).filter(Elder.id == eid).first()
            elder_map[eid] = {
                "elder_id": eid,
                "elder_name": elder.name if elder else "未知",
                "room_number": elder.room_number if elder else "",
                "record_count": 0,
                "abnormal_count": 0,
                "avg_systolic": 0, "max_systolic": 0, "min_systolic": 999,
                "avg_diastolic": 0, "max_diastolic": 0, "min_diastolic": 999,
                "avg_heart_rate": 0, "max_heart_rate": 0, "min_heart_rate": 999,
                "avg_blood_sugar": 0, "max_blood_sugar": 0, "min_blood_sugar": 999,
                "avg_temperature": 0, "max_temperature": 0, "min_temperature": 999,
                "avg_oxygen": 0, "max_oxygen": 0, "min_oxygen": 999,
            }

        d = elder_map[eid]
        d["record_count"] += 1
        if r.is_abnormal:
            d["abnormal_count"] += 1

        # 累加各项指标
        indicators = [
            ("systolic", r.blood_pressure_systolic),
            ("diastolic", r.blood_pressure_diastolic),
            ("heart_rate", r.heart_rate),
            ("blood_sugar", r.blood_sugar),
            ("temperature", r.temperature),
            ("oxygen", r.oxygen_saturation),
        ]
        for key, val in indicators:
            if val is not None:
                d[f"avg_{key}"] += val
                d[f"max_{key}"] = max(d[f"max_{key}"], val)
                d[f"min_{key}"] = min(d[f"min_{key}"], val)

    # 算平均值，清理哨兵值
    results = []
    for d in elder_map.values():
        n = d["record_count"]
        if n > 0:
            for key in ["systolic", "diastolic", "heart_rate", "blood_sugar", "temperature", "oxygen"]:
                d[f"avg_{key}"] = round(d[f"avg_{key}"] / n, 1)
                if d[f"min_{key}"] == 999:
                    d[f"min_{key}"] = None
        results.append(d)

    return {"data": results}


# ==================== 6. 告警统计报表 ====================

@router.get("/alert-summary", summary="告警统计报表")
def report_alert_summary(
    start_date: str = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: str = Query(None, description="结束日期 YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("report:view")),
):
    """告警统计：按类型/严重程度/老人汇总告警数据"""
    query = db.query(Alert)
    if start_date:
        sd = datetime.strptime(start_date, "%Y-%m-%d").date()
        query = query.filter(func.date(Alert.created_at) >= sd)
    if end_date:
        ed = datetime.strptime(end_date, "%Y-%m-%d").date()
        query = query.filter(func.date(Alert.created_at) <= ed)

    alerts = query.all()

    total = len(alerts)
    unresolved = sum(1 for a in alerts if not a.is_resolved)
    warning_count = sum(1 for a in alerts if a.severity == "warning")
    critical_count = sum(1 for a in alerts if a.severity == "critical")

    # 按指标类型统计
    indicator_map = {}
    for a in alerts:
        ind = a.indicator
        if ind not in indicator_map:
            indicator_map[ind] = {"indicator": ind, "total": 0, "warning": 0, "critical": 0, "unresolved": 0}
        indicator_map[ind]["total"] += 1
        if a.severity == "warning":
            indicator_map[ind]["warning"] += 1
        else:
            indicator_map[ind]["critical"] += 1
        if not a.is_resolved:
            indicator_map[ind]["unresolved"] += 1

    # 按老人统计
    elder_map = {}
    for a in alerts:
        eid = a.elder_id
        if eid not in elder_map:
            elder = db.query(Elder).filter(Elder.id == eid).first()
            elder_map[eid] = {
                "elder_id": eid,
                "elder_name": elder.name if elder else "未知",
                "total": 0,
                "unresolved": 0,
            }
        elder_map[eid]["total"] += 1
        if not a.is_resolved:
            elder_map[eid]["unresolved"] += 1

    return {
        "data": {
            "summary": {
                "total": total,
                "unresolved": unresolved,
                "warning": warning_count,
                "critical": critical_count,
            },
            "by_indicator": list(indicator_map.values()),
            "by_elder": sorted(elder_map.values(), key=lambda x: x["total"], reverse=True),
        }
    }


# ==================== 7. 交接班报表 ====================

@router.get("/shift-summary", summary="交接班记录报表")
def report_shift_summary(
    start_date: str = Query(..., description="开始日期 YYYY-MM-DD"),
    end_date: str = Query(..., description="结束日期 YYYY-MM-DD"),
    shift_type: str = Query(None, description="班次: morning/night"),
    db: Session = Depends(get_db),
    _ = Depends(RequirePermission("report:view")),
):
    """交接班记录汇总：按日期范围查询交接班记录"""
    sd = datetime.strptime(start_date, "%Y-%m-%d").date()
    ed = datetime.strptime(end_date, "%Y-%m-%d").date()

    query = db.query(ShiftRecord).filter(
        ShiftRecord.shift_date >= sd,
        ShiftRecord.shift_date <= ed,
    )
    if shift_type:
        query = query.filter(ShiftRecord.shift_type == shift_type)

    records = query.order_by(ShiftRecord.shift_date.desc()).all()

    results = []
    for r in records:
        from_user = db.query(User).filter(User.id == r.from_nurse_id).first()
        to_user = db.query(User).filter(User.id == r.to_nurse_id).first()
        results.append({
            "id": r.id,
            "shift_date": r.shift_date.isoformat(),
            "shift_type": r.shift_type,
            "from_nurse": from_user.real_name if from_user else "未知",
            "to_nurse": to_user.real_name if to_user else "未知",
            "summary": r.summary,
            "special_notes": r.special_notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"data": results, "total": len(results)}
