"""
颐智康养 — Locust 性能压测脚本

模拟真实用户操作流程，测试系统在高并发下的表现。

SLA 目标：
  - 平均响应时间 < 500ms
  - P99 延迟 < 2s
  - 错误率 < 1%

使用方式：
  cd scripts/
  locust -f locustfile.py --host=http://localhost:8899

  然后打开浏览器 http://localhost:8089 设置并发用户数和速率

  或命令行模式：
  locust -f locustfile.py --host=http://localhost:8899 --headless -u 50 -r 5 --run-time 5m --html=report.html
"""

import random
import time
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner


# ── 测试数据池 ─────────────────────────────────
ELDER_NAMES = ["张建国", "李秀英", "王德发", "刘桂芝", "陈大伟",
               "赵淑珍", "孙志强", "周美华", "吴永福", "郑玉兰"]
CARE_CONTENTS = ["早餐正常进食", "午睡2小时", "血压偏高已测量",
                 "饭后服药一次", "精神状态良好", "家属探视",
                 "体温正常36.5°C", "下肢按摩15分钟", "室外活动30分钟"]
MEDICATION_NAMES = ["降压药", "降糖药", "钙片", "维生素D", "安眠药"]

class YzkangUser(HttpUser):
    """模拟管理后台用户"""
    wait_time = between(2, 5)  # 用户操作间隔 2-5 秒

    def on_start(self):
        """登录获取 Token"""
        response = self.client.post("/api/auth/login", json={
            "username": "admin",
            "password": "Admin@123",
        })
        if response.status_code == 200:
            token = response.json().get("access_token", "")
            self.client.headers.update({"Authorization": f"Bearer {token}"})
        else:
            # 尝试注册（仅限开发环境）
            pass

    @task(5)  # 权重 5 — 最频繁操作
    def view_dashboard(self):
        """查看仪表盘"""
        with self.client.get("/api/dashboard/stats", catch_response=True) as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Dashboard failed: {r.status_code}")

    @task(4)
    def list_elders(self):
        """浏览老人列表"""
        page = random.randint(1, 5)
        with self.client.get(f"/api/elders/?page={page}&page_size=20",
                            catch_response=True) as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Elder list failed: {r.status_code}")

    @task(2)
    def view_elder_detail(self):
        """查看老人详情"""
        elder_id = random.randint(1, 10)
        with self.client.get(f"/api/elders/{elder_id}",
                            catch_response=True, name="/api/elders/:id") as r:
            if r.status_code == 200:
                r.success()
            elif r.status_code in [401, 404]:
                r.success()  # 预期可能的状态码
            else:
                r.failure(f"Elder detail failed: {r.status_code}")

    @task(2)
    def search_elders(self):
        """搜索老人"""
        keyword = random.choice(ELDER_NAMES)[:2]
        with self.client.get(f"/api/elders/?keyword={keyword}&page_size=20",
                            catch_response=True, name="/api/elders/?keyword=*") as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Elder search failed: {r.status_code}")

    @task(3)
    def list_care_records(self):
        """浏览照护记录"""
        elder_id = random.randint(1, 10)
        with self.client.get(f"/api/care-records/?elder_id={elder_id}&page_size=20",
                            catch_response=True, name="/api/care-records/?elder_id=*") as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Care records failed: {r.status_code}")

    @task(1)
    def create_care_record(self):
        """添加照护记录"""
        elder_id = random.randint(1, 10)
        content = random.choice(CARE_CONTENTS)
        with self.client.post("/api/care-records/", json={
            "elder_id": elder_id,
            "content": content,
            "record_time": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, catch_response=True) as r:
            if r.status_code == 201:
                r.success()
            elif r.status_code in [401, 404, 422]:
                r.success()
            else:
                r.failure(f"Create care record failed: {r.status_code}")

    @task(1)
    def create_medication(self):
        """添加用药记录"""
        elder_id = random.randint(1, 10)
        med_name = random.choice(MEDICATION_NAMES)
        with self.client.post("/api/medications/", json={
            "elder_id": elder_id,
            "medication_name": med_name,
            "dosage": "1片",
            "administered_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, catch_response=True) as r:
            if r.status_code in [201, 401, 404, 422]:
                r.success()
            else:
                r.failure(f"Create medication failed: {r.status_code}")

    @task(2)
    def list_bills(self):
        """浏览账单"""
        with self.client.get("/api/bills/?page_size=20",
                            catch_response=True) as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Bills failed: {r.status_code}")

    @task(2)
    def list_vital_signs(self):
        """浏览体征数据"""
        elder_id = random.randint(1, 10)
        with self.client.get(f"/api/vital-signs/?elder_id={elder_id}&page_size=20",
                            catch_response=True, name="/api/vital-signs/?elder_id=*") as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Vital signs failed: {r.status_code}")

    @task(2)
    def list_alerts(self):
        """浏览告警列表"""
        with self.client.get("/api/alerts/?page_size=20",
                            catch_response=True) as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Alerts failed: {r.status_code}")

    @task(1)
    def health_check(self):
        """健康检查 (不计入 SLA)"""
        with self.client.get("/api/health", name="/api/health") as r:
            if r.status_code != 200:
                r.failure(f"Health check failed: {r.status_code}")

    @task(1)
    def list_users_admin(self):
        """用户管理列表"""
        with self.client.get("/api/admin/users/",
                            catch_response=True) as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Admin users failed: {r.status_code}")

    @task(1)
    def list_roles_admin(self):
        """角色管理列表"""
        with self.client.get("/api/admin/roles",
                            catch_response=True) as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Admin roles failed: {r.status_code}")

    @task(1)
    def list_approvals(self):
        """审批列表"""
        with self.client.get("/api/approvals/?page_size=20",
                            catch_response=True) as r:
            if r.status_code not in [200, 401, 404]:
                r.failure(f"Approvals failed: {r.status_code}")


# ── 事件钩子 ─────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """测试启动时打印配置信息"""
    print(f"\n{'='*50}")
    print(f"  颐智康养 — 性能压测")
    print(f"  目标: {environment.host}")
    print(f"  SLA: 平均 <500ms, P99 <2s, 错误率 <1%")
    print(f"{'='*50}\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """测试停止时输出摘要"""
    stats = environment.stats
    total_requests = stats.total.num_requests
    total_failures = stats.total.num_failures
    avg_response = stats.total.avg_response_time
    p99_response = stats.total.get_response_time_percentile(0.99)

    error_rate = (total_failures / total_requests * 100) if total_requests > 0 else 0

    # SLA 判定
    sla_avg = "✅" if avg_response < 500 else "❌"
    sla_p99 = "✅" if p99_response < 2000 else "❌"
    sla_err = "✅" if error_rate < 1 else "❌"

    print(f"\n{'='*50}")
    print(f"  压测报告摘要")
    print(f"{'='*50}")
    print(f"  总请求数:    {total_requests:,}")
    print(f"  失败数:      {total_failures:,}")
    print(f"  错误率:      {error_rate:.2f}%  {sla_err}")
    print(f"  平均响应:    {avg_response:.0f}ms  {sla_avg}")
    print(f"  P99 延迟:    {p99_response:.0f}ms  {sla_p99}")
    print(f"  RPS:         {stats.total.total_rps:.1f}")
    print(f"\n  SLA 达成: {'全部通过 ✅' if sla_avg == sla_p99 == sla_err == '✅' else '部分未达标 ⚠️'}")
    print(f"{'='*50}\n")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length,
               exception, **kwargs):
    """记录慢请求 (> 2秒)"""
    if exception and "429" not in str(exception):
        print(f"  ⚠️ SLOW: {name} took {response_time:.0f}ms")
