"""
颐智康养 - 用户管理接口（机构管理员）
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import get_db, User
from routers.auth_router import get_current_user, hash_password
from schemas import UserOut, UserCreate, UserUpdate

router = APIRouter(prefix="/api/admin/users", tags=["用户管理"])


@router.get("/", response_model=list[UserOut], summary="获取用户列表")
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """返回所有用户，仅管理员可访问"""
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(403, "无权限")
    return db.query(User).all()


@router.post("/", response_model=UserOut, summary="创建用户")
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """管理员添加新用户账号"""
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(403, "无权限")

    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(400, "用户名已存在")

    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        real_name=data.real_name,
        phone=data.phone,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut, summary="更新用户信息")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """修改用户名、手机号、角色等信息"""
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(403, "无权限")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "用户不存在")

    if data.real_name is not None:
        user.real_name = data.real_name
    if data.phone is not None:
        user.phone = data.phone
    if data.role is not None:
        user.role = data.role
    if data.password:
        user.password_hash = hash_password(data.password)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", summary="删除用户")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """删除指定用户（不能删除自己）"""
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(403, "无权限")
    if user_id == current_user.id:
        raise HTTPException(400, "不能删除自己")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "用户不存在")

    db.delete(user)
    db.commit()
    return {"ok": True}
