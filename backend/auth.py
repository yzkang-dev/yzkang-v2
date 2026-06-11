"""
颐智康养 - 用户认证 & 权限依赖
"""
import re
from functools import lru_cache
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from models import get_db, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def validate_password(password: str):
    """密码强度校验：至少8位 + 大写 + 小写 + 数字 + 特殊字符"""
    if not password:
        raise HTTPException(status_code=400, detail="密码不能为空")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="密码长度至少8位")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="密码必须包含大写字母")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="密码必须包含小写字母")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="密码必须包含数字")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>~`[\]\\/;'=_+-]", password):
        raise HTTPException(status_code=400, detail="密码必须包含特殊字符（如 !@#$%^&*）")


def create_access_token(data: dict) -> str:
    """生成短期访问令牌（30分钟有效）"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """生成长期刷新令牌（7天有效）"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_refresh_token(token: str, db: Session) -> User:
    """验证刷新令牌，返回用户对象"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录已过期，请重新登录",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """从 JWT Token 解析当前登录用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录已过期，请重新登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """要求管理员权限（旧逻辑，兼容）"""
    if current_user.role != "admin" and not current_user.has_permission("system:user"):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user


class RequirePermission:
    """
    权限依赖注入器：
        Depends(RequirePermission("elder:view"))
    """
    def __init__(self, code: str):
        self.code = code

    def __call__(
        self,
        user: User = Depends(get_current_user),
    ) -> User:
        if not user.has_permission(self.code):
            raise HTTPException(status_code=403, detail=f"无权限：{self.code}")
        return user
