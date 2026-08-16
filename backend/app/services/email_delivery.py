import asyncio
import json
import smtplib
from datetime import timedelta
from email.message import EmailMessage
from urllib.parse import quote

from sqlalchemy import or_, select

from app.core.config import Settings
from app.core.security import decrypt_secret
from app.db.session import SessionLocal
from app.domains.identity.models import EmailOutbox
from app.domains.identity.service import now_utc


def render_email(item: EmailOutbox, settings: Settings) -> tuple[str, str]:
    payload = json.loads(decrypt_secret(item.payload["encrypted"], settings.secret_key))
    app_url = settings.public_app_url.rstrip("/")
    templates = {
        "verify_email": (
            "ยืนยันอีเมล DuriSense",
            f"ยืนยันอีเมลเพื่อเปิดใช้งานบัญชี: {app_url}/verify-email?token={quote(payload['token'])}",
        ),
        "reset_password": (
            "ตั้งรหัสผ่าน DuriSense ใหม่",
            f"ตั้งรหัสผ่านใหม่ภายในเวลาที่กำหนด: {app_url}/reset-password?token={quote(payload['token'])}",
        ),
        "account_activated": ("บัญชี DuriSense พร้อมใช้งาน", "บัญชีของคุณได้รับการเปิดใช้งานแล้ว สามารถเข้าสู่ระบบได้"),
        "account_rejected": ("ผลการตรวจสอบบัญชี DuriSense", f"บัญชียังไม่ได้รับการอนุมัติ เหตุผล: {payload.get('reason') or 'กรุณาติดต่อผู้ดูแลระบบ'}"),
        "registration_status": ("สถานะการสมัคร DuriSense", f"สถานะบัญชีปัจจุบัน: {payload.get('status', 'ไม่ทราบสถานะ')}"),
        "password_changed": ("รหัสผ่าน DuriSense ถูกเปลี่ยน", "รหัสผ่านบัญชีของคุณถูกเปลี่ยนแล้ว หากไม่ได้ดำเนินการ กรุณาติดต่อผู้ดูแลระบบ"),
    }
    return templates.get(item.template, ("ข้อความจาก DuriSense", "มีการอัปเดตข้อมูลบัญชี DuriSense ของคุณ"))


def send_smtp(recipient: str, subject: str, body: str, settings: Settings) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP is not configured")
    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_starttls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password or "")
        smtp.send_message(message)


async def deliver_pending_emails(settings: Settings, sender=send_smtp, batch_size: int = 20) -> int:
    delivered = 0
    async with SessionLocal() as db:
        due = (await db.scalars(select(EmailOutbox).where(
            EmailOutbox.sent_at.is_(None),
            or_(EmailOutbox.next_attempt_at.is_(None), EmailOutbox.next_attempt_at <= now_utc()),
        ).order_by(EmailOutbox.created_at).limit(batch_size))).all()
        for item in due:
            if "encrypted" not in item.payload:
                item.payload = {"retired": True}
                item.sent_at = now_utc()
                item.last_error = "Legacy plaintext payload retired"
                continue
            try:
                subject, body = render_email(item, settings)
                await asyncio.to_thread(sender, item.recipient, subject, body, settings)
                item.sent_at = now_utc()
                item.last_error = None
                delivered += 1
            except Exception as exc:
                item.attempt_count += 1
                item.last_error = str(exc)[:500]
                delay_minutes = min(60, 2 ** min(item.attempt_count, 6))
                item.next_attempt_at = now_utc() + timedelta(minutes=delay_minutes)
        await db.commit()
    return delivered


async def email_worker(settings: Settings) -> None:
    while True:
        await deliver_pending_emails(settings)
        await asyncio.sleep(settings.email_poll_seconds)
