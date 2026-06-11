"""
颐智康养 - 审计日志查询 API
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import get_db, AuditLog
from auth import RequirePermission

router = APIRouter(prefix="/api/audit-logs", tags=["审计日志"])


@router.get("/", response_model=dict, summary="查询审计日志")
def list_audit_logs(
    username: Optional[str] = Query(None, description="按操作人筛选"),
    action: Optional[str] = Query(None, description="按操作类型筛选"),
    days: int = Query(7, ge=1, le=90, description="查询最近N天"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=10, le=100, description="每页条数"),
    _: None = Depends(RequirePermission("system:user")),
    db: Session = Depends(get_db),
):
    """查询审计日志（可按人/操作/时间筛选），返回分页结果"""
    since = datetime.utcnow() - timedelta(days=days)

    q = db.query(AuditLog).filter(AuditLog.created_at >= since)
    if username:
        q = q.filter(AuditLog.username.ilike(f"%{username}%"))
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))

    total = q.count()
    logs = (
        q.order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": log.id,
                "username": log.username,
                "action": log.action,
                "target": log.target,
                "detail": log.detail,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
