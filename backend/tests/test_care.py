"""
照护/用药/体征模块 — 集成测试
"""
import pytest


class TestCareRecords:
    """照护记录"""

    def test_list_care_records_empty(self, client, auth_headers):
        resp = client.get("/api/care-records/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_care_record(self, client, auth_headers, elder):
        resp = client.post("/api/care-records/", headers=auth_headers, json={
            "elder_id": elder.id,
            "care_type": "daily_check",
            "description": "测量血压，正常",
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["elder_id"] == elder.id

    def test_today_care_records(self, client, auth_headers):
        resp = client.get("/api/care-records/today", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestMedications:
    """用药管理"""

    def test_list_medications_empty(self, client, auth_headers):
        resp = client.get("/api/medications/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_medication(self, client, auth_headers, elder):
        resp = client.post("/api/medications/", headers=auth_headers, json={
            "elder_id": elder.id,
            "drug_name": "降压药",
            "dosage": "每天一次",
            "frequency": "daily",
            "start_date": "2025-06-01",
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["drug_name"] == "降压药"

    def test_toggle_medication(self, client, auth_headers, elder):
        create_resp = client.post("/api/medications/", headers=auth_headers, json={
            "elder_id": elder.id,
            "drug_name": "维生素",
            "dosage": "每天一次",
            "frequency": "daily",
            "start_date": "2025-06-01",
        })
        assert create_resp.status_code in (200, 201)
        med_id = create_resp.json()["id"]

        resp = client.post(f"/api/medications/{med_id}/toggle", headers=auth_headers)
        assert resp.status_code in (200, 404)


class TestVitalSigns:
    """生命体征"""

    def test_list_vital_signs_empty(self, client, auth_headers, elder):
        resp = client.get(f"/api/vital-signs/elder/{elder.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_vital_sign(self, client, auth_headers, elder):
        resp = client.post("/api/vital-signs/", headers=auth_headers, json={
            "elder_id": elder.id,
            "measurement_type": "routine",
            "temperature": 36.5,
            "heart_rate": 72,
            "blood_pressure_systolic": 120,
            "blood_pressure_diastolic": 80,
            "oxygen_saturation": 98,
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["temperature"] == 36.5

    def test_get_vital_sign_detail(self, client, auth_headers, elder):
        create_resp = client.post("/api/vital-signs/", headers=auth_headers, json={
            "elder_id": elder.id,
            "measurement_type": "routine",
            "temperature": 37.0,
            "heart_rate": 80,
        })
        assert create_resp.status_code in (200, 201)
        vs_id = create_resp.json()["id"]

        resp = client.get(f"/api/vital-signs/{vs_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == vs_id


class TestMedicationLogs:
    """用药执行记录"""

    def test_list_medication_logs_empty(self, client, auth_headers):
        resp = client.get("/api/medication-logs/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_medication_log(self, client, auth_headers, elder):
        # 先创建用药
        med_resp = client.post("/api/medications/", headers=auth_headers, json={
            "elder_id": elder.id,
            "drug_name": "维生素",
            "dosage": "每天一次",
            "frequency": "daily",
            "start_date": "2025-06-01",
        })
        assert med_resp.status_code in (200, 201)
        med_id = med_resp.json()["id"]

        resp = client.post("/api/medication-logs/", headers=auth_headers, json={
            "medication_id": med_id,
            "is_taken": True,
            "notes": "正常服用",
        })
        assert resp.status_code in (200, 201)
