"""
认证模块单元测试：密码哈希、密码强度校验、JWT 令牌
"""
import pytest
from auth import hash_password, verify_password, validate_password, create_access_token, create_refresh_token
from jose import jwt
from config import SECRET_KEY, ALGORITHM
from fastapi import HTTPException


class TestPasswordHashing:
    """测试密码哈希"""

    def test_hash_and_verify(self):
        plain = "Test@123456"
        hashed = hash_password(plain)
        assert hashed != plain  # 哈希值不等于原文
        assert verify_password(plain, hashed)
        assert not verify_password("WrongPassword@1", hashed)
        assert not verify_password("", hashed)

    def test_hash_is_deterministic_for_verify(self):
        """同一密码哈希后应能验证（每次哈希结果不同但都能验证）"""
        pw = "Secure@999Pass"
        h1 = hash_password(pw)
        h2 = hash_password(pw)
        assert h1 != h2  # bcrypt 每次生成不同的盐值
        assert verify_password(pw, h1)
        assert verify_password(pw, h2)


class TestPasswordValidation:
    """测试密码强度校验"""

    def test_valid_password(self):
        """合法密码应该通过"""
        validate_password("Abc@12345")  # 不抛异常 = 通过

    def test_too_short(self):
        with pytest.raises(HTTPException) as exc:
            validate_password("Ab@1")
        assert "8位" in exc.value.detail

    def test_no_uppercase(self):
        with pytest.raises(HTTPException) as exc:
            validate_password("abc@12345")
        assert "大写" in exc.value.detail

    def test_no_lowercase(self):
        with pytest.raises(HTTPException) as exc:
            validate_password("ABC@12345")
        assert "小写" in exc.value.detail

    def test_no_digit(self):
        with pytest.raises(HTTPException) as exc:
            validate_password("Abc@defgh")
        assert "数字" in exc.value.detail

    def test_no_special_char(self):
        with pytest.raises(HTTPException) as exc:
            validate_password("Abc123456")
        assert "特殊" in exc.value.detail

    def test_empty_password(self):
        with pytest.raises(HTTPException) as exc:
            validate_password("")
        assert "不能为空" in exc.value.detail


class TestJWT:
    """测试 JWT 令牌"""

    def test_create_access_token(self):
        data = {"sub": "admin", "role": "admin"}
        token = create_access_token(data)
        assert isinstance(token, str)
        # 解码验证
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "admin"
        assert payload["role"] == "admin"
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_create_refresh_token(self):
        data = {"sub": "admin"}
        token = create_refresh_token(data)
        assert isinstance(token, str)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "admin"
        assert payload["type"] == "refresh"
        assert "exp" in payload

    def test_access_vs_refresh_different(self):
        """access token 和 refresh token 不应相同"""
        data = {"sub": "user1"}
        at = create_access_token(data)
        rt = create_refresh_token(data)
        assert at != rt

    def test_refresh_token_rejected_as_access(self):
        """refresh token 不应有 access 类型的声明"""
        data = {"sub": "user1"}
        rt = create_refresh_token(data)
        payload = jwt.decode(rt, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["type"] == "refresh"
