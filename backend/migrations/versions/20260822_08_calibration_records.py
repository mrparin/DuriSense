"""Add calibration_records table for soil sensor calibration metadata."""

from alembic import op

from app.db.base import Base
from app.domains.identity import models as identity_models  # noqa: F401
from app.domains.registry import models as registry_models  # noqa: F401

revision = "20260822_08"
down_revision = "20260820_07"
branch_labels = None
depends_on = None

TABLE_NAME = "calibration_records"


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.tables[TABLE_NAME].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.tables[TABLE_NAME].drop(bind=bind, checkfirst=True)
