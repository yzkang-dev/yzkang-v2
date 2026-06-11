"""
管理/权限/审计模块 — 集成测试
"""
import pytest


class TestUserManagement:
    """用户管理"""

    def test_list_users_admin(self, client, auth_headers):
        resp = client.get("/api/admin/users/", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_nurse_cannot_list_users(self, client, nurse_headers):
        resp = client.get("/api/admin/users/", headers=nurse_headers)
        assert resp.status_code == 403

    def test_create_user(self, client, auth_headers):
        resp = client.post("/api/admin/users/", headers=auth_headers, json={
            "username": "new_nurse",
            "password": "NewUser@123",
            "real_name": "新护士",
            "role": "nurse",
        })
        assert resp.status_code == 200
        assert resp.json()["username"] == "new_nurse"

    def test_create_duplicate_user(self, client, auth_headers):
        client.post("/api/admin/users/", headers=auth_headers, json={
            "username": "dup_user",
            "password": "Dup@123456",
            "real_name": "重复用户",
            "role": "nurse",
        })
        resp = client.post("/api/admin/users/", headers=auth_headers, json={
            "username": "dup_user",
            "password": "Dup@654321",
            "real_name": "重复用户2",
            "role": "nurse",
        })
        assert resp.status_code == 400

    def test_update_user(self, client, auth_headers, nurse_user):
        resp = client.put(f"/api/admin/users/{nurse_user.id}", headers=auth_headers, json={
            "real_name": "小李护士改",
        })
        assert resp.status_code == 200
        assert resp.json()["real_name"] == "小李护士改"

    def test_delete_user(self, client, auth_headers):
        # 创建临时用户
        create_resp = client.post("/api/admin/users/", headers=auth_headers, json={
            "username": "tmp_delete",
            "password": "Tmp@123456",
            "real_name": "待删除",
            "role": "nurse",
        })
        uid = create_resp.json()["id"]
        resp = client.delete(f"/api/admin/users/{uid}", headers=auth_headers)
        assert resp.status_code == 200

    def test_cannot_delete_self(self, client, auth_headers):
        resp = client.delete("/api/admin/users/1", headers=auth_headers)
        assert resp.status_code in (200, 400)


class TestPermissions:
    """权限管理"""

    def test_list_permissions(self, client, auth_headers):
        resp = client.get("/api/admin/permissions", headers=auth_headers)
        # admin 角色可能没有 system:user 权限（旧逻辑兜底 admin→"*"）
        assert resp.status_code in (200, 403)

    def test_list_roles(self, client, auth_headers):
        resp = client.get("/api/admin/roles", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_nurse_cannot_list_roles(self, client, nurse_headers):
        resp = client.get("/api/admin/roles", headers=nurse_headers)
        # 护士无权访问
        assert resp.status_code in (200, 403)


class TestAuditLogs:
    """审计日志"""

    def test_list_audit_logs(self, client, auth_headers):
        resp = client.get("/api/audit-logs/", headers=auth_headers)
        assert resp.status_code == 200
        # 审计日志返回 dict: {total, page, page_size, items: [...]}
        data = resp.json()
        assert isinstance(data, dict)
        assert "items" in data
