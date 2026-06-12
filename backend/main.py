"""
颐智康养 - FastAPI 主入口
"""
import time
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from config import APP_NAME, APP_VERSION
from models import init_db, SessionLocal
from logger import get_logger
from middleware.rate_limit import rate_limit_middleware

logger = get_logger("yzkay")

# ==================== 错误追踪 (Sentry) ====================

SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            FastApiIntegration(transaction_style="url"),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        release=APP_VERSION,
    )
    logger.info("Sentry 错误追踪已启用")

# ==================== 应用 ====================

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="养老机构数字化管理平台",
)

# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    logger.info(
        "%s %s → %d (%.3fs)",
        request.method,
        request.url.path,
        response.status_code,
        duration,
    )
    return response

# API 限流中间件（最先执行，避免日志记录被限流的请求）
app.middleware("http")(rate_limit_middleware)

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Prometheus 监控指标 ====================

from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator(
    should_group_status_codes=True,   # 不计入 query params，减少基数
    should_round_latency_decimals=True,
    excluded_handlers=["/metrics", "/api/health", "/api/health/detailed"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# ==================== 全局异常处理 ====================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """统一的HTTP异常处理"""
    logger.warning(
        "HTTP %d: %s %s",
        exc.status_code,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """请求参数校验失败"""
    errors = exc.errors()
    logger.warning("参数校验失败: %s %s | %s", request.method, request.url.path, errors)
    return JSONResponse(
        status_code=422,
        content={
            "detail": "请求参数错误",
            "errors": [{"field": e["loc"][-1] if e["loc"] else "?", "msg": e["msg"]} for e in errors],
        },
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """数据库完整性约束冲突"""
    db.rollback() if hasattr(request.state, "db") else None
    logger.error("数据库约束冲突: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=409,
        content={"detail": "数据冲突，可能已存在重复记录"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """兜底：未知错误，返回500 + 日志"""
    logger.error(
        "未处理异常: %s %s | %s: %s",
        request.method,
        request.url.path,
        type(exc).__name__,
        str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"},
    )

from routers.auth_router import router as auth_router
from routers.elders import router as elders_router
from routers.care_records import router as care_records_router
from routers.bills import router as bills_router
from routers.dashboard import router as dashboard_router
from routers.medications import router as medications_router
from routers.medication_logs import router as medication_logs_router
from routers.shifts import router as shifts_router
from routers.vital_signs import router as vital_signs_router
from routers.alerts import router as alerts_router
from routers.reports import router as reports_router
from routers.permissions import router as permissions_router
from routers.users_admin import router as users_admin_router
from routers.approvals import router as approvals_router
from routers.contracts import router as contracts_router
from routers.notification_config import router as notification_router
from routers.notifications import router as notifications_router
from routers.cameras import router as cameras_router
from routers.audit_logs import router as audit_logs_router

app.include_router(auth_router)
app.include_router(elders_router)
app.include_router(care_records_router)
app.include_router(bills_router)
app.include_router(dashboard_router)
app.include_router(medications_router)
app.include_router(medication_logs_router)
app.include_router(shifts_router)
app.include_router(vital_signs_router)
app.include_router(alerts_router)
app.include_router(reports_router)
app.include_router(permissions_router)
app.include_router(users_admin_router)
app.include_router(approvals_router)
app.include_router(contracts_router)
app.include_router(notification_router)
app.include_router(notifications_router)
app.include_router(cameras_router)
app.include_router(audit_logs_router)


@app.on_event("startup")
def startup():
    """启动时初始化数据库 + 自检"""
    logger.info("正在初始化数据库...")
    init_db()

    # 关键配置自检
    checks = {}
    # 数据库连通性
    db = None
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        checks["database"] = True
        logger.info("数据库连接正常")
    except Exception as e:
        checks["database"] = False
        logger.error("数据库连接失败: %s", e)
    finally:
        if db:
            db.close()

    # 加密模块检查
    try:
        from utils.crypto import KEY
        checks["encryption"] = True
        logger.info("数据加密模块就绪")
    except Exception as e:
        checks["encryption"] = False
        logger.error("加密模块异常: %s", e)

    # 限流模块检查
    try:
        from middleware.rate_limit import rate_limit_middleware
        checks["rate_limit"] = True
        logger.info("API 限流模块就绪")
    except Exception as e:
        checks["rate_limit"] = False
        logger.error("限流模块异常: %s", e)

    app.state.startup_checks = checks
    app.state.startup_time = time.time()
    logger.info("%s v%s 启动完成，自检: %s", APP_NAME, APP_VERSION, checks)


@app.get("/api/health")
def health_check():
    """健康检查 — 基础"""
    return {"status": "ok", "app": APP_NAME, "version": APP_VERSION}


@app.get("/api/health/detailed")
def health_detailed():
    """健康检查 — 详细（含系统指标）"""
    import os
    import psutil

    uptime = time.time() - getattr(app.state, "startup_time", time.time())
    checks = dict(getattr(app.state, "startup_checks", {}))
    process_dir = os.path.dirname(os.path.abspath(__file__))

    # 数据库连接（实时）
    db = None
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        checks["database_live"] = True
    except Exception:
        checks["database_live"] = False
    finally:
        if db:
            db.close()

    # 磁盘空间 (MB)
    try:
        disk = psutil.disk_usage(process_dir)
        checks["disk_free_mb"] = round(disk.free / 1024 / 1024, 1)
        checks["disk_total_mb"] = round(disk.total / 1024 / 1024, 1)
    except Exception:
        checks["disk_free_mb"] = 0

    # 内存 (MB)
    try:
        mem = psutil.virtual_memory()
        checks["memory_used_mb"] = round(mem.used / 1024 / 1024, 1)
        checks["memory_total_mb"] = round(mem.total / 1024 / 1024, 1)
        checks["memory_percent"] = mem.percent
    except Exception:
        checks["memory_percent"] = 0

    overall = all(
        checks.get(k, True) for k in
        ["database", "database_live", "encryption", "rate_limit"]
    )

    return {
        "status": "healthy" if overall else "degraded",
        "app": APP_NAME,
        "version": APP_VERSION,
        "uptime_seconds": round(uptime),
        "uptime_human": (
            f"{int(uptime // 86400)}d {int(uptime % 86400 // 3600)}h "
            f"{int(uptime % 3600 // 60)}m {int(uptime % 60)}s"
        ),
        "checks": checks,
    }


# ==================== 生产模式：托管前端静态文件 ====================
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

_frontend_dist = os.environ.get("FRONTEND_DIST_PATH", "")
if _frontend_dist and os.path.isdir(_frontend_dist):
    # 托管静态资源（js/, css/, assets/ 等），html=True 自动兜底 index.html
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")

    @app.get("/{full_path:path}")
    async def _spa_fallback(full_path: str):
        """SPA 兜底：非 API 路由返回 index.html"""
        index_file = os.path.join(_frontend_dist, "index.html")
        if os.path.exists(index_file):
            with open(index_file, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        return HTMLResponse(content="Not Found", status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
