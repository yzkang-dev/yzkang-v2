"""
颐智康养 - 结构化日志系统

基于 loguru，提供 JSON 格式的结构化日志输出。
生产环境输出到文件（按天轮转），开发环境输出到控制台（彩色）。
通过环境变量 LOG_LEVEL / LOG_FILE / LOG_JSON 控制行为。
"""
import sys
import os
from loguru import logger

from config import APP_NAME, APP_VERSION

# ==================== 配置 ====================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "logs/yzkang_{time:YYYY-MM-DD}.log")
LOG_JSON = os.getenv("LOG_JSON", "true").lower() in ("1", "true", "yes")
LOG_RETENTION = os.getenv("LOG_RETENTION", "30 days")
LOG_ROTATION = os.getenv("LOG_ROTATION", "00:00")  # 每天午夜轮转


def json_formatter(record):
    """JSON 结构化格式 — 生产环境"""
    import json
    log_entry = {
        "timestamp": record["time"].isoformat(),
        "level": record["level"].name,
        "logger": record["name"],
        "module": record["module"],
        "function": record["function"],
        "line": record["line"],
        "message": record["message"],
        "app": APP_NAME,
        "version": APP_VERSION,
    }
    if record["exception"]:
        log_entry["exception"] = str(record["exception"])
    if record["extra"]:
        log_entry["extra"] = record["extra"]
    return json.dumps(log_entry, ensure_ascii=False, default=str) + "\n"


def setup_logger():
    """初始化日志系统，移除默认 handler，添加项目级 handler"""
    logger.remove()  # 清除默认

    # ===== 控制台输出（开发友好） =====
    if LOG_JSON:
        # JSON 格式到 stderr（不影响 stdout 的 uvicorn 输出）
        logger.add(
            sys.stderr,
            format=json_formatter,
            level=LOG_LEVEL,
            colorize=False,
            backtrace=True,
            diagnose=False,
        )
    else:
        # 彩色格式（本地开发）
        logger.add(
            sys.stderr,
            format=(
                "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                "<level>{message}</level>"
            ),
            level=LOG_LEVEL,
            colorize=True,
            backtrace=True,
            diagnose=True,
        )

    # ===== 文件输出（持久化） =====
    logger.add(
        LOG_FILE,
        format=json_formatter,
        level=LOG_LEVEL,
        rotation=LOG_ROTATION,
        retention=LOG_RETENTION,
        compression="gz",           # 归档日志自动压缩
        encoding="utf-8",
        enqueue=True,               # 异步写入，不阻塞主线程
        backtrace=True,
        diagnose=False,
    )

    logger.info(
        "日志系统已初始化",
        level=LOG_LEVEL,
        json_mode=LOG_JSON,
        file=LOG_FILE,
    )

    return logger


__all__ = ["logger", "setup_logger"]
