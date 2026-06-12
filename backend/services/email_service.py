"""
颐智康养 — 邮件服务模块

支持：
  - SMTP 通用邮件发送
  - 密码重置邮件
  - 系统告警通知邮件
  - HTML + 纯文本双格式
  - 异步发送队列 (线程池)

配置 (环境变量):
  SMTP_HOST      — SMTP 服务器地址
  SMTP_PORT      — 端口 (默认 587)
  SMTP_USER      — 发件账号
  SMTP_PASSWORD  — 发件密码/授权码
  SMTP_FROM      — 发件人 (默认 noreply@yzkang.com)
  SMTP_USE_TLS   — 是否启用 TLS (默认 true)
"""

import os
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from concurrent.futures import ThreadPoolExecutor

from logger import get_logger

logger = get_logger("email")

# ── 配置 ─────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@yzkang.com")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")

# 异步发送线程池
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="email-")


def is_configured() -> bool:
    """检查邮件服务是否已配置"""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """
    发送邮件 (同步)

    Args:
        to: 收件人
        subject: 主题
        html_body: HTML 正文
        text_body: 纯文本正文 (可选，未提供时从 HTML 提取)

    Returns:
        bool: 是否发送成功
    """
    if not is_configured():
        logger.warning("邮件服务未配置 (SMTP_HOST 未设置)")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = f"颐智康养 <{SMTP_FROM}>"
        msg["To"] = to

        if not text_body:
            # 简单 HTML → 纯文本 (去除标签)
            import re
            text_body = re.sub(r"<[^>]+>", "", html_body).strip()

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info("邮件发送成功 → {to} [{subject}]", to=to, subject=subject)
        return True

    except Exception as e:
        logger.error("邮件发送失败 → {to}: {err}", to=to, err=str(e))
        return False


def send_email_async(to: str, subject: str, html_body: str, text_body: str = ""):
    """异步发送邮件 (不阻塞主线程)"""
    _executor.submit(send_email, to, subject, html_body, text_body)


# ==================== 邮件模板 ====================

def send_password_reset(to: str, reset_link: str, username: str) -> bool:
    """发送密码重置邮件"""
    subject = "颐智康养 — 密码重置"
    html_body = f"""
    <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">
      <div style="text-align:center;padding:20px;background:#1677ff;color:#fff;border-radius:8px 8px 0 0">
        <h1>颐智康养</h1>
      </div>
      <div style="padding:30px;background:#fafafa;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 8px 8px">
        <p>您好，<strong>{username}</strong></p>
        <p>我们收到了您的密码重置请求。请点击下方按钮重置密码：</p>
        <p style="text-align:center;margin:30px 0">
          <a href="{reset_link}" style="display:inline-block;padding:12px 40px;background:#1677ff;color:#fff;text-decoration:none;border-radius:6px;font-size:16px">
            重置密码
          </a>
        </p>
        <p style="color:#8c8c8c;font-size:12px">
          此链接 1 小时内有效。如果这不是您的操作，请忽略此邮件。
        </p>
        <hr style="border:none;border-top:1px solid #e8e8e8;margin:20px 0">
        <p style="color:#8c8c8c;font-size:12px;text-align:center">
          颐智康养 — 养老机构数字化管理平台
        </p>
      </div>
    </div>
    """
    return send_email_async(to, subject, html_body) if is_configured() else False


def send_alert_notification(to: str, alert_type: str, elder_name: str, detail: str) -> bool:
    """发送告警通知邮件"""
    subject = f"颐智康养 — 告警通知: {alert_type}"
    html_body = f"""
    <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">
      <div style="text-align:center;padding:20px;background:#ff4d4f;color:#fff;border-radius:8px 8px 0 0">
        <h1 style="margin:0">⚠️ 告警通知</h1>
      </div>
      <div style="padding:30px;background:#fafafa;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 8px 8px">
        <p><strong>告警类型：</strong>{alert_type}</p>
        <p><strong>关联老人：</strong>{elder_name}</p>
        <p><strong>详情：</strong>{detail}</p>
        <p style="color:#8c8c8c;font-size:12px;margin-top:30px">
          请及时登录管理后台查看并处理。
        </p>
      </div>
    </div>
    """
    return send_email_async(to, subject, html_body) if is_configured() else False


def send_daily_report(to: str, date_str: str, stats: dict) -> bool:
    """发送每日统计报表邮件"""
    subject = f"颐智康养 — 每日报表 ({date_str})"
    html_body = f"""
    <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif">
      <div style="text-align:center;padding:20px;background:#1677ff;color:#fff;border-radius:8px 8px 0 0">
        <h1>📊 每日统计报表</h1>
        <p style="margin:5px 0 0;opacity:0.8">{date_str}</p>
      </div>
      <div style="padding:30px;background:#fafafa;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border-bottom:1px solid #e8e8e8">在住老人</td><td style="text-align:right;font-weight:bold">{stats.get("active_elders", 0)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e8e8e8">今日照护记录</td><td style="text-align:right;font-weight:bold">{stats.get("today_care_records", 0)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e8e8e8">今日告警</td><td style="text-align:right;font-weight:bold;color:{'#ff4d4f' if stats.get('today_alerts', 0) > 0 else '#52c41a'}">{stats.get("today_alerts", 0)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e8e8e8">待处理告警</td><td style="text-align:right;font-weight:bold;color:{'#ff4d4f' if stats.get('pending_alerts', 0) > 0 else '#52c41a'}">{stats.get("pending_alerts", 0)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e8e8e8">今日用药记录</td><td style="text-align:right;font-weight:bold">{stats.get("today_medications", 0)}</td></tr>
          <tr><td style="padding:8px">本月账单</td><td style="text-align:right;font-weight:bold">¥{stats.get("month_bills_total", 0):,.2f}</td></tr>
        </table>
      </div>
    </div>
    """
    return send_email_async(to, subject, html_body) if is_configured() else False
