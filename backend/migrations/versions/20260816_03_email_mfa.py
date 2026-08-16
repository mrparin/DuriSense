"""Add email delivery state and administrator MFA lifecycle."""

import sqlalchemy as sa
from alembic import op

from app.db.base import Base
from app.domains.identity import models  # noqa: F401

revision = "20260816_03"
down_revision = "20260816_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("email_outbox", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("email_outbox", sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("email_outbox", sa.Column("last_error", sa.String(length=500), nullable=True))
    op.create_index("ix_email_outbox_next_attempt_at", "email_outbox", ["next_attempt_at"])
    Base.metadata.tables["mfa_enrollments"].create(bind=op.get_bind(), checkfirst=True)
    Base.metadata.tables["mfa_recovery_codes"].create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    Base.metadata.tables["mfa_recovery_codes"].drop(bind=op.get_bind(), checkfirst=True)
    Base.metadata.tables["mfa_enrollments"].drop(bind=op.get_bind(), checkfirst=True)
    op.drop_index("ix_email_outbox_next_attempt_at", table_name="email_outbox")
    op.drop_column("email_outbox", "last_error")
    op.drop_column("email_outbox", "next_attempt_at")
    op.drop_column("email_outbox", "attempt_count")
