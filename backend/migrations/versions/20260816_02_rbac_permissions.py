"""Add permission-backed RBAC tables."""

from alembic import op

from app.db.base import Base
from app.domains.identity import models  # noqa: F401

revision = "20260816_02"
down_revision = "20260816_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.tables["permissions"].create(bind=op.get_bind(), checkfirst=True)
    Base.metadata.tables["role_permissions"].create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    Base.metadata.tables["role_permissions"].drop(bind=op.get_bind(), checkfirst=True)
    Base.metadata.tables["permissions"].drop(bind=op.get_bind(), checkfirst=True)
