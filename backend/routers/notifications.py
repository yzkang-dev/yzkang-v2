"""
颐智康养 - 通知管理 API（含配置/模板/升级规则/日志）
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import get_db, NotificationConfig, NotificationLog, AlertEscalationRule
from routers.auth_router import get_current_user
from schemas import (
    NotificationConfigCreate, NotificationConfigUpdate, NotificationConfigOut,
    NotificationLogOut,
    AlertEscalationRuleCreate, AlertEscalationRuleOut,
)

router = APIRouter(prefix="/api/notifications", tags=["通知管理"])

# ===================== 通知配置 CRUD =====================

@router.get("/configs", response_model=list[NotificationConfigOut], summary="通知配置列表")
def list_configs(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(NotificationConfig).order_by(NotificationConfig.created_at.desc()).all()


@router.get("/configs/{config_id}", response_model=NotificationConfigOut, summary="获取通知配置")
def get_config(config_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(404, "配置不存在")
    return cfg


@router.post("/configs", response_model=NotificationConfigOut, summary="创建通知配置")
def create_config(data: NotificationConfigCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = NotificationConfig(**data.model_dump())
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.put("/configs/{config_id}", response_model=NotificationConfigOut, summary="更新通知配置")
def update_config(
    config_id: int,
    data: NotificationConfigUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(404, "配置不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.delete("/configs/{config_id}", summary="删除通知配置")
def delete_config(config_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(404, "配置不存在")
    db.delete(cfg)
    db.commit()
    return {"detail": "ok"}


# ===================== 通知模板 =====================

_TEMPLATES = {
    "sms": {
        "name": "短信通知",
        "example": '{"templateId":"123456","signName":"颐智康养","params":["老人姓名","告警类型"]}',
    },
    "wechat": {
        "name": "微信通知",
        "example": '{"appid":"wx123456","templateId":"tpl_abc","miniprogram":false}',
    },
    "email": {
        "name": "邮件通知",
        "example": '{"smtp_host":"smtp.example.com","smtp_port":465,"from_addr":"alert@yzkang.com"}',
    },
    "webhook": {
        "name": "Webhook",
        "example": '{"url":"https://example.com/webhook","secret":"your-secret"}',
    },
}


@router.get("/templates", summary="获取通知模板列表")
def list_templates(_=Depends(get_current_user)):
    return _TEMPLATES


# ===================== 升级规则 CRUD =====================

@router.get("/escalation-rules", response_model=list[AlertEscalationRuleOut], summary="升级规则列表")
def list_escalation_rules(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(AlertEscalationRule).all()


@router.get("/escalation-rules/{rule_id}", response_model=AlertEscalationRuleOut, summary="获取升级规则")
def get_escalation_rule(rule_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    rule = db.query(AlertEscalationRule).filter(AlertEscalationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "规则不存在")
    return rule


@router.post("/escalation-rules", response_model=AlertEscalationRuleOut, summary="创建升级规则")
def create_escalation_rule(data: AlertEscalationRuleCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    rule = AlertEscalationRule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/escalation-rules/{rule_id}", response_model=AlertEscalationRuleOut, summary="更新升级规则")
def update_escalation_rule(
    rule_id: int,
    data: AlertEscalationRuleCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    rule = db.query(AlertEscalationRule).filter(AlertEscalationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "规则不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/escalation-rules/{rule_id}", summary="删除升级规则")
def delete_escalation_rule(rule_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    rule = db.query(AlertEscalationRule).filter(AlertEscalationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "规则不存在")
    db.delete(rule)
    db.commit()
    return {"detail": "ok"}


# ===================== 通知日志 =====================

@router.get("/logs", response_model=list[NotificationLogOut], summary="通知发送日志")
def list_logs(limit: int = 30, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(NotificationLog)
        .order_by(NotificationLog.sent_at.desc())
        .limit(limit)
        .all()
    )
