"""
告警管理 API
- 告警记录 CRUD + 标记已读/处理
- 支持批量操作
- 告警规则 CRUD
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from models import get_db, AlertRule, Alert, Elder, User
from schemas import AlertRuleCreate, AlertRuleOut, AlertRuleUpdate, AlertOut, AlertResolve
from auth import RequirePermission
from logger import get_logger

logger = get_logger("yzkay.alerts")

router = APIRouter(prefix="/api/alerts", tags=["告警管理"])


# ==================== 告警规则 ====================

@router.get("/rules", response_model=list[AlertRuleOut], summary="告警规则列表")
def list_rules(
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:rule")),
):
    """查询所有告警规则"""
    rules = db.query(AlertRule).all()
    return [
        {
            "id": r.id, "name": r.name, "indicator": r.indicator,
            "min_value": r.min_value, "max_value": r.max_value,
            "severity": r.severity, "is_active": r.is_active,
        }
        for r in rules
    ]


@router.post("/rules", response_model=AlertRuleOut, summary="创建告警规则")
def create_rule(
    data: AlertRuleCreate,
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:rule")),
):
    """创建新的告警规则"""
    rule = AlertRule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "name": rule.name, "indicator": rule.indicator,
            "min_value": rule.min_value, "max_value": rule.max_value,
            "severity": rule.severity, "is_active": rule.is_active}


@router.put("/rules/{rule_id}", summary="更新告警规则")
def update_rule(
    rule_id: int,
    data: AlertRuleUpdate,
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:rule")),
):
    """更新告警规则配置"""
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        return {"error": "规则不存在"}
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(rule, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/rules/{rule_id}", summary="删除告警规则")
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:rule")),
):
    """删除告警规则"""
    db.query(AlertRule).filter(AlertRule.id == rule_id).delete()
    db.commit()
    return {"ok": True}


# ==================== 告警记录 ====================

def _build_alert_out(a: Alert) -> dict:
    """构建告警输出"""
    return {
        "id": a.id, "elder_id": a.elder_id,
        "elder_name": a.elder.name if a.elder else None,
        "vital_signs_id": a.vital_signs_id,
        "indicator": a.indicator,
        "measured_value": a.measured_value,
        "threshold_min": a.threshold_min,
        "threshold_max": a.threshold_max,
        "severity": a.severity,
        "message": a.message,
        "is_read": a.is_read,
        "is_resolved": a.is_resolved,
        "resolved_by": a.resolved_by,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        "resolution_note": a.resolution_note,
        "created_at": a.created_at.isoformat(),
    }


@router.get("/", response_model=list[AlertOut], summary="告警列表")
def list_alerts(
    status: str = Query(None, description="unread / unresolved / all"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:view")),
):
    """查询告警列表，支持按状态筛选"""
    q = db.query(Alert).options(joinedload(Alert.elder))
    if status == "unread":
        q = q.filter(Alert.is_read == False)
    elif status == "unresolved":
        q = q.filter(Alert.is_resolved == False)
    q = q.order_by(desc(Alert.created_at)).limit(limit)

    alerts = q.all()
    return [_build_alert_out(a) for a in alerts]


@router.get("/count", summary="告警计数")
def alert_count(
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:view")),
):
    """获取未读/未处理告警数量"""
    unread = db.query(Alert).filter(Alert.is_read == False).count()
    unresolved = db.query(Alert).filter(Alert.is_resolved == False).count()
    return {"unread": unread, "unresolved": unresolved}


@router.get("/{alert_id}", summary="告警详情")
def get_alert_detail(
    alert_id: int,
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:view")),
):
    """查看告警详情（含处理人信息）"""
    a = db.query(Alert).options(
        joinedload(Alert.elder),
    ).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "告警不存在")
    out = _build_alert_out(a)
    if a.resolved_by:
        resolver = db.query(User).filter(User.id == a.resolved_by).first()
        out["resolver_name"] = resolver.real_name if resolver else None
    return out


@router.put("/{alert_id}/read", summary="标记已读")
def mark_read(
    alert_id: int,
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:resolve")),
):
    """将告警标记为已读"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"ok": True}


@router.put("/{alert_id}/resolve", summary="处理告警")
def resolve_alert(
    alert_id: int,
    body: AlertResolve,
    db: Session = Depends(get_db),
    current_user=Depends(RequirePermission("alert:resolve")),
):
    """处理告警（支持填写处理备注）"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "告警不存在")
    alert.is_resolved = True
    alert.resolved_by = current_user.id
    alert.is_read = True
    alert.resolved_at = datetime.utcnow()
    alert.resolution_note = body.note
    db.commit()
    logger.info("告警已处理: alert_id=%s, note=%s", alert_id, body.note)
    return {"ok": True}


@router.post("/batch/resolve", summary="批量处理告警")
def batch_resolve(
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(RequirePermission("alert:resolve")),
):
    """批量处理多条告警"""
    alert_ids = body.get("alert_ids", [])
    note = body.get("note", "")
    if not alert_ids:
        raise HTTPException(400, "alert_ids 不能为空")

    alerts = db.query(Alert).filter(
        Alert.id.in_(alert_ids),
        Alert.is_resolved == False,
    ).all()
    count = 0
    for a in alerts:
        a.is_resolved = True
        a.resolved_by = current_user.id
        a.is_read = True
        a.resolved_at = datetime.utcnow()
        a.resolution_note = note
        count += 1
    db.commit()
    logger.info("批量处理告警: count=%d, note=%s", count, note)
    return {"ok": True, "resolved": count}


@router.post("/batch/read", summary="批量标记已读")
def batch_mark_read(
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:resolve")),
):
    """批量将告警标记为已读"""
    alert_ids = body.get("alert_ids", [])
    if not alert_ids:
        raise HTTPException(400, "alert_ids 不能为空")
    count = db.query(Alert).filter(
        Alert.id.in_(alert_ids),
        Alert.is_read == False,
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"ok": True, "marked": count}


@router.post("/escalation/check", summary="告警升级检查")
def run_escalation_check(
    db: Session = Depends(get_db),
    _=Depends(RequirePermission("alert:resolve")),
):
    """手动触发告警升级检查（也用于定时任务调用）"""
    from services.notification_service import check_alert_escalation
    count = check_alert_escalation(db)
    return {"ok": True, "escalated": count}
