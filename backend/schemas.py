"""
颐智康养 - Pydantic 数据校验模型
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ==================== 老人管理 ====================

class ElderCreate(BaseModel):
    name: str = Field(..., max_length=50, description="姓名")
    gender: str = Field(..., description="性别: male/female")
    id_card: Optional[str] = Field(None, max_length=18, description="身份证号")
    birth_date: date = Field(..., description="出生日期")
    phone: Optional[str] = Field(None, max_length=20)
    emergency_contact: Optional[str] = Field(None, max_length=50, description="紧急联系人")
    emergency_phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=200)
    check_in_date: date = Field(..., description="入住日期")
    room_number: Optional[str] = Field(None, max_length=20)
    bed_number: Optional[str] = Field(None, max_length=20)
    care_level: str = Field("basic", description="护理等级")
    monthly_fee: float = Field(0.0, description="月费")
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None


class ElderUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    room_number: Optional[str] = None
    bed_number: Optional[str] = None
    care_level: Optional[str] = None
    monthly_fee: Optional[float] = None
    status: Optional[str] = None
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None


class ElderOut(BaseModel):
    id: int
    name: str
    gender: str
    birth_date: date
    phone: Optional[str] = None
    status: str
    check_in_date: date
    room_number: Optional[str] = None
    bed_number: Optional[str] = None
    care_level: str
    monthly_fee: float
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== 护理记录 ====================

class CareRecordCreate(BaseModel):
    elder_id: int
    care_type: str = Field(..., description="护理类型")
    description: Optional[str] = None
    is_abnormal: bool = False
    abnormal_detail: Optional[str] = None
    photo_url: Optional[str] = None


class CareRecordOut(BaseModel):
    id: int
    elder_id: int
    nurse_id: int
    record_date: date
    record_time: datetime
    care_type: str
    description: Optional[str] = None
    is_abnormal: bool
    abnormal_detail: Optional[str] = None
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== 费用账单 ====================

class BillCreate(BaseModel):
    elder_id: int
    bill_month: str = Field(..., description="账单月份，格式: 2026-05")
    bill_items: Optional[str] = None  # JSON字符串
    total_amount: float
    due_date: date


class BillOut(BaseModel):
    id: int
    elder_id: int
    bill_month: str
    total_amount: float
    paid_amount: float
    status: str
    due_date: date
    paid_date: Optional[date] = None

    class Config:
        from_attributes = True


# ==================== 合同付款 ====================

class ContractPaymentCreate(BaseModel):
    """创建合同时的付款计划"""
    payment_no: int
    plan_date: date
    plan_amount: float
    notes: Optional[str] = None


class ContractCreate(BaseModel):
    elder_id: int
    contract_no: str = Field(..., max_length=50)
    contract_name: str = Field(..., max_length=200)
    total_amount: float
    start_date: date
    end_date: date
    payment_mode: str = "monthly"
    notes: Optional[str] = None
    payments: list[ContractPaymentCreate] = []


class ContractPaymentOut(BaseModel):
    id: int
    contract_id: int
    payment_no: int
    plan_date: date
    plan_amount: float
    actual_date: Optional[date] = None
    actual_amount: float
    status: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class ContractOut(BaseModel):
    id: int
    elder_id: int
    contract_no: str
    contract_name: str
    total_amount: float
    start_date: date
    end_date: date
    payment_mode: str
    status: str
    notes: Optional[str] = None
    elder_name: Optional[str] = None
    room_number: Optional[str] = None
    paid_amount: float = 0.0
    total_plans: int = 0
    paid_plans: int = 0
    overdue_plans: int = 0
    payments: list[ContractPaymentOut] = []

    class Config:
        from_attributes = True


class ContractPaymentMark(BaseModel):
    """标记付款"""
    actual_date: date
    actual_amount: float
    notes: Optional[str] = None


# ==================== 用药管理 ====================

class MedicationCreate(BaseModel):
    elder_id: int
    drug_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None


class MedicationOut(BaseModel):
    id: int
    elder_id: int
    drug_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_active: bool

    class Config:
        from_attributes = True


class MedicationUpdate(BaseModel):
    drug_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# ==================== 用药执行记录 ====================

class MedicationLogCreate(BaseModel):
    medication_id: int
    is_taken: bool = True
    notes: Optional[str] = None


class MedicationLogOut(BaseModel):
    id: int
    medication_id: int
    nurse_id: int
    log_time: datetime
    is_taken: bool
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== 交接班记录 ====================

class ShiftRecordCreate(BaseModel):
    shift_type: str = Field(..., description="班次: morning/night")
    to_nurse_id: int = Field(..., description="接班人ID")
    summary: Optional[str] = None
    special_notes: Optional[str] = None


class ShiftRecordOut(BaseModel):
    id: int
    shift_date: date
    shift_type: str
    from_nurse_id: int
    to_nurse_id: int
    summary: Optional[str] = None
    special_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== 生命体征 ====================

class VitalSignsCreate(BaseModel):
    elder_id: int
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    blood_sugar: Optional[float] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[int] = None
    weight: Optional[float] = None
    measurement_type: str = "routine"
    notes: Optional[str] = None


class VitalSignsOut(BaseModel):
    id: int
    elder_id: int
    nurse_id: int
    record_date: date
    record_time: datetime
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    blood_sugar: Optional[float] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[int] = None
    weight: Optional[float] = None
    measurement_type: str
    notes: Optional[str] = None
    is_abnormal: bool
    created_at: datetime

    class Config:
        from_attributes = True


class VitalSignsTrendOut(BaseModel):
    """体征趋势数据点"""
    record_date: str
    blood_pressure_systolic: Optional[float] = None
    blood_pressure_diastolic: Optional[float] = None
    heart_rate: Optional[float] = None
    blood_sugar: Optional[float] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[float] = None


# ==================== 告警规则 ====================

class AlertRuleCreate(BaseModel):
    name: str
    indicator: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    severity: str = "warning"
    is_active: bool = True


class AlertRuleOut(BaseModel):
    id: int
    name: str
    indicator: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    severity: str
    is_active: bool

    class Config:
        from_attributes = True


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None


# ==================== 告警记录 ====================

class AlertResolve(BaseModel):
    """处理告警请求体"""
    note: Optional[str] = None
    action: Optional[str] = "resolve"   # resolve / ignore


class AlertOut(BaseModel):
    id: int
    elder_id: int
    vital_signs_id: Optional[int] = None
    indicator: str
    measured_value: float
    threshold_min: Optional[float] = None
    threshold_max: Optional[float] = None
    severity: str
    message: str
    is_read: bool
    is_resolved: bool
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    created_at: datetime
    elder_name: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== 院长看板 ====================

class DashboardOut(BaseModel):
    total_elders: int = 0          # 在住老人总数
    checked_in_today: int = 0      # 今日入住
    checked_out_today: int = 0     # 今日退住
    occupancy_rate: float = 0.0    # 入住率
    total_beds: int = 0            # 总床位
    monthly_revenue: float = 0.0   # 本月营收
    unpaid_bills: int = 0          # 未缴费账单数
    overdue_bills: int = 0         # 逾期账单数
    abnormal_today: int = 0        # 今日异常护理记录
    total_nurses: int = 0          # 护理员总数


# ==================== 用户认证 ====================

class UserCreate(BaseModel):
    username: str
    password: str
    real_name: str
    phone: Optional[str] = None
    role: str = "nurse"


class UserOut(BaseModel):
    """用户信息（不含密码）"""
    id: int
    username: str
    real_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """更新用户字段（均为可选）"""
    real_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    username: str
    real_name: str
    role: str
    role_id: Optional[int] = None
    permissions: Optional[list] = None


class RefreshTokenRequest(BaseModel):
    """刷新令牌请求体"""
    refresh_token: str


# ==================== 权限管理 ====================

class PermissionOut(BaseModel):
    id: int
    code: str
    name: str
    module: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleOut(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    is_system: bool
    permissions: list[PermissionOut] = []

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    permission_ids: list[int] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[list[int]] = None


# ==================== 通知推送 ====================

class NotificationConfigCreate(BaseModel):
    name: str = Field(..., max_length=100)
    channel: str = Field(..., description="wechat/sms/email/webhook")
    config_json: str = Field(..., description="JSON格式的渠道配置")
    description: Optional[str] = None
    is_active: bool = True


class NotificationConfigUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    config_json: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class NotificationConfigOut(BaseModel):
    id: int
    name: str
    channel: str
    config_json: str
    is_active: bool
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationLogOut(BaseModel):
    id: int
    alert_id: Optional[int] = None
    channel: str
    recipient: str
    content: str
    status: str
    error_msg: Optional[str] = None
    sent_at: datetime
    retry_count: int

    class Config:
        from_attributes = True


class AlertEscalationRuleCreate(BaseModel):
    name: str = Field(..., max_length=100)
    severity: str = Field(..., description="warning/critical")
    delay_minutes: int = 30
    escalate_to: str = Field(..., description="用户ID或角色名")
    is_active: bool = True


class AlertEscalationRuleOut(BaseModel):
    id: int
    name: str
    severity: str
    delay_minutes: int
    escalate_to: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================== 审批管理 ====================

class ApprovalCreate(BaseModel):
    title: str = Field(..., max_length=200, description="审批标题")
    type: str = Field(..., description="审批类型: checkin/medication_change/leave/fee_adjust")
    content: Optional[str] = None
    elder_id: Optional[int] = None
    approver_id: int = Field(..., description="审批人ID")


class ApprovalOut(BaseModel):
    id: int
    title: str
    type: str
    content: Optional[str] = None
    elder_id: Optional[int] = None
    applicant_id: int
    approver_id: Optional[int] = None
    status: str
    comment: Optional[str] = None
    handled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    applicant_name: Optional[str] = None
    approver_name: Optional[str] = None
    elder_name: Optional[str] = None

    class Config:
        from_attributes = True


class ApprovalHandle(BaseModel):
    action: str = Field(..., description="approve 或 reject")
    comment: Optional[str] = None


# ==================== 审计日志 ====================

class AuditLogOut(BaseModel):
    id: int
    username: str
    action: str
    target: Optional[str] = None
    detail: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== 视频监控 ====================

class CameraCreate(BaseModel):
    name: str = Field(..., max_length=100, description="摄像头名称")
    location: Optional[str] = Field(None, max_length=200, description="安装位置")
    elder_id: Optional[int] = None
    rtsp_url: Optional[str] = Field(None, max_length=500, description="RTSP地址")
    snapshot_url: Optional[str] = Field(None, max_length=500, description="快照URL")
    is_active: bool = True


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    elder_id: Optional[int] = None
    rtsp_url: Optional[str] = None
    snapshot_url: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None


class CameraOut(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    elder_id: Optional[int] = None
    elder_name: Optional[str] = None
    status: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CameraAlertOut(BaseModel):
    id: int
    camera_id: int
    camera_name: Optional[str] = None
    elder_id: Optional[int] = None
    elder_name: Optional[str] = None
    alert_type: str
    severity: str
    description: Optional[str] = None
    snapshot_url: Optional[str] = None
    is_handled: bool
    created_at: datetime

    class Config:
        from_attributes = True
