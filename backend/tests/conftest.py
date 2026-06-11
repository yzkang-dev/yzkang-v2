"""
集成测试共享 Fixtures — SQLite 内存数据库 + 鉴权客户端
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from models import Base, User, Elder
from routers.auth_router import hash_password

# 抑制 loguru 在测试中的错误
os.environ["LOGURU_LEVEL"] = "ERROR"

TEST_DB_URL = "sqlite:///file:testdb?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    yield eng


@pytest.fixture
def db_session(engine):
    """每个测试独立的事务级 session"""
    connection = engine.connect()
    trans = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    if trans.is_active:
        trans.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    """FastAPI TestClient，注入测试数据库，禁用限流"""
    from main import app
    from models import get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # 在测试环境中禁用速率限制
    import middleware.rate_limit as rl
    rl.limiter.max_requests = 10_000_000

    # 确保 startup checks 存在
    import time
    app.state.startup_checks = {
        "database": True,
        "encryption": True,
        "rate_limit": True,
    }
    app.state.startup_time = time.time()

    return TestClient(app)


# ==================== 测试数据 ====================

@pytest.fixture
def admin_user(db_session) -> User:
    user = User(
        username="admin",
        password_hash=hash_password("Admin@123"),
        real_name="系统管理员",
        role="admin",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def nurse_user(db_session) -> User:
    user = User(
        username="nurse1",
        password_hash=hash_password("Nurse@123"),
        real_name="护士小李",
        role="nurse",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(admin_user, client):
    """管理员认证头"""
    resp = client.post("/api/auth/login", json={
        "username": "admin", "password": "Admin@123"
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def nurse_headers(nurse_user, client):
    """护士认证头"""
    resp = client.post("/api/auth/login", json={
        "username": "nurse1", "password": "Nurse@123"
    })
    assert resp.status_code == 200, f"Nurse login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def elder(db_session):
    """创建测试老人"""
    e = Elder(
        name="张爷爷",
        gender="male",
        birth_date=date(1940, 5, 10),
        care_level="level_1",
        monthly_fee=3500.0,
        check_in_date=date(2025, 1, 1),
    )
    db_session.add(e)
    db_session.commit()
    db_session.refresh(e)
    return e
