"""
Alembic 迁移环境配置

支持：
- SQLite（开发）/ PostgreSQL（生产）双引擎自动切换
- 自定义类型（EncryptedString 等）正确渲染
- autogenerate 自动检测模型变更
"""
import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, create_engine
from alembic import context

# ===== 把项目根目录加入 sys.path，使导入 models 可用 =====
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ===== 导入配置和模型（必须在 path 设置之后）=====
from config import DATABASE_URL, DB_ENGINE
from models import Base

# Alembic Config 对象
config = context.config

# ===== 用 config.py 的 DATABASE_URL 覆盖 ini 里的（支持双引擎）=====
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Python logging 配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ===== 目标 metadata（用于 autogenerate）=====
target_metadata = Base.metadata

# ===== 自定义类型渲染（让 alembic 能正确生成迁移脚本）=====
def _render_item(type_, obj, autogen_context):
    """处理自定义类型，避免 alembic 报 'nothing renders'"""
    if type_ == "type" and hasattr(obj, "impl"):
        # EncryptedString 等自定义 TypeDecorator，渲染为 sa.TypeDecorator
        autogen_context.imports.add("from sqlalchemy import TypeDecorator")
        return f"{obj.__class__.__module__}.{obj.__class__.__name__}(length={getattr(obj, 'length', 255)})"
    return False

# ===== Online 迁移（连接真实数据库）=====

def run_migrations_online() -> None:
    """连接数据库执行迁移"""
    connectable = create_engine(
        DATABASE_URL,
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_item=_render_item,
            # SQLite 兼容：允许批处理迁移（ALTER 不支持时自动重建表）
            render_as_batch=(DB_ENGINE == "sqlite"),
        )

        with context.begin_transaction():
            context.run_migrations()


# ===== Offline 迁移（只生成 SQL，不连接数据库）=====

def run_migrations_offline() -> None:
    """生成离线 SQL 脚本"""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_item=_render_item,
        render_as_batch=(DB_ENGINE == "sqlite"),
    )

    with context.begin_transaction():
        context.run_migrations()


# ===== 入口 =====

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
