# 颐智康养 — API 接口文档

> 版本: v0.5 | 基路径: `/api`

**认证方式**: 所有 API（除 `/auth/*` 外）需在请求头携带 `Authorization: Bearer <access_token>`

**在线文档**: 启动后端后访问 `http://localhost:8899/docs` (Swagger UI) 或 `/redoc`

---

## 目录

- [1. 认证 (`/api/auth`)](#1-认证)
- [2. 仪表盘 (`/api/dashboard`)](#2-仪表盘)
- [3. 老人管理 (`/api/elders`)](#3-老人管理)
- [4. 照护记录 (`/api/care-records`)](#4-照护记录)
- [5. 账单管理 (`/api/bills`)](#5-账单管理)
- [6. 用药记录 (`/api/medications`)](#6-用药记录)
- [7. 班次管理 (`/api/shifts`)](#7-班次管理)
- [8. 生命体征 (`/api/vital-signs`)](#8-生命体征)
- [9. 告警中心 (`/api/alerts`)](#9-告警中心)
- [10. 报表中心 (`/api/reports`)](#10-报表中心)
- [11. 审批管理 (`/api/approvals`)](#11-审批管理)
- [12. 合同支付 (`/api/contracts`)](#12-合同支付)
- [13. 视频监控 (`/api/cameras`)](#13-视频监控)
- [14. 通知配置 (`/api/notification-configs`)](#14-通知配置)
- [15. 通知系统 (`/api/notifications`)](#15-通知系统)
- [16. 系统管理 (`/api/admin`)](#16-系统管理)
- [17. 审计日志 (`/api/audit-logs`)](#17-审计日志)
- [18. 健康检查 (`/api/health`)](#18-健康检查)

---

## 1. 认证

### POST `/api/auth/login`
登录获取令牌。

**请求**:
```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

**响应** `200`:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "username": "admin",
  "real_name": "管理员",
  "role": "superadmin",
  "role_id": 1,
  "permissions": ["*"]
}
```

**响应** `401`: 用户名或密码错误

### POST `/api/auth/refresh`
刷新 access_token。

**请求**:
```json
{
  "refresh_token": "eyJ..."
}
```

**响应** `200`:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

### GET `/api/auth/me`
获取当前用户信息和权限。

**响应** `200`:
```json
{
  "username": "admin",
  "real_name": "管理员",
  "role": "superadmin",
  "permissions": ["*"]
}
```

---

## 2. 仪表盘

### GET `/api/dashboard/stats`
获取仪表盘统计数据。

**响应** `200`:
```json
{
  "active_elders": 42,
  "today_care_records": 18,
  "pending_alerts": 5,
  "today_medications": 12,
  "month_bills_total": 125000.00,
  "occupancy_rate": 0.85
}
```

---

## 3. 老人管理

### GET `/api/elders/`
老人列表（分页+搜索）。

**查询参数**:
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页条数 (≤100) |
| keyword | str | - | 搜索关键词 (姓名/身份证) |
| status | str | - | 筛选: active/inactive |

**响应** `200`:
```json
{
  "items": [
    {
      "id": 1,
      "name": "张建国",
      "gender": "男",
      "birth_date": "1945-03-15",
      "room_number": "201",
      "status": "active",
      "check_in_date": "2024-01-10"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

### POST `/api/elders/`
新增老人。

**请求**:
```json
{
  "name": "张建国",
  "gender": "男",
  "birth_date": "1945-03-15",
  "id_card": "310xxxxxxxxxxxxxxx",
  "phone": "138xxxxxxxx",
  "emergency_contact": "张三",
  "emergency_phone": "139xxxxxxxx",
  "check_in_date": "2024-01-10",
  "room_number": "201"
}
```

### GET `/api/elders/{elder_id}`
老人详情。

### PUT `/api/elders/{elder_id}`
更新老人信息。

### DELETE `/api/elders/{elder_id}`
删除老人。

---

## 4. 照护记录

### GET `/api/care-records/`
照护记录列表。

**查询参数**: `elder_id`, `page`, `page_size`

### POST `/api/care-records/`
添加照护记录。

**请求**:
```json
{
  "elder_id": 1,
  "content": "早餐正常进食，精神状态良好",
  "record_time": "2026-06-11T08:30:00"
}
```

---

## 5. 账单管理

### GET `/api/bills/`
账单列表（分页+筛选）。

**查询参数**: `elder_id`, `status` (pending/paid/overdue), `page`, `page_size`

### POST `/api/bills/`
创建账单。

**请求**:
```json
{
  "elder_id": 1,
  "amount": 2999.00,
  "bill_type": "monthly",
  "description": "2026年6月月费",
  "due_date": "2026-06-30"
}
```

### PUT `/api/bills/{bill_id}/pay`
标记已支付。

### GET `/api/bills/stats`
账单统计。

---

## 6. 用药记录

### GET `/api/medications/`
用药记录列表。

**查询参数**: `elder_id`, `date`, `page`, `page_size`

### POST `/api/medications/`
添加用药记录。

**请求**:
```json
{
  "elder_id": 1,
  "medication_name": "降压药",
  "dosage": "1片",
  "administered_at": "2026-06-11T08:00:00"
}
```

---

## 7. 班次管理

### GET `/api/shifts/`
班次列表。

### POST `/api/shifts/`
添加班次记录。

**请求**:
```json
{
  "shift_type": "morning",
  "staff_name": "李护士",
  "start_time": "2026-06-11T07:00:00",
  "end_time": "2026-06-11T15:00:00"
}
```

---

## 8. 生命体征

### GET `/api/vital-signs/`
体征数据列表。

**查询参数**: `elder_id`, `page`, `page_size`

### POST `/api/vital-signs/`
记录体征数据。

**请求**:
```json
{
  "elder_id": 1,
  "heart_rate": 72,
  "blood_pressure_systolic": 120,
  "blood_pressure_diastolic": 80,
  "temperature": 36.5,
  "measured_at": "2026-06-11T08:00:00"
}
```

---

## 9. 告警中心

### GET `/api/alerts/`
告警列表。

**查询参数**: `level` (info/warning/critical), `status` (active/resolved), `page`, `page_size`

### GET `/api/alerts/{alert_id}`
告警详情（含处理历史和通知记录）。

### POST `/api/alerts/{alert_id}/resolve`
处理告警。

**请求**:
```json
{
  "note": "已到现场确认，老人心率已恢复正常"
}
```

### POST `/api/alerts/batch/resolve`
批量处理。

**请求**:
```json
{
  "alert_ids": [1, 2, 3],
  "note": "批量处理完成"
}
```

### POST `/api/alerts/batch/read`
批量标记已读。

**请求**:
```json
{
  "alert_ids": [1, 2, 3]
}
```

---

## 10. 报表中心

### GET `/api/reports/`
报表列表。

**查询参数**: `type` (elder/care/finance/alert), `start_date`, `end_date`

### POST `/api/reports/`
生成报表。

---

## 11. 审批管理

### GET `/api/approvals/`
审批列表。

### POST `/api/approvals/`
提交审批。

### PUT `/api/approvals/{approval_id}`
审批处理 (approve/reject)。

---

## 12. 合同支付

### GET `/api/contracts/`
合同支付列表。

**查询参数**: `status`, `page`, `page_size`

### POST `/api/contracts/`
创建支付记录。

---

## 13. 视频监控

### GET `/api/cameras/`
摄像头列表。

### POST `/api/cameras/`
添加摄像头。

**请求**:
```json
{
  "name": "一楼走廊",
  "rtsp_url": "rtsp://192.168.1.100:554/stream1",
  "location": "1楼东侧走廊",
  "status": "active"
}
```

### PUT `/api/cameras/{camera_id}`
更新摄像头信息。

### DELETE `/api/cameras/{camera_id}`
删除摄像头。

### POST `/api/cameras/{camera_id}/snapshot`
抓取截图。

### GET `/api/cameras/alerts`
摄像头告警列表。

### POST `/api/cameras/alerts/{alert_id}/handle`
处理摄像头告警。

---

## 14. 通知配置

### GET `/api/notification-configs/`
通知配置列表。

### POST `/api/notification-configs/`
创建通知配置。

### PUT `/api/notification-configs/{config_id}`
更新通知配置。

### GET `/api/notification-configs/templates`
通知模板列表。

### GET `/api/notification-configs/escalation-rules`
升级规则列表。

### GET `/api/notification-configs/logs`
通知发送日志。

---

## 15. 通知系统

### GET `/api/notifications/configs`
获取通知配置。

### GET `/api/notifications/templates`
获取通知模板。

### GET `/api/notifications/escalation-rules`
获取升级规则。

### GET `/api/notifications/logs`
通知日志。

---

## 16. 系统管理

所有端点需要 `Authorization` 头，且仅管理员可访问。

### 用户管理 (`/api/admin/users`)

### GET `/api/admin/users/`
用户列表。

### POST `/api/admin/users/`
创建用户。

**请求**:
```json
{
  "username": "nurse_li",
  "password": "Nurse@123",
  "real_name": "李护士",
  "role_id": 3
}
```

### PUT `/api/admin/users/{user_id}`
更新用户。

### DELETE `/api/admin/users/{user_id}`
删除用户。

---

### 角色权限 (`/api/admin/roles`)

### GET `/api/admin/roles`
角色列表。

**响应** `200`:
```json
[
  {
    "id": 1,
    "name": "超级管理员",
    "permissions": ["*"]
  }
]
```

### POST `/api/admin/roles`
创建角色。

### PUT `/api/admin/roles/{role_id}`
更新角色。

### DELETE `/api/admin/roles/{role_id}`
删除角色。

### GET `/api/admin/permissions`
权限列表。

---

## 17. 审计日志

### GET `/api/audit-logs/`
审计日志列表。

**查询参数**: `username`, `action`, `start_date`, `end_date`, `page`, `page_size`

**响应** `200`:
```json
{
  "items": [
    {
      "id": 1,
      "username": "admin",
      "action": "login",
      "target": "system",
      "detail": "{\"ip\": \"127.0.0.1\"}",
      "created_at": "2026-06-11T08:00:00"
    }
  ],
  "total": 150,
  "page": 1
}
```

---

## 18. 健康检查

### GET `/api/health`
基础健康检查。

**响应** `200`:
```json
{
  "status": "ok",
  "app": "颐智康养",
  "version": "0.5.0"
}
```

### GET `/api/health/detailed`
详细健康检查（含数据库/磁盘/内存）。

**响应** `200`:
```json
{
  "status": "healthy",
  "app": "颐智康养",
  "version": "0.5.0",
  "uptime_seconds": 86400,
  "uptime_human": "1d 0h 0m 0s",
  "checks": {
    "database": true,
    "database_live": true,
    "encryption": true,
    "rate_limit": true,
    "disk_free_mb": 50000.0,
    "memory_percent": 45.0
  }
}
```

---

## 通用规范

### 分页
所有列表接口支持分页参数 `page`(默认1) 和 `page_size`(默认20, 最大100)。

### 错误码
| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 / Token 过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 数据冲突 |
| 422 | 参数校验失败 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

### 认证流程
```
1. POST /api/auth/login → 获取 access_token + refresh_token
2. 后续请求: Authorization: Bearer <access_token>
3. Token 过期 (30分钟): 自动用 refresh_token 换新 (前端自动处理)
4. Refresh 也过期 (7天): 跳转登录页
```

### 变更日志
| 版本 | 日期 | 变更 |
|------|------|------|
| 0.5.0 | 2026-06-11 | 新增通知系统、摄像头管理、审计日志；告警批量操作 |
| 0.3.0 | 2026-06-10 | PostgreSQL 支持、JWT 双令牌、数据加密、限流 |
| 0.1.0 | 2026-06-09 | 初始版本 |
