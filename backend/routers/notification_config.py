"""
颐智康养 - 通知配置接口
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import get_db, NotificationConfig
from routers.auth_router import get_current_user

router = APIRouter(prefix="/api/notification-config", tags=["通知配置"])


@router.get("/", summary="获取通知配置")
def get_notification_config(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """返回通知设置，不存在时返回空配置"""
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(403, "仅管理员可查看通知配置")

    config = db.query(NotificationConfig).first()
    if not config:
        return {"alert_thresholds": {}, "channel": "", "is_active": False}

    return {
        "alert_thresholds": config.config_json or {},
        "channel": config.channel or "",
        "is_active": config.is_active,
    }


@router.put("/", summary="更新通知配置")
def update_notification_config(
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """保存或更新通知策略、告警阈值和渠道"""
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(403, "仅管理员可修改通知配置")

    config = db.query(NotificationConfig).first()
    if not config:
        config = NotificationConfig()
        db.add(config)

    config.config_json = data.get("alert_thresholds", {})
    config.channel = data.get("channel", "")
    config.is_active = data.get("is_active", False)
    db.commit()
    db.refresh(config)
    return {"ok": True, "id": config.id}
