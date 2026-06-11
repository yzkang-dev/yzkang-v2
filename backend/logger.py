"""
颐智康养 - 结构化日志系统 (loguru v0.7)

输出格式（serialize=True）：{"text": "消息", "record": {详细字段}}
- 全部主流日志收集器（ELK / Loki / Splunk / CloudWatch）原生支持
- 按天轮转 + GZIP 压缩，错误日志单独保留90天
- 审计日志：loguru 文件 + 数据库双写
- 拦截 uvicorn/fastapi 日志统一输出
"""
import sys
import os
import json
import logging
from pathlib import Path
from loguru import logger

from config import APP_NAME, APP_VERSION

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_SERIALIZE = os.getenv("LOG_SERIALIZE", "true").lower() in ("1", "true", "yes")


def _stderr_sink(message):
    """stderr 输出回调（serialize=True 时会传 Message 对象）"""
    sys.stderr.write(str(message))


def _no_color(message):
    """去除彩色 ANSI 转义（日志文件不需要颜色）"""
    return message


def setup_logger():
    logger.remove()

    # ===== 控制台（开发：彩色可读）=====
    logger.add(
        sys.stderr,
        format=(
            "<green>{time:HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{extra[name]}</cyan>:<cyan>{function}</cyan> | "
            "<level>{message}</level>"
        ),
        level=LOG_LEVEL,
        colorize=True,
        backtrace=True,
        diagnose=True,
    )

    # ===== 文件日志（JSON serialize=True）=====
    logger.add(
        str(LOG_DIR / "app_{time:YYYY-MM-DD}.json.gz"),
        serialize=True,
        level=LOG_LEVEL,
        rotation="00:00",
        retention="30 days",
        compression="gz",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=False,
    )

    # ===== 错误日志单独文件（ERROR+）=====
    logger.add(
        str(LOG_DIR / "error_{time:YYYY-MM-DD}.json.gz"),
        serialize=True,
        level="ERROR",
        rotation="00:00",
        retention="90 days",
        compression="gz",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=True,
    )

    # ===== 拦截 uvicorn / fastapi 日志 =====
    class _UvicornHandler(logging.Handler):
        def emit(self, record):
            try:
                lvl = logger.level(record.levelname).name
            except ValueError:
                lvl = record.levelno
            logger.opt(depth=6, exception=record.exc_info).log(lvl, record.getMessage())

    logging.basicConfig(handlers=[_UvicornHandler()], level=0, force=True)
    for name in list(logging.root.manager.loggerDict):
        if name.startswith("uvicorn"):
            lg = logging.getLogger(name)
            lg.handlers = [_UvicornHandler()]
            lg.propagate = False

    logger.bind(name="logger").info(
        "日志系统初始化完成 level={lv} serialize={s}", lv=LOG_LEVEL, s=LOG_SERIALIZE
    )


# ==================== 审计日志 ====================

def audit_log(user: str, action: str, target: str = "", detail: dict = None):
    """审计日志：loguru 文件 + 数据库双写"""
    logger.bind(name="audit", audit_user=user, audit_action=action, audit_target=target).info(
        "[AUDIT] user={u} action={a} target={t}", u=user, a=action, t=target,
    )
    try:
        from models import AuditLog as ALog, SessionLocal
        db = SessionLocal()
        try:
            db.add(ALog(
                username=user, action=action, target=target,
                detail=json.dumps(detail, ensure_ascii=False) if detail else None,
            ))
            db.commit()
        finally:
            db.close()
    except Exception:
        pass


def get_logger(name: str = "yzkang"):
    return logger.bind(name=name)


setup_logger()
