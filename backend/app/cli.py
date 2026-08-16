import argparse
import asyncio
import getpass

import pyotp
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import encrypt_secret, hash_password, normalize_email
from app.db.session import SessionLocal
from app.domains.identity.models import AccountStatus, ActivationMethod, RoleCode, User
from app.domains.identity.service import ensure_roles, now_utc, replace_recovery_codes


async def create_admin(email: str, full_name: str, password: str) -> None:
    settings = get_settings()
    normalized = normalize_email(email)
    async with SessionLocal() as db:
        if await db.scalar(select(User.id).where(User.email == normalized)):
            raise SystemExit("An account with this email already exists")
        roles = await ensure_roles(db)
        secret = pyotp.random_base32()
        admin = User(
            email=normalized,
            full_name=full_name,
            password_hash=hash_password(password),
            status=AccountStatus.ACTIVE,
            email_verified_at=now_utc(),
            admin_approved_at=now_utc(),
            activation_method=ActivationMethod.ADMIN_APPROVAL,
            mfa_secret=encrypt_secret(secret, settings.secret_key),
            roles=[roles[RoleCode.ADMIN]],
        )
        db.add(admin)
        await db.flush()
        recovery_codes = await replace_recovery_codes(db, admin, settings)
        await db.commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=normalized, issuer_name="DuriSense")
    print(f"Admin created: {normalized}")
    print(f"TOTP secret: {secret}")
    print(f"Provisioning URI: {uri}")
    print("Recovery codes (shown once):")
    print("\n".join(recovery_codes))


def main() -> None:
    parser = argparse.ArgumentParser(description="DuriSense administration commands")
    subparsers = parser.add_subparsers(dest="command", required=True)
    command = subparsers.add_parser("create-admin", help="Provision an administrator with MFA")
    command.add_argument("--email", required=True)
    command.add_argument("--name", default="DuriSense Administrator")
    args = parser.parse_args()
    password = getpass.getpass("Admin password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation or len(password) < 12:
        raise SystemExit("Passwords must match and contain at least 12 characters")
    asyncio.run(create_admin(args.email, args.name, password))


if __name__ == "__main__":
    main()
