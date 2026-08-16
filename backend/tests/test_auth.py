import pyotp
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import encrypt_secret, hash_password
from app.db.session import SessionLocal
from app.domains.identity.models import AccountStatus, ActivationMethod, EmailOutbox, RoleCode, Session, User
from app.domains.identity.service import ensure_roles
from app.services.email_delivery import deliver_pending_emails


REGISTRATION = {
    "full_name": "Farmer One",
    "email": "farmer1@example.com",
    "phone": "0812345678",
    "password": "StrongPass123",
    "password_confirmation": "StrongPass123",
    "farm_name": "Orchard One",
    "accept_terms": True,
}


async def register_and_activate(client, registration=None):
    payload = registration or REGISTRATION
    registered = await client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code == 201
    token = registered.json()["verification_token"]
    verified = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verified.status_code == 200
    return registered


async def login(client, email="farmer1@example.com", password="StrongPass123", otp=None):
    body = {"email": email, "password": password}
    if otp:
        body["otp"] = otp
    return await client.post("/api/v1/auth/login", json=body)


async def test_register_verify_login_and_csrf_logout(client):
    registered = await client.post("/api/v1/auth/register", json=REGISTRATION)
    assert registered.status_code == 201
    assert registered.json()["status"] == "PENDING_VERIFICATION"

    blocked = await login(client)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "ACCOUNT_PENDING_VERIFICATION"

    token = registered.json()["verification_token"]
    verified = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verified.status_code == 200
    reused = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert reused.status_code == 400
    assert reused.json()["code"] == "TOKEN_USED"

    authenticated = await login(client)
    assert authenticated.status_code == 200
    csrf = authenticated.json()["csrf_token"]
    assert client.cookies.get("durisense_session")

    rejected = await client.post("/api/v1/auth/logout")
    assert rejected.status_code == 403
    logged_out = await client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf, "Origin": "http://localhost:3000"})
    assert logged_out.status_code == 200


async def test_password_reset_revokes_existing_sessions(client):
    await register_and_activate(client)
    authenticated = await login(client)
    assert authenticated.status_code == 200
    old_session = client.cookies.get("durisense_session")

    forgot = await client.post("/api/v1/auth/password/forgot", json={"email": REGISTRATION["email"]})
    token = forgot.json()["development_token"]
    reset = await client.post("/api/v1/auth/password/reset", json={
        "token": token,
        "password": "NewStrongPass456",
        "password_confirmation": "NewStrongPass456",
    })
    assert reset.status_code == 200
    client.cookies.set("durisense_session", old_session)
    invalidated = await client.get("/api/v1/auth/session")
    assert invalidated.status_code == 401


async def test_admin_requires_totp_and_can_approve(client):
    pending = await client.post("/api/v1/auth/register", json=REGISTRATION)
    assert pending.status_code == 201
    secret = pyotp.random_base32()
    async with SessionLocal() as db:
        roles = await ensure_roles(db)
        admin = User(
            email="admin@example.com",
            full_name="Admin",
            password_hash=hash_password("AdminStrong123"),
            status=AccountStatus.ACTIVE,
            activation_method=ActivationMethod.ADMIN_APPROVAL,
            mfa_secret=encrypt_secret(secret, get_settings().secret_key),
            roles=[roles[RoleCode.ADMIN]],
        )
        db.add(admin)
        await db.commit()

    without_mfa = await login(client, "admin@example.com", "AdminStrong123")
    assert without_mfa.status_code == 401
    admin_login = await login(client, "admin@example.com", "AdminStrong123", pyotp.TOTP(secret).now())
    assert admin_login.status_code == 200
    csrf = admin_login.json()["csrf_token"]
    pending_users = await client.get("/api/v1/admin/users/pending")
    user_id = next(item["id"] for item in pending_users.json() if item["email"] == REGISTRATION["email"])
    approved = await client.post(
        f"/api/v1/admin/users/{user_id}/approve",
        json={"reason": "Identity reviewed"},
        headers={"X-CSRF-Token": csrf, "Origin": "http://localhost:3000"},
    )
    assert approved.status_code == 200

    headers = {"X-CSRF-Token": csrf, "Origin": "http://localhost:3000"}
    setup = await client.post("/api/v1/auth/mfa/setup", headers=headers)
    assert setup.status_code == 200
    setup_body = setup.json()
    confirmed = await client.post("/api/v1/auth/mfa/confirm", json={
        "challenge_token": setup_body["challenge_token"],
        "otp": pyotp.TOTP(setup_body["secret"]).now(),
    }, headers=headers)
    assert confirmed.status_code == 200
    recovery_code = confirmed.json()["recovery_codes"][0]

    logged_out = await client.post("/api/v1/auth/logout", headers=headers)
    assert logged_out.status_code == 200
    recovered = await client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "AdminStrong123",
        "recovery_code": recovery_code,
    })
    assert recovered.status_code == 200
    client.cookies.clear()

    client.cookies.clear()
    farmer_login = await login(client)
    assert farmer_login.status_code == 200


async def test_outbox_encrypts_tokens_and_delivers_with_sender(client):
    registered = await client.post("/api/v1/auth/register", json={**REGISTRATION, "email": "mail@example.com"})
    token = registered.json()["verification_token"]
    async with SessionLocal() as db:
        item = await db.scalar(select(EmailOutbox).where(EmailOutbox.recipient == "mail@example.com"))
        assert item is not None
        assert token not in str(item.payload)

    sent = []

    def fake_sender(recipient, subject, body, settings):
        sent.append((recipient, subject, body))

    delivered = await deliver_pending_emails(get_settings(), sender=fake_sender)
    assert delivered == 1
    assert sent[0][0] == "mail@example.com"
    assert token in sent[0][2]


async def test_account_locks_after_repeated_invalid_passwords(client):
    await register_and_activate(client)
    for _ in range(5):
        response = await login(client, password="wrong-password")
        assert response.status_code == 401
    locked = await login(client)
    assert locked.status_code == 429
    assert locked.json()["code"] == "ACCOUNT_LOCKED"
