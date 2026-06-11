"""
审批管理路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import Optional

from models import Approval, User, Elder, get_db
from schemas import ApprovalCreate, ApprovalOut, ApprovalHandle
from auth import RequirePermission

router = APIRouter(prefix="/api/approvals", tags=["审批管理"])


def _build_approval_out(a: Approval) -> dict:
    """构建审批输出（依赖 joinedload 预加载的关系）"""
    return {
        "id": a.id, "title": a.title, "type": a.type, "content": a.content,
        "elder_id": a.elder_id, "applicant_id": a.applicant_id,
        "approver_id": a.approver_id, "status": a.status,
        "comment": a.comment, "handled_at": a.handled_at,
        "created_at": a.created_at, "updated_at": a.updated_at,
        "applicant_name": a.applicant.real_name if a.applicant else None,
        "approver_name": a.approver.real_name if a.approver else None,
        "elder_name": a.elder.name if a.elder else None,
    }


@router.get("/", response_model=list[ApprovalOut], summary="审批列表")
def list_approvals(
    status_filter: Optional[str] = None,
    type_filter: Optional[str] = None,
    _: None = Depends(RequirePermission("approval:view")),
    db: Session = Depends(get_db),
):
    """查询所有审批，可按状态和类型筛选"""
    q = db.query(Approval).options(
        joinedload(Approval.applicant),
        joinedload(Approval.approver),
        joinedload(Approval.elder),
    )
    if status_filter:
        q = q.filter(Approval.status == status_filter)
    if type_filter:
        q = q.filter(Approval.type == type_filter)
    approvals = q.order_by(Approval.created_at.desc()).all()
    return [_build_approval_out(a) for a in approvals]


@router.get("/pending", response_model=list[ApprovalOut], summary="我的待审批")
def my_pending(
    current_user: User = Depends(RequirePermission("approval:view")),
    db: Session = Depends(get_db),
):
    """查询当前用户的待审批列表"""
    approvals = db.query(Approval).options(
        joinedload(Approval.applicant),
        joinedload(Approval.approver),
        joinedload(Approval.elder),
    ).filter(
        Approval.approver_id == current_user.id,
        Approval.status == "pending"
    ).order_by(Approval.created_at.desc()).all()
    return [_build_approval_out(a) for a in approvals]


@router.get("/my", response_model=list[ApprovalOut], summary="我的申请")
def my_applications(
    current_user: User = Depends(RequirePermission("approval:view")),
    db: Session = Depends(get_db),
):
    """查询当前用户提交的申请列表"""
    approvals = db.query(Approval).options(
        joinedload(Approval.applicant),
        joinedload(Approval.approver),
        joinedload(Approval.elder),
    ).filter(
        Approval.applicant_id == current_user.id
    ).order_by(Approval.created_at.desc()).all()
    return [_build_approval_out(a) for a in approvals]


@router.get("/{approval_id}", response_model=ApprovalOut, summary="审批详情")
def get_approval(
    approval_id: int,
    _: None = Depends(RequirePermission("approval:view")),
    db: Session = Depends(get_db),
):
    """查看单条审批的详细信息"""
    a = db.query(Approval).options(
        joinedload(Approval.applicant),
        joinedload(Approval.approver),
        joinedload(Approval.elder),
    ).filter(Approval.id == approval_id).first()
    if not a:
        raise HTTPException(404, "审批不存在")
    return _build_approval_out(a)


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ApprovalOut, summary="提交审批")
def create_approval(
    data: ApprovalCreate,
    current_user: User = Depends(RequirePermission("approval:create")),
    db: Session = Depends(get_db),
):
    """创建新的审批申请"""
    approver = db.query(User).filter(User.id == data.approver_id).first()
    if not approver:
        raise HTTPException(400, "审批人不存在")
    a = Approval(
        title=data.title, type=data.type, content=data.content,
        elder_id=data.elder_id, applicant_id=current_user.id,
        approver_id=data.approver_id, status="pending",
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    # 重新查询以加载关系
    a = db.query(Approval).options(
        joinedload(Approval.applicant),
        joinedload(Approval.approver),
        joinedload(Approval.elder),
    ).filter(Approval.id == a.id).first()
    return _build_approval_out(a)


@router.put("/{approval_id}/handle", response_model=ApprovalOut, summary="处理审批")
def handle_approval(
    approval_id: int,
    data: ApprovalHandle,
    current_user: User = Depends(RequirePermission("approval:approve")),
    db: Session = Depends(get_db),
):
    """审批通过或驳回（仅指定审批人可操作）"""
    a = db.query(Approval).options(
        joinedload(Approval.applicant),
        joinedload(Approval.approver),
        joinedload(Approval.elder),
    ).filter(Approval.id == approval_id).first()
    if not a:
        raise HTTPException(404, "审批不存在")
    if a.status != "pending":
        raise HTTPException(400, "该审批已处理")
    if a.approver_id != current_user.id:
        raise HTTPException(403, "您不是该审批的指定审批人")
    if data.action not in ("approve", "reject"):
        raise HTTPException(400, "action 只能为 approve 或 reject")

    a.status = "approved" if data.action == "approve" else "rejected"
    a.comment = data.comment
    a.handled_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    # 重新查询加载关系
    a = db.query(Approval).options(
        joinedload(Approval.applicant),
        joinedload(Approval.approver),
        joinedload(Approval.elder),
    ).filter(Approval.id == a.id).first()
    return _build_approval_out(a)


@router.get("/stats/summary", summary="审批统计")
def approval_stats(
    current_user: User = Depends(RequirePermission("approval:view")),
    db: Session = Depends(get_db),
):
    """获取审批统计数据：待审批/我的待审批/今日已审批数量"""
    pending = db.query(Approval).filter(Approval.status == "pending").count()
    my_pending_count = db.query(Approval).filter(
        Approval.approver_id == current_user.id,
        Approval.status == "pending"
    ).count()
    today_approved = db.query(Approval).filter(
        Approval.status == "approved",
        Approval.handled_at >= datetime.utcnow().date()
    ).count()
    return {"total_pending": pending, "my_pending": my_pending_count, "today_approved": today_approved}
