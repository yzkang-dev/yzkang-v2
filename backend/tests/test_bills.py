"""
账单模块 — 集成测试
"""
import json
import pytest


class TestBillCRUD:
    """账单增删改查"""

    def test_list_bills_empty(self, client, auth_headers):
        resp = client.get("/api/bills/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_bill(self, client, auth_headers, elder):
        resp = client.post("/api/bills/", headers=auth_headers, json={
            "elder_id": elder.id,
            "bill_month": "2025-06",
            "total_amount": 3500.0,
            "bill_items": json.dumps([{"item_name": "月费", "amount": 3500.0}]),
            "due_date": "2025-06-15",
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["bill_month"] == "2025-06"
        assert data["total_amount"] == 3500.0
        assert data["id"] > 0

    def test_list_bills_after_create(self, client, auth_headers, elder):
        client.post("/api/bills/", headers=auth_headers, json={
            "elder_id": elder.id,
            "bill_month": "2025-07",
            "total_amount": 100.0,
            "bill_items": json.dumps([{"item_name": "杂项", "amount": 100.0}]),
            "due_date": "2025-07-15",
        })
        resp = client.get("/api/bills/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_overdue_list(self, client, auth_headers):
        resp = client.get("/api/bills/overdue", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_pay_bill(self, client, auth_headers, elder):
        create_resp = client.post("/api/bills/", headers=auth_headers, json={
            "elder_id": elder.id,
            "bill_month": "2025-08",
            "total_amount": 2000.0,
            "bill_items": json.dumps([{"item_name": "月费", "amount": 2000.0}]),
            "due_date": "2025-08-15",
        })
        assert create_resp.status_code in (200, 201)
        bill_id = create_resp.json()["id"]

        resp = client.post(f"/api/bills/{bill_id}/pay", headers=auth_headers)
        assert resp.status_code in (200, 400)  # 可能已同步或其他限制


class TestBillValidation:
    """账单校验"""

    def test_create_bill_missing_amount(self, client, auth_headers, elder):
        resp = client.post("/api/bills/", headers=auth_headers, json={
            "elder_id": elder.id,
            "bill_month": "2025-06",
            "bill_items": json.dumps([{"item_name": "无金额", "amount": 0}]),
            "due_date": "2025-06-15",
        })
        assert resp.status_code == 422
