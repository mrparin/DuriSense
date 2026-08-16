"""Increase encrypted MFA secret capacity."""

import sqlalchemy as sa
from alembic import op

revision = "20260816_04"
down_revision = "20260816_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "mfa_secret", existing_type=sa.String(length=64), type_=sa.String(length=512), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("users", "mfa_secret", existing_type=sa.String(length=512), type_=sa.String(length=64), existing_nullable=True)
