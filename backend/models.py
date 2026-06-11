"""
颐智康养 - 数据库模型定义
"""
import os
from datetime import datetime, date, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Boolean,
    ForeignKey, Text, Enum as SAEnum, JSON, create_engine, Table
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
import enum

from config import (
    DATABASE_URL, DB_ENGINE, DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_RECYCLE
)
from logger import get_logger
from utils.crypto import EncryptedString

logger = get_logger("yzkay.db")

Base = declarative_base()

# ==================== 枚举定义 ====================

class CareLevel(str, enum.Enum):
    """护理等级"""
    BASIC = "basic"
    LEVEL_1 = "level_1"
    LEVEL_2 = "level_2"
    LEVEL_3 = "level_3"
    SPECIAL = "special"

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"

class ElderStatus(str, enum.Enum):
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    LEAVE_TEMP = "leave_temp"

class PaymentStatus(str, enum.Enum):
    PAID = "paid"
    UNPAID = "unpaid"
    OVERDUE = "overdue"

# ==================== 权限系统 ====================

class Permission(Base):
    """权限点定义"""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(100), unique=True, nullable=False, index=True)  # 如 elder:view / elder:create
    name = Column(String(100), nullable=False)                           # 可读名称：查看老人
    module = Column(String(50), nullable=False)                          # 模块分组：老人管理
    description = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# 角色-权限关联表（多对多）
role_permission = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    """角色"""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)       # 如 超级管理员 / 护士长 / 护理员
    code = Column(String(50), unique=True, nullable=False)       # admin / head_nurse / nurse
    description = Column(String(255))
    is_system = Column(Boolean, default=False)                   # 系统内置角色，不可删除
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    permissions = relationship("Permission", secondary=role_permission, lazy="joined")
    users = relationship("User", back_populates="role_obj")


class User(Base):
    """系统用户"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    real_name = Column(String(50), nullable=False)
    phone = Column(EncryptedString(20))
    # 保留旧 role 字段做向后兼容，新增 role_id 关联角色表
    role = Column(String(20), nullable=False, default="nurse")   # admin / nurse（旧）
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    role_obj = relationship("Role", back_populates="users")

    @property
    def permission_codes(self):
        """获取该用户所有权限 code 列表"""
        if self.role_obj:
            return [p.code for p in self.role_obj.permissions]
        # 旧逻辑兜底：admin 拥有全部权限
        if self.role == "admin":
            return ["*"]
        return []

    def has_permission(self, code: str) -> bool:
        codes = self.permission_codes
        return "*" in codes or code in codes


# ==================== 业务模型 ====================

class Elder(Base):
    """老人信息"""
    __tablename__ = "elders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    gender = Column(String(10), nullable=False)
    id_card = Column(EncryptedString(18), unique=True)
    birth_date = Column(Date, nullable=False)
    phone = Column(EncryptedString(20))
    emergency_contact = Column(EncryptedString(50))
    emergency_phone = Column(EncryptedString(20))
    address = Column(String(200))
    status = Column(String(20), default=ElderStatus.CHECKED_IN.value)
    check_in_date = Column(Date, nullable=False)
    check_out_date = Column(Date, nullable=True)
    room_number = Column(String(20))
    bed_number = Column(String(20))
    care_level = Column(String(20), default=CareLevel.BASIC.value)
    monthly_fee = Column(Float, default=0.0)
    medical_history = Column(Text)
    allergies = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    care_records = relationship("CareRecord", back_populates="elder")
    bills = relationship("Bill", back_populates="elder")
    contracts = relationship("Contract", back_populates="elder")
    medications = relationship("Medication", back_populates="elder")


class CareRecord(Base):
    """护理记录"""
    __tablename__ = "care_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False, index=True)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    record_date = Column(Date, default=date.today, nullable=False)
    record_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    care_type = Column(String(50), nullable=False)
    description = Column(Text)
    is_abnormal = Column(Boolean, default=False)
    abnormal_detail = Column(Text)
    photo_url = Column(String(500))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    elder = relationship("Elder", back_populates="care_records")


class Bill(Base):
    """费用账单"""
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False, index=True)
    bill_month = Column(String(7), nullable=False)
    bill_items = Column(JSON, comment="账单明细JSON")
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    status = Column(String(20), default=PaymentStatus.UNPAID.value)
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    elder = relationship("Elder", back_populates="bills")


class Contract(Base):
    """服务合同"""
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False, index=True)
    contract_no = Column(String(50), unique=True, nullable=False)
    contract_name = Column(String(200), nullable=False)
    total_amount = Column(Float, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    payment_mode = Column(String(20), nullable=False, default="monthly")
    status = Column(String(20), default="active")
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    elder = relationship("Elder", back_populates="contracts")
    payments = relationship("ContractPayment", back_populates="contract", order_by="ContractPayment.plan_date")


class ContractPayment(Base):
    """合同付款计划/记录"""
    __tablename__ = "contract_payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, index=True)
    payment_no = Column(Integer, nullable=False)
    plan_date = Column(Date, nullable=False)
    plan_amount = Column(Float, nullable=False)
    actual_date = Column(Date, nullable=True)
    actual_amount = Column(Float, default=0.0)
    status = Column(String(20), default="pending")
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    contract = relationship("Contract", back_populates="payments")


class Medication(Base):
    """用药记录"""
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False, index=True)
    drug_name = Column(String(100), nullable=False)
    dosage = Column(String(50))
    frequency = Column(String(50))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    elder = relationship("Elder", back_populates="medications")


class MedicationLog(Base):
    """用药执行记录"""
    __tablename__ = "medication_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=False)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    is_taken = Column(Boolean, default=True)
    notes = Column(Text)


class ShiftRecord(Base):
    """交接班记录"""
    __tablename__ = "shift_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shift_date = Column(Date, default=date.today, nullable=False)
    shift_type = Column(String(20), nullable=False)
    from_nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    summary = Column(Text)
    special_notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class VitalSigns(Base):
    """生命体征记录"""
    __tablename__ = "vital_signs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False, index=True)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    record_date = Column(Date, default=date.today, nullable=False)
    record_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    blood_pressure_systolic = Column(Integer, nullable=True)
    blood_pressure_diastolic = Column(Integer, nullable=True)
    heart_rate = Column(Integer, nullable=True)
    blood_sugar = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    oxygen_saturation = Column(Integer, nullable=True)
    weight = Column(Float, nullable=True)
    measurement_type = Column(String(20), default="routine")
    notes = Column(Text)
    is_abnormal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    elder = relationship("Elder", back_populates="vital_signs")


class AlertRule(Base):
    """异常告警规则"""
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    indicator = Column(String(50), nullable=False)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    severity = Column(String(20), default="warning")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Alert(Base):
    """告警记录"""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False, index=True)
    vital_signs_id = Column(Integer, ForeignKey("vital_signs.id"), nullable=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=True)
    indicator = Column(String(50), nullable=False)
    measured_value = Column(Float, nullable=False)
    threshold_min = Column(Float, nullable=True)
    threshold_max = Column(Float, nullable=True)
    severity = Column(String(20), default="warning")
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)       # 处理备注/措施
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ==================== 通知推送 ====================

class NotificationConfig(Base):
    """通知渠道配置"""
    __tablename__ = "notification_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)                 # 配置名称
    channel = Column(String(20), nullable=False)               # wechat/sms/email/webhook
    config_json = Column(JSON, nullable=False)                 # JSON格式的渠道配置参数
    is_active = Column(Boolean, default=True)
    description = Column(String(200))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class NotificationLog(Base):
    """通知发送日志"""
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True, index=True)
    channel = Column(String(20), nullable=False)               # wechat/sms/email/webhook
    recipient = Column(String(200), nullable=False)             # 接收人标识
    content = Column(Text, nullable=False)                      # 通知内容
    status = Column(String(20), default="pending")             # pending/success/failed
    error_msg = Column(Text, nullable=True)                     # 错误信息
    sent_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    retry_count = Column(Integer, default=0)


class AlertEscalationRule(Base):
    """告警升级规则"""
    __tablename__ = "alert_escalation_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)               # warning/critical
    delay_minutes = Column(Integer, nullable=False, default=30) # 超时分钟数
    escalate_to = Column(String(50), nullable=False)            # 升级目标：user_id或角色名
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ==================== 审批管理 ====================

class Approval(Base):
    """审批记录"""
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    type = Column(String(30), nullable=False)  # checkin / medication_change / leave / fee_adjust
    content = Column(JSON, nullable=True)       # JSON格式的详细内容
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=True, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="pending")  # pending / approved / rejected
    comment = Column(Text, nullable=True)            # 审批意见
    handled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # 关联关系
    applicant = relationship("User", foreign_keys=[applicant_id])
    approver = relationship("User", foreign_keys=[approver_id])
    elder = relationship("Elder", foreign_keys=[elder_id])


# ==================== 视频监控 ====================

class Camera(Base):
    """摄像头配置"""
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)               # 摄像头名称：如 3楼走廊A区
    location = Column(String(200))                        # 安装位置描述
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=True, index=True)  # 关联老人（可选）
    rtsp_url = Column(String(500))                         # RTSP地址（真实部署时填入）
    snapshot_url = Column(String(500))                     # 截图/快照URL（用于模拟）
    status = Column(String(20), default="offline")          # online / offline / maintenance
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CameraAlert(Base):
    """摄像头异常告警（离床、摔倒等AI识别）"""
    __tablename__ = "camera_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False, index=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=True, index=True)
    alert_type = Column(String(30), nullable=False)            # fall / out_of_bed / wander / abnormal
    severity = Column(String(20), default="warning")          # warning / critical
    description = Column(String(500))
    snapshot_url = Column(String(500))                     # 告警截图
    is_handled = Column(Boolean, default=False)
    handled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    handled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# 补充 relationship
Elder.vital_signs = relationship("VitalSigns", back_populates="elder")
Elder.alerts = relationship("Alert", back_populates="elder", foreign_keys="Alert.elder_id")
Alert.elder = relationship("Elder", back_populates="alerts", foreign_keys=[Alert.elder_id])


# ==================== 审计日志 ====================

class AuditLog(Base):
    """操作审计日志（入库可查询）"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, index=True, comment="操作人")
    action = Column(String(100), nullable=False, comment="操作类型")
    target = Column(String(200), nullable=True, comment="操作对象")
    detail = Column(JSON, nullable=True, comment="详情JSON")
    ip_address = Column(String(50), nullable=True, comment="操作IP")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, comment="操作时间")


# ==================== 数据库连接 ====================

# PostgreSQL 需要连接池；SQLite 则不需要
if DB_ENGINE == "postgresql":
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_recycle=DB_POOL_RECYCLE,
        pool_pre_ping=True,  # 使用前检测连接是否存活
    )
else:
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False} if DB_ENGINE == "sqlite" else {}
    )

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db():
    """初始化数据库：运行 Alembic 迁移 + 写入种子数据

    开发环境（无 Alembic 时）回退到 create_all。
    """
    # 尝试 Alembic 迁移（生产环境）
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "alembic.ini")
        )
        # 用 config.py 的 DATABASE_URL 覆盖 ini 中的（支持 PG/SQLite 切换）
        alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
        command.upgrade(alembic_cfg, "head")
        logger = get_logger("yzkang")
        logger.info("数据库迁移完成 (Alembic)")
    except Exception as e:
        # 未安装 Alembic 或迁移失败时回退到 create_all（开发环境）
        print(f"[init_db] Alembic 迁移失败，回退到 create_all: {e}")
        Base.metadata.create_all(bind=engine)

    _seed_permissions_and_roles()


def _seed_permissions_and_roles():
    """写入系统内置权限点和角色（幂等操作，支持增量添加新权限）"""
    db = SessionLocal()
    try:
        # ---------- 权限点定义 ----------
        perms_def = [
            # 老人管理
            ("elder:view",          "查看老人",       "老人管理"),
            ("elder:create",        "新增老人",       "老人管理"),
            ("elder:edit",          "编辑老人",       "老人管理"),
            ("elder:delete",        "删除老人",       "老人管理"),
            # 护理记录
            ("care:view",           "查看护理记录",   "护理记录"),
            ("care:create",         "新增护理记录",   "护理记录"),
            ("care:edit",           "编辑护理记录",   "护理记录"),
            # 费用账单
            ("bill:view",           "查看账单",       "费用账单"),
            ("bill:create",         "创建账单",       "费用账单"),
            ("bill:pay",            "标记收款",       "费用账单"),
            # 用药管理
            ("medication:view",     "查看用药",       "用药管理"),
            ("medication:create",   "新增用药",       "用药管理"),
            ("medication:log",      "记录执行",       "用药管理"),
            # 交接班
            ("shift:view",          "查看交接班",     "交接班"),
            ("shift:create",        "创建交接班",     "交接班"),
            # 生命体征
            ("vital:view",          "查看体征",       "生命体征"),
            ("vital:create",        "录入体征",       "生命体征"),
            # 告警
            ("alert:view",          "查看告警",       "告警中心"),
            ("alert:resolve",       "处理告警",       "告警中心"),
            ("alert:rule",          "管理规则",       "告警中心"),
            # 报表
            ("report:view",         "查看报表",       "报表中心"),
            ("report:export",       "导出报表",       "报表中心"),
            # 系统管理
            ("system:user",         "用户管理",       "系统设置"),
            ("system:role",         "角色管理",       "系统设置"),
            # 审批管理
            ("approval:view",       "查看审批",       "审批管理"),
            ("approval:create",     "发起审批",       "审批管理"),
            ("approval:approve",    "审批处理",       "审批管理"),
            # 视频监控
            ("monitor:view",       "查看监控",       "视频监控"),
            ("monitor:manage",     "管理摄像头",     "视频监控"),
            ("monitor:handle",    "处理监控告警",   "视频监控"),
            # 合同付款
            ("contract:view",       "查看合同",       "合同付款"),
            ("contract:create",     "创建合同",       "合同付款"),
            ("contract:pay",        "标记付款",       "合同付款"),
            # 通知推送
            ("notify:config",       "通知配置管理",   "通知推送"),
            ("notify:view",         "查看通知日志",   "通知推送"),
            ("alert:escalation",    "告警升级规则",   "通知推送"),
        ]

        perm_objs = {}
        existing_count = db.query(Permission).count()

        for code, name, module in perms_def:
            existing = db.query(Permission).filter(Permission.code == code).first()
            if existing:
                perm_objs[code] = existing
            else:
                p = Permission(code=code, name=name, module=module)
                db.add(p)
                db.flush()
                perm_objs[code] = p

        # 如果是全新初始化，写入角色
        if existing_count == 0:
            db.flush()

            # 超级管理员 - 全部权限
            admin_role = Role(
                name="超级管理员", code="admin",
                description="拥有全部权限，系统内置不可删除",
                is_system=True,
                permissions=list(perm_objs.values())
            )
            db.add(admin_role)

            # 护士长 - 除系统管理外全部权限
            head_nurse_perms = [p for c, p in perm_objs.items() if not c.startswith("system:")]
            head_nurse_role = Role(
                name="护士长", code="head_nurse",
                description="管理护理、体征、告警、报表，不含系统设置",
                is_system=True,
                permissions=head_nurse_perms
            )
            db.add(head_nurse_role)

            # 护理员 - 只读 + 基础操作
            nurse_perms_codes = {
                "elder:view", "care:view", "care:create", "care:edit",
                "medication:view", "medication:log",
                "shift:view", "shift:create",
                "vital:view", "vital:create",
                "alert:view", "monitor:view",
            }
            nurse_role = Role(
                name="护理员", code="nurse",
                description="日常护理操作权限",
                is_system=True,
                permissions=[perm_objs[c] for c in nurse_perms_codes]
            )
            db.add(nurse_role)

            db.flush()

            # 更新 admin 用户关联新角色
            admin_user = db.query(User).filter(User.username == "admin").first()
            if admin_user:
                admin_user.role_id = admin_role.id
        else:
            # 增量：为新权限添加到超级管理员角色
            admin_role = db.query(Role).filter(Role.code == "admin").first()
            if admin_role:
                existing_codes = {p.code for p in admin_role.permissions}
                new_perms = [p for code, p in perm_objs.items() if code not in existing_codes]
                if new_perms:
                    admin_role.permissions.extend(new_perms)

            # 同样给护士长加新权限（不含系统设置类）
            head_nurse_role = db.query(Role).filter(Role.code == "head_nurse").first()
            if head_nurse_role:
                existing_codes = {p.code for p in head_nurse_role.permissions}
                new_perms = [p for code, p in perm_objs.items()
                             if code not in existing_codes and not code.startswith("system:")]
                if new_perms:
                    head_nurse_role.permissions.extend(new_perms)

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("权限初始化失败: %s", e, exc_info=True)
    finally:
        db.close()


def get_db():
    """获取数据库会话（依赖注入用）"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
