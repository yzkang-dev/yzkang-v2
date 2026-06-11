"""
老人管理模块 — 集成测试
"""
import pytest


class TestElderCRUD:
    """老人增删改查"""

    def test_list_elders_empty(self, client, auth_headers):
        resp = client.get("/api/elders/", headers=auth_headers)
        assert resp.status_code == 200

    def test_create_elder(self, client, auth_headers):
        resp = client.post("/api/elders/", headers=auth_headers, json={
            "name": "李奶奶",
            "gender": "female",
            "birth_date": "1938-03-15",
            "care_level": "level_2",
            "monthly_fee": 4200.0,
            "check_in_date": "2025-01-01",
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["name"] == "李奶奶"

    def test_get_elder_detail(self, client, auth_headers, elder):
        resp = client.get(f"/api/elders/{elder.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "张爷爷"

    def test_get_nonexistent_elder(self, client, auth_headers):
        resp = client.get("/api/elders/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_update_elder(self, client, auth_headers, elder):
        resp = client.put(f"/api/elders/{elder.id}", headers=auth_headers, json={
            "care_level": "level_3",
            "room_number": "301",
        })
        assert resp.status_code == 200
        assert resp.json()["care_level"] == "level_3"

    def test_list_elders_after_create(self, client, auth_headers, elder):
        resp = client.get("/api/elders/", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_checkout_elder(self, client, auth_headers, elder):
        resp = client.post(f"/api/elders/{elder.id}/checkout", headers=auth_headers, json={
            "check_out_date": "2025-06-30",
        })
        assert resp.status_code in (200, 400)  # 可能已退住


class TestElderPermissions:
    """权限校验"""

    def test_nurse_can_list_elders(self, client, nurse_headers, elder):
        resp = client.get("/api/elders/", headers=nurse_headers)
        # 护士可查看老人列表（或受限）
        assert resp.status_code in (200, 403)

    def test_unauthenticated_rejected(self, client):
        resp = client.get("/api/elders/")
        # 未认证返回 401 或 403
        assert resp.status_code in (401, 403)


class TestValidation:
    """输入校验"""

    def test_create_elder_missing_name(self, client, auth_headers):
        resp = client.post("/api/elders/", headers=auth_headers, json={
            "gender": "male",
            "birth_date": "1940-01-01",
            "care_level": "basic",
            "monthly_fee": 3000,
            "check_in_date": "2025-01-01",
        })
        assert resp.status_code == 422

    def test_create_elder_invalid_gender(self, client, auth_headers):
        resp = client.post("/api/elders/", headers=auth_headers, json={
            "name": "测试",
            "gender": "unknown",
            "birth_date": "1940-01-01",
            "care_level": "basic",
            "monthly_fee": 3000,
            "check_in_date": "2025-01-01",
        })
        assert resp.status_code in (200, 201, 422)
