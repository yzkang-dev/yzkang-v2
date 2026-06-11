"""
API 限流模块单元测试
"""
import time
import pytest
from middleware.rate_limit import RateLimiter


class TestRateLimiter:
    """测试滑动窗口限流器"""

    def test_allow_first_request(self):
        limiter = RateLimiter(max_requests=10, window_seconds=60)
        allowed, remaining, reset = limiter.is_allowed("192.168.1.1")
        assert allowed is True
        assert remaining == 9
        assert reset > 0

    def test_count_down_remaining(self):
        limiter = RateLimiter(max_requests=5, window_seconds=60)
        key = "10.0.0.5"
        for i in range(4):
            allowed, remaining, _ = limiter.is_allowed(key)
            assert allowed is True
            assert remaining == 4 - i  # 每请求一次减1
        # 第5次
        allowed, remaining, _ = limiter.is_allowed(key)
        assert allowed is True
        assert remaining == 0

    def test_block_when_exceeded(self):
        limiter = RateLimiter(max_requests=3, window_seconds=60)
        key = "10.0.0.9"
        # 消耗3次
        for _ in range(3):
            allowed, _, _ = limiter.is_allowed(key)
            assert allowed is True
        # 第4次被拒绝
        allowed, remaining, _ = limiter.is_allowed(key)
        assert allowed is False
        assert remaining == 0

    def test_different_keys_independent(self):
        limiter = RateLimiter(max_requests=2, window_seconds=60)
        # IP A 用光额度
        for _ in range(2):
            limiter.is_allowed("ip_a")
        assert limiter.is_allowed("ip_a")[0] is False
        # IP B 不受影响
        assert limiter.is_allowed("ip_b")[0] is True

    def test_window_reset(self):
        """旧时间戳被清理后恢复额度"""
        limiter = RateLimiter(max_requests=3, window_seconds=1)

        # 手动注入一个过期的时间戳
        limiter._clients["test_ip"] = [time.time() - 5]  # 5秒前，已过期

        allowed, remaining, _ = limiter.is_allowed("test_ip")
        assert allowed is True
        # 过期时间戳被清理，剩余 = max - 1(当前) = 2
        assert remaining == 2
        # 清理后旧时间戳不应存在
        assert len(limiter._clients["test_ip"]) == 1

    def test_cleanup_removes_stale_clients(self):
        """定期清理会删除过期客户端记录"""
        limiter = RateLimiter(max_requests=5, window_seconds=60)
        # 注入3个客户端，时间戳都是2小时前（均已过期）
        limiter._clients["old_ip1"] = [time.time() - 7200]
        limiter._clients["old_ip2"] = [time.time() - 7200]
        limiter._clients["current_ip"] = [time.time()]  # 当前活跃

        # 强制触发清理
        limiter._cleanup_at = time.time() - 1  # 让清理条件成立

        limiter.is_allowed("trigger_ip")  # 这会触发清理

        # 过期客户端应被删除
        assert "old_ip1" not in limiter._clients
        assert "old_ip2" not in limiter._clients
        assert "current_ip" in limiter._clients

    def test_reset_seconds_positive(self):
        """重置时间应为正值"""
        limiter = RateLimiter(max_requests=10, window_seconds=30)
        _, _, reset = limiter.is_allowed("test")
        assert reset > 0
        assert reset <= 30
