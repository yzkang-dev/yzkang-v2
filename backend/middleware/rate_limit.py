"""
颐智康养 - API 限流中间件
基于滑动窗口的内存限流（单机版，生产环境建议 Redis）
"""
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse


class RateLimiter:
    """滑动窗口限流器"""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        """
        max_requests: 时间窗口内最大请求数
        window_seconds: 时间窗口（秒）
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clients: dict[str, list[float]] = defaultdict(list)
        self._cleanup_at = time.time() + 3600  # 每小时清理过期数据

    def is_allowed(self, key: str) -> tuple[bool, int, int]:
        """
        检查是否允许请求
        返回: (是否允许, 剩余次数, 重置秒数)
        """
        now = time.time()

        # 定期清理过期记录（防止内存泄漏）
        if now > self._cleanup_at:
            self._cleanup(now)
            self._cleanup_at = now + 3600

        # 清理窗口外的旧记录
        window_start = now - self.window_seconds
        timestamps = self._clients[key]
        while timestamps and timestamps[0] < window_start:
            timestamps.pop(0)

        # 判断是否超限
        count = len(timestamps)
        if count >= self.max_requests:
            oldest = timestamps[0] if timestamps else now
            reset_in = int(self.window_seconds - (now - oldest))
            return False, 0, max(reset_in, 1)

        # 记录本次请求
        timestamps.append(now)
        remaining = self.max_requests - len(timestamps)
        return True, remaining, self.window_seconds

    def _cleanup(self, now: float):
        """清理超过2个窗口无活动的客户端"""
        cutoff = now - self.window_seconds * 2
        stale = [k for k, ts in self._clients.items() if not ts or ts[-1] < cutoff]
        for k in stale:
            del self._clients[k]


# 全局限流器实例
limiter = RateLimiter(max_requests=60, window_seconds=60)

# 不需要限流的路径
RATE_LIMIT_EXEMPT = {"/api/health", "/api/auth/refresh"}


async def rate_limit_middleware(request: Request, call_next):
    """FastAPI 限流中间件"""
    path = request.url.path

    # 白名单路径跳过
    if path in RATE_LIMIT_EXEMPT:
        return await call_next(request)

    # 获取客户端标识（优先用 X-Forwarded-For，否则用客户端 IP）
    client_ip = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.client.host
        if request.client
        else "unknown"
    )

    allowed, remaining, reset_in = limiter.is_allowed(client_ip)

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "detail": f"请求过于频繁，请 {reset_in} 秒后重试",
                "retry_after": reset_in,
            },
            headers={
                "Retry-After": str(reset_in),
                "X-RateLimit-Limit": str(limiter.max_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time() + reset_in)),
            },
        )

    response = await call_next(request)

    # 正常响应也加上限流头（方便调试）
    response.headers["X-RateLimit-Limit"] = str(limiter.max_requests)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    return response
