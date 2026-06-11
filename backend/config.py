"""
颐智康养 - 全局配置
支持 SQLite（开发）和 PostgreSQL（生产）双模式
"""
import os

# ==================== 数据库配置 ====================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 优先级：DATABASE_URL 环境变量 > DB_* 环境变量 > SQLite 文件（开发默认）
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # 尝试从 DB_* 环境变量构建 PostgreSQL 连接串
    db_host = os.getenv("DB_HOST")
    if db_host:
        db_port = os.getenv("DB_PORT", "5432")
        db_user = os.getenv("DB_USER", "yzkang")
        db_pass = os.getenv("DB_PASSWORD", "")
        db_name = os.getenv("DB_NAME", "yzkang_v2")
        if db_pass:
            DATABASE_URL = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
        else:
            DATABASE_URL = f"postgresql://{db_user}@{db_host}:{db_port}/{db_name}"
    else:
        # 开发默认：SQLite 文件数据库
        DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'yzkang_v2.db').replace(os.sep, '/')}"

# 判断当前数据库类型
DB_ENGINE = "postgresql" if "postgresql" in DATABASE_URL else "sqlite"

# ==================== 数据库连接池配置 ====================

DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))  # 1小时回收

# ==================== 安全配置 ====================

SECRET_KEY = os.getenv("SECRET_KEY", "yzkang-dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30                     # 短期凭证 30分钟
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 长期凭证 7天

# ==================== 数据加密配置 ====================

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")  # 未设置则从 SECRET_KEY 派生（utils/crypto.py）

# ==================== 应用元信息 ====================

APP_NAME = "颐智康养"
APP_VERSION = "0.3.0-pg"

# ==================== 限流配置 ====================

RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
