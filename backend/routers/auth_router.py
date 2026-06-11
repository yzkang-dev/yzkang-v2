"""
颐智康养 - 用户认证 API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models import get_db, User
from schemas import UserCreate, UserLogin, TokenOut, RefreshTokenRequest
from auth import hash_password, verify_password, create_access_token, create_refresh_token, verify_refresh_token, get_current_user, validate_password
from logger import get_logger, audit_log

logger = get_logger("yzkay.auth")

router = APIRouter(prefix="/api/auth", tags=["用户认证"])


@router.post("/register", status_code=201, summary="用户注册")
def register(data: UserCreate, db: Session = Depends(get_db)):
    """注册用户（仅调试用，生产环境应关闭）"""
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    validate_password(data.password)

    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        real_name=data.real_name,
        phone=data.phone,
        role=data.role,
    )
    db.add(user)
    db.commit()
    audit_log(logger, data.username, "用户注册", f"user:{user.id}", {"role": data.role})
    return {"message": "注册成功", "username": data.username}


@router.post("/login", response_model=TokenOut, summary="用户登录")
def login(data: UserLogin, db: Session = Depends(get_db)):
    """用户登录，返回 token + 用户基本信息 + 权限列表"""
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        logger.warning("登录失败: 用户名=%s", data.username)
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        logger.warning("登录被拒: 用户=%s 已禁用", data.username)
        raise HTTPException(status_code=403, detail="账号已被禁用")

    token = create_access_token({"sub": user.username})
    refresh = create_refresh_token({"sub": user.username})
    audit_log(logger, user.username, "用户登录", f"user:{user.id}")
    return TokenOut(
        access_token=token,
        refresh_token=refresh,
        username=user.username,
        real_name=user.real_name,
        role=user.role,
        role_id=user.role_id,
        permissions=user.permission_codes,
    )


@router.get("/me", summary="当前用户信息")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息（含权限）"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "real_name": current_user.real_name,
        "phone": current_user.phone,
        "role": current_user.role,
        "role_id": current_user.role_id,
        "role_name": current_user.role_obj.name if current_user.role_obj else None,
        "is_active": current_user.is_active,
        "permissions": current_user.permission_codes,
    }


@router.get("/nurses", summary="护理员列表")
def list_nurses(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取护理员列表（供交接班等模块选择）"""
    nurses = db.query(User).filter(User.is_active == True).all()
    return [
        {"id": u.id, "real_name": u.real_name, "role": u.role, "phone": u.phone}
        for u in nurses
    ]


@router.post("/refresh", summary="刷新令牌")
def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """用 refresh_token 换新的 access_token + refresh_token（滚动刷新）"""
    user = verify_refresh_token(data.refresh_token, db)
    new_access = create_access_token({"sub": user.username})
    new_refresh = create_refresh_token({"sub": user.username})
    logger.info("令牌刷新: 用户=%s", user.username)
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }
