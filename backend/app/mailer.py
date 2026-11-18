"""Send enquiry emails through the business mailbox's SMTP server (e.g. Titan/GoDaddy).

Configure in .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO.
If not configured, `enabled()` is False and enquiries are only saved (never faked).
"""
import logging
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage

from . import config

log = logging.getLogger("saheli")
# Notifications are sent off the request path: a slow SMTP server must never make a customer wait.
_outbox = ThreadPoolExecutor(max_workers=4, thread_name_prefix="mail")


def enabled() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASS)


def send_later(to: str, subject: str, body: str, reply_to: str | None = None, what: str = "email") -> bool:
    """Queue an email; failures are logged (the order/enquiry itself is already saved). Returns False if mail is off."""
    if not (enabled() and to):
        return False

    def job() -> None:
        try:
            send(to, subject, body, reply_to)
        except Exception:  # noqa: BLE001 - logged; the record is safe in the database and dashboard
            log.exception("%s could not be sent", what)
    _outbox.submit(job)
    return True


def send(to: str, subject: str, body: str, reply_to: str | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = config.MAIL_FROM or config.SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    context = ssl.create_default_context()
    if config.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(config.SMTP_HOST, 465, context=context, timeout=20) as s:
            s.login(config.SMTP_USER, config.SMTP_PASS)
            s.send_message(msg)
    else:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as s:
            s.starttls(context=context)
            s.login(config.SMTP_USER, config.SMTP_PASS)
            s.send_message(msg)
