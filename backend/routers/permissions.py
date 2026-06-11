"""
颐智康养 - 权限与角色管理接口
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import get_db, Permission, Role
from routers.auth_router import get_current_user
from schemas import PermissionOut, RoleOut, RoleCreate

router = APIRouter(prefix="/api/admin", tags=["权限管理"])


@router.get("/permissions", response_model=list[PermissionOut], summary="获取所有权限列表")
def list_permissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """返回系统中所有可用权限点"""
    if current_user.role != "super_admin":
        raise HTTPException(403, "仅超级管理员可操作")
    return db.query(Permission).all()


@router.get("/roles", response_model=list[RoleOut], summary="获取角色列表")
def list_roles(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """返回所有角色及其权限"""
    return db.query(Role).all()


@router.post("/roles", response_model=RoleOut, summary="创建角色")
def create_role(
    data: RoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """创建新角色并指定权限列表"""
    if current_user.role != "super_admin":
        raise HTTPException(403, "仅超级管理员可操作")
    role = Role(name=data.name, code=data.code, description=data.description)
    db.add(role)
    db.flush()

    if data.permission_ids:
        perms = db.query(Permission).filter(Permission.id.in_(data.permission_ids)).all()
        role.permissions = perms

    db.commit()
    db.refresh(role)
    return role


@router.put("/roles/{role_id}", response_model=RoleOut, summary="更新角色")
def update_role(
    role_id: int,
    data: RoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """修改角色名称和权限"""
    if current_user.role != "super_admin":
        raise HTTPException(403, "仅超级管理员可操作")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "角色不存在")

    role.name = data.name
    if data.permission_ids is not None:
        perms = db.query(Permission).filter(Permission.id.in_(data.permission_ids)).all()
        role.permissions = perms

    db.commit()
    db.refresh(role)
    return role


@router.delete("/roles/{role_id}", summary="删除角色")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """删除指定角色（系统角色不可删）"""
    if current_user.role != "super_admin":
        raise HTTPException(403, "仅超级管理员可操作")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "角色不存在")
    if role.is_system:
        raise HTTPException(400, "系统角色不可删除")

    db.delete(role)
    db.commit()
    return {"ok": True}


@router.post("/roles/{role_id}/permissions", summary="批量为角色分配权限")
def assign_permissions(
    role_id: int,
    data: RoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """为指定角色设置权限点集合"""
    if current_user.role != "super_admin":
        raise HTTPException(403, "仅超级管理员可操作")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "角色不存在")

    perms = db.query(Permission).filter(Permission.id.in_(data.permission_ids)).all()
    role.permissions = perms
    db.commit()
    return {"ok": True}
