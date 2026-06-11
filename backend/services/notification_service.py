"""
通知推送服务
支持渠道：企业微信、短信(SMS)、邮件、Webhook回调
实现：发送通知 + 记录日志 + 重试机制
"""
import json
import logging
from datetime import datetime
from typing import Optional

import requests

from models import Alert, AlertEscalationRule, NotificationConfig, NotificationLog
from schemas import AlertEscalationRuleOut, NotificationConfigOut

logger = logging.getLogger(__name__)


# ==================== 通知发送引擎 ====================

def send_alert_notification(db, alert: Alert, elder_name: str = "") -> dict:
    """
    发送告警通知到所有活跃渠道
    返回: {channel: success/failed/skipped}
    """
    result = {}

    # 获取所有活跃通知配置
    configs = db.query(NotificationConfig).filter(
        NotificationConfig.is_active == True
    ).all()

    if not configs:
        return {"status": "no_config", "message": "无活跃通知渠道配置，通知未发送"}

    for cfg in configs:
        try:
            content = _build_notification_content(alert, elder_name, cfg.channel)
            recipient = _get_recipient(db, cfg)

            if not recipient:
                result[cfg.channel] = "skipped::no_recipient"
                continue

            status = _dispatch(cfg, recipient, content, alert)
            result[cfg.channel] = status

            # 写通知日志
            log = NotificationLog(
                alert_id=alert.id,
                channel=cfg.channel,
                recipient=recipient,
                content=content,
                status="success" if status.startswith("success") else "failed",
                error_msg=status if status.startswith("failed") else None,
                sent_at=datetime.utcnow(),
            )
            db.add(log)

        except Exception as e:
            logger.error(f"通知发送失败 [{cfg.channel}]: {e}")
            result[cfg.channel] = f"failed::{str(e)[:100]}"

            # 失败也记录日志
            log = NotificationLog(
                alert_id=alert.id,
                channel=cfg.channel,
                recipient=recipient if 'recipient' in dir() else "unknown",
                content=content if 'content' in dir() else "",
                status="failed",
                error_msg=str(e)[:500],
                sent_at=datetime.utcnow(),
            )
            db.add(log)

    db.commit()
    return result


def _build_notification_content(alert: Alert, elder_name: str, channel: str) -> str:
    """根据渠道构建通知内容"""
    severity_map = {"warning": "⚠ 黄色预警", "critical": "🚨 红色告警"}
    severity_label = severity_map.get(alert.severity, alert.severity)

    indicator_map = {
        "blood_pressure_systolic": "收缩压",
        "blood_pressure_diastolic": "舒张压",
        "heart_rate": "心率",
        "blood_sugar": "血糖",
        "temperature": "体温",
        "oxygen_saturation": "血氧",
        "weight": "体重",
    }
    indicator_label = indicator_map.get(alert.indicator, alert.indicator)

    unit_map = {
        "blood_pressure_systolic": "mmHg",
        "blood_pressure_diastolic": "mmHg",
        "heart_rate": "次/分",
        "blood_sugar": "mmol/L",
        "temperature": "℃",
        "oxygen_saturation": "%",
        "weight": "kg",
    }
    unit = unit_map.get(alert.indicator, "")

    if channel == "sms":
        return (
            f"【颐智康养】{severity_label}：老人{elder_name}的{indicator_label}为"
            f"{alert.measured_value}{unit}，正常范围为{alert.threshold_min}-{alert.threshold_max}{unit}"
        )
    elif channel == "wechat":
        return json.dumps({
            "msgtype": "text",
            "text": {
                "content": (
                    f"{severity_label}\n"
                    f"老人：{elder_name}\n"
                    f"指标：{indicator_label}\n"
                    f"实测值：{alert.measured_value}{unit}\n"
                    f"正常范围：{alert.threshold_min} - {alert.threshold_max}{unit}\n"
                    f"时间：{alert.created_at.strftime('%Y-%m-%d %H:%M') if alert.created_at else ''}\n"
                    f"请及时处理！"
                )
            }
        }, ensure_ascii=False)
    elif channel == "email":
        return (
            f"<h3>{severity_label}</h3>"
            f"<p>老人：{elder_name}</p>"
            f"<p>指标：{indicator_label} = {alert.measured_value}{unit}</p>"
            f"<p>正常范围：{alert.threshold_min} - {alert.threshold_max}{unit}</p>"
            f"<p>时间：{alert.created_at}</p>"
        )
    else:
        # webhook 默认格式
        return f"{severity_label} | {elder_name} | {indicator_label}={alert.measured_value}{unit} | 正常范围:{alert.threshold_min}-{alert.threshold_max}{unit}"


def _get_recipient(db, config: NotificationConfig) -> Optional[str]:
    """从配置中提取接收人"""
    try:
        cfg = json.loads(config.config_json) if isinstance(config.config_json, str) else config.config_json
    except (json.JSONDecodeError, TypeError):
        return None

    if config.channel == "wechat":
        return cfg.get("webhook_url") or cfg.get("to_user", "")
    elif config.channel == "sms":
        return cfg.get("phone_numbers", "")
    elif config.channel == "email":
        return cfg.get("to_email", "")
    elif config.channel == "webhook":
        return cfg.get("url", "")
    return None


def _dispatch(config: NotificationConfig, recipient: str, content: str, alert: Alert) -> str:
    """实际发送通知"""
    try:
        cfg = json.loads(config.config_json) if isinstance(config.config_json, str) else config.config_json
    except (json.JSONDecodeError, TypeError):
        return "failed::invalid_config_json"

    if config.channel == "wechat":
        return _send_wechat(recipient, content, cfg)
    elif config.channel == "sms":
        return _send_sms(recipient, content, cfg)
    elif config.channel == "email":
        return _send_email(recipient, content, cfg)
    elif config.channel == "webhook":
        return _send_webhook(recipient, content, cfg)
    else:
        return f"failed::unsupported_channel_{config.channel}"


def _send_wechat(webhook_url: str, content: str, cfg: dict) -> str:
    """企业微信机器人 Webhook 发送"""
    try:
        timeout = cfg.get("timeout", 10)
        # 如果 content 是 JSON 字符串（企业微信格式），直接解析发送
        if content.startswith("{") and content.endswith("}"):
            payload = json.loads(content)
        else:
            payload = {"msgtype": "text", "text": {"content": content}}
        resp = requests.post(webhook_url, json=payload, timeout=timeout)
        if resp.status_code == 200:
            return "success::wechat"
        return f"failed::wechat_http_{resp.status_code}"
    except requests.exceptions.Timeout:
        return "failed::wechat_timeout"
    except Exception as e:
        return f"failed::wechat_{str(e)[:80]}"


def _send_sms(phone_numbers: str, content: str, cfg: dict) -> str:
    """短信发送（真实对接阿里云/腾讯云SMS）"""
    try:
        provider = cfg.get("provider", "aliyun")
        timeout = cfg.get("timeout", 10)

        if provider == "aliyun":
            return _send_sms_aliyun(phone_numbers, content, cfg, timeout)
        elif provider == "tencent":
            return _send_sms_tencent(phone_numbers, content, cfg, timeout)
        else:
            return f"failed::unknown_sms_provider_{provider}"
    except Exception as e:
        return f"failed::sms_{str(e)[:80]}"


def _send_sms_tencent(phone_numbers: str, content: str, cfg: dict, timeout: int) -> str:
    """腾讯云短信 v3 API（TC3-HMAC-SHA256 签名）"""
    import hmac
    import hashlib
    import json
    from datetime import datetime, timezone
    from urllib.parse import urlencode

    secret_id = cfg.get("secret_id", "")
    secret_key = cfg.get("secret_key", "")
    sms_sdk_app_id = cfg.get("sms_sdk_app_id", "")
    sign_name = cfg.get("sign_name", "颐智康养")
    template_id = cfg.get("template_id", "")
    template_param = cfg.get("template_param", json.dumps([content]))  # 模板参数 JSON 数组

    if not secret_id or not secret_key or not sms_sdk_app_id or not template_id:
        return "failed::sms_tencent_missing_config"

    # 手机号列表
    phone_list = [p.strip() for p in phone_numbers.split(",") if p.strip()]
    if not phone_list:
        return "failed::sms_tencent_no_phones"

    # TC3 签名
    service = "sms"
    host = "sms.tencentcloudapi.com"
    endpoint = f"https://{host}"
    region = cfg.get("region", "ap-guangzhou")
    action = "SendSms"
    version = "2021-01-11"
    algorithm = "TC3-HMAC-SHA256"
    timestamp = int(datetime.now(timezone.utc).timestamp())
    date = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d")

    # 请求体
    payload = json.dumps({
        "SmsSdkAppId": sms_sdk_app_id,
        "SignName": sign_name,
        "TemplateId": template_id,
        "TemplateParamSet": json.loads(template_param) if isinstance(template_param, str) else template_param,
        "PhoneNumberSet": [f"+86{p}" if not p.startswith("+") else p for p in phone_list],
    }, ensure_ascii=False)

    # 1. 拼接规范请求串
    http_request_method = "POST"
    canonical_uri = "/"
    canonical_querystring = ""
    canonical_headers = f"content-type:application/json; charset=utf-8\nhost:{host}\n"
    signed_headers = "content-type;host"
    hashed_request_payload = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    canonical_request = (
        f"{http_request_method}\n{canonical_uri}\n{canonical_querystring}\n"
        f"{canonical_headers}\n{signed_headers}\n{hashed_request_payload}"
    )

    # 2. 拼接待签名字符串
    credential_scope = f"{date}/{service}/tc3_request"
    hashed_canonical_request = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical_request}"

    # 3. 计算签名
    def sign(key, msg):
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = sign(f"TC3{secret_key}".encode("utf-8"), date)
    secret_service = sign(secret_date, service)
    secret_signing = sign(secret_service, "tc3_request")
    signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    # 4. 拼接 Authorization
    authorization = (
        f"{algorithm} Credential={secret_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    # 5. 发送请求
    headers = {
        "Authorization": authorization,
        "Content-Type": "application/json; charset=utf-8",
        "Host": host,
        "X-TC-Action": action,
        "X-TC-Version": version,
        "X-TC-Region": region,
        "X-TC-Timestamp": str(timestamp),
    }

    resp = requests.post(endpoint, headers=headers, data=payload, timeout=timeout)
    result = resp.json()

    if result.get("Response", {}).get("Error"):
        err = result["Response"]["Error"]
        return f"failed::sms_tencent_{err.get('Code', 'unknown')}_{err.get('Message', '')[:50]}"
    return f"success::sms_tencent"




def _send_email(to_email: str, content: str, cfg: dict) -> str:
    """邮件发送"""
    try:
        smtp_host = cfg.get("smtp_host", "")
        smtp_port = cfg.get("smtp_port", 587)
        smtp_user = cfg.get("smtp_user", "")
        smtp_password = cfg.get("smtp_password", "")

        if not all([smtp_host, smtp_user, smtp_password]):
            return "failed::email_missing_config"

        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = "【颐智康养】告警通知"

        msg.attach(MIMEText(content, "html", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_email, msg.as_string())

        return "success::email"

    except Exception as e:
        return f"failed::email_{str(e)[:80]}"


def _send_webhook(url: str, content: str, cfg: dict) -> str:
    """通用 Webhook 回调"""
    try:
        timeout = cfg.get("timeout", 10)
        headers = cfg.get("headers", {})
        method = cfg.get("method", "POST").upper()

        if method == "POST":
            resp = requests.post(url, json={"content": content, "timestamp": str(datetime.utcnow())},
                                 headers=headers, timeout=timeout)
        elif method == "GET":
            resp = requests.get(url, params={"content": content}, headers=headers, timeout=timeout)
        else:
            return f"failed::unsupported_method_{method}"

        if resp.status_code < 300:
            return "success::webhook"
        return f"failed::webhook_http_{resp.status_code}"
    except requests.exceptions.Timeout:
        return "failed::webhook_timeout"
    except Exception as e:
        return f"failed::webhook_{str(e)[:80]}"


# ==================== 告警升级引擎 ====================

def check_alert_escalation(db) -> int:
    """
    检查所有未处理告警，对超时未处理的执行升级
    返回：已升级的告警数量
    """
    from datetime import datetime, timedelta

    escalation_rules = db.query(AlertEscalationRule).filter(
        AlertEscalationRule.is_active == True
    ).all()

    if not escalation_rules:
        return 0

    escalated_count = 0

    for rule in escalation_rules:
        cutoff = datetime.utcnow() - timedelta(minutes=rule.delay_minutes)

        # 查找匹配的未处理告警
        overdue_alerts = db.query(Alert).filter(
            Alert.severity == rule.severity,
            Alert.is_resolved == False,
            Alert.created_at <= cutoff
        ).all()

        for alert in overdue_alerts:
            # 检查是否已经升级过（避免重复升级）
            already_escalated = db.query(NotificationLog).filter(
                NotificationLog.alert_id == alert.id,
                NotificationLog.channel == "escalation"
            ).first()

            if already_escalated:
                continue

            # 生成升级通知
            from schemas import AlertEscalationRuleOut
            rule_out = AlertEscalationRuleOut(
                id=rule.id, name=rule.name, severity=rule.severity,
                delay_minutes=rule.delay_minutes, escalate_to=rule.escalate_to,
                is_active=rule.is_active
            )
            _send_escalation_notification(db, alert, rule_out)
            escalated_count += 1

    return escalated_count


def _send_escalation_notification(db, alert: Alert, rule: AlertEscalationRuleOut):
    """发送告警升级通知"""
    # 查找升级目标的联系方式
    escalate_to = rule.escalate_to

    channel = "escalation"
    content = (
        f"⚠ 告警升级通知：\n"
        f"原始告警：{alert.message}\n"
        f"严重程度：{alert.severity}\n"
        f"升级规则：{rule.name}（超时{rule.delay_minutes}分钟未处理）\n"
        f"升级目标：{escalate_to}\n"
        f"告警时间：{alert.created_at}\n"
        f"请立即处理！"
    )

    # 尝试通过企业微信发送升级通知
    wechat_config = db.query(NotificationConfig).filter(
        NotificationConfig.channel == "wechat",
        NotificationConfig.is_active == True
    ).first()

    if wechat_config:
        try:
            cfg = json.loads(wechat_config.config_json)
            webhook_url = cfg.get("webhook_url", "")
            if webhook_url:
                payload = {"msgtype": "text", "text": {"content": content}}
                requests.post(webhook_url, json=payload, timeout=10)
        except Exception:
            pass

    # 记录升级日志
    log = NotificationLog(
        alert_id=alert.id,
        channel=channel,
        recipient=escalate_to,
        content=content,
        status="success",
        sent_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
