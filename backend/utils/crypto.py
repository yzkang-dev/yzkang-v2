"""
敏感数据加密模块

使用 AES-256-GCM 对敏感字段（身份证号、电话号码、紧急联系人等）进行透明加解密。

特性：
- 读时自动解密，写时自动加密（通过 SQLAlchemy TypeDecorator）
- 兼容已有明文数据：解密失败时返回原文（惰性迁移）
- ENCRYPTION_KEY 通过环境变量注入，未设置则生成临时密钥（仅开发环境）
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.types import TypeDecorator, String


def _get_key() -> bytes:
    """获取 AES-256 密钥（32 字节）。

    优先级：环境变量 ENCRYPTION_KEY（Base64） > 自动生成并缓存在文件
    """
    env_key = os.getenv("ENCRYPTION_KEY", "")
    if env_key:
        return base64.urlsafe_b64decode(env_key)

    # 开发环境：从固定种子生成（生产环境务必设置环境变量！）
    import hashlib
    from config import SECRET_KEY

    seed = f"yzkang-encryption-{SECRET_KEY}"
    return hashlib.sha256(seed.encode()).digest()


KEY = _get_key()
aesgcm = AESGCM(KEY)

# 标记前缀，用于区分加密数据与明文数据
_MAGIC_PREFIX = b"$AES$"


def encrypt(plaintext: str) -> str:
    """加密字符串，返回 Base64 编码的密文（带前缀标记）。

    如果值为空或 None，直接返回原值。
    """
    if not plaintext:
        return plaintext
    nonce = os.urandom(12)  # GCM 推荐 12 字节 nonce
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.urlsafe_b64encode(_MAGIC_PREFIX + nonce + ciphertext).decode("ascii")


def decrypt(ciphertext: str | None) -> str | None:
    """解密字符串。如果值不带加密前缀，视为明文直接返回（兼容旧数据）。

    如果值为空或 None，直接返回原值。
    """
    if not ciphertext:
        return ciphertext

    try:
        raw = base64.urlsafe_b64decode(ciphertext)
        if not raw.startswith(_MAGIC_PREFIX):
            # 旧数据：明文，直接返回
            return ciphertext
        nonce = raw[len(_MAGIC_PREFIX):len(_MAGIC_PREFIX) + 12]
        encrypted = raw[len(_MAGIC_PREFIX) + 12:]
        return aesgcm.decrypt(nonce, encrypted, None).decode("utf-8")
    except Exception:
        # 解密失败（密钥不一致、数据损坏、或明文数据）→ 返回原文
        return ciphertext


class EncryptedString(TypeDecorator):
    """SQLAlchemy 自定义列类型：自动加密/解密。

    用法：
        id_card = Column(EncryptedString(18), unique=True)

    等价于 String(18)，但存储的是加密后的 Base64，因此数据库列会自动扩展长度。
    """

    impl = String
    cache_ok = True

    def __init__(self, length=None, **kwargs):
        # 加密后 Base64 会膨胀约 1.5 倍 + 前缀约 10 字节，扩展长度
        if length:
            expanded = int(length * 2 + 50)
        else:
            expanded = 512
        super().__init__(expanded, **kwargs)

    def process_bind_param(self, value, dialect):
        """写入数据库前：加密"""
        if value is None:
            return None
        return encrypt(str(value))

    def process_result_value(self, value, dialect):
        """从数据库读出后：解密"""
        if value is None:
            return None
        return decrypt(value)
