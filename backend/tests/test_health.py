"""
健康检查与自监控 — 单元测试
"""
import time
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """创建测试客户端，预置启动检查状态"""
    app.state.startup_checks = {
        "database": True,
        "encryption": True,
        "rate_limit": True,
    }
    app.state.startup_time = time.time()
    return TestClient(app)


class TestBasicHealth:
    """基础健康检查"""

    def test_health_returns_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "app" in data
        assert "version" in data

    def test_health_is_whitelisted_from_rate_limit(self, client):
        """健康检查接口不应被限流"""
        # 连续请求多次，不应返回 429
        for _ in range(10):
            resp = client.get("/api/health")
            assert resp.status_code == 200


class TestDetailedHealth:
    """详细健康检查"""

    def test_detailed_returns_healthy(self, client):
        resp = client.get("/api/health/detailed")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("healthy", "degraded")
        assert "uptime_seconds" in data
        assert "uptime_human" in data
        assert "checks" in data

    def test_detailed_includes_all_checks(self, client):
        resp = client.get("/api/health/detailed")
        data = resp.json()
        checks = data["checks"]
        assert "database" in checks
        assert "database_live" in checks
        assert "encryption" in checks
        assert "rate_limit" in checks

    def test_detailed_includes_system_metrics(self, client):
        resp = client.get("/api/health/detailed")
        data = resp.json()
        checks = data["checks"]
        # 系统指标（psutil 可用时）
        if checks["database_live"]:
            assert "disk_free_mb" in checks
            assert "memory_percent" in checks

    def test_detailed_degraded_when_checks_fail(self, client):
        # 模拟启动检查失败
        app.state.startup_checks = {
            "database": False,
            "encryption": True,
            "rate_limit": True,
        }
        resp = client.get("/api/health/detailed")
        data = resp.json()
        assert data["status"] == "degraded"
