"""Add the Phase 1C farm and device registry."""

from alembic import op

from app.db.base import Base
from app.domains.identity import models as identity_models  # noqa: F401
from app.domains.registry import models as registry_models  # noqa: F401

revision = "20260820_06"
down_revision = "20260816_05"
branch_labels = None
depends_on = None

TABLES = (
    "farms",
    "farm_memberships",
    "plots",
    "devices",
    "weather_stations",
    "soil_sensors",
    "sensor_assignments",
    "device_credentials",
    "decommission_records",
)


def upgrade() -> None:
    bind = op.get_bind()
    for name in TABLES:
        Base.metadata.tables[name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for name in reversed(TABLES):
        Base.metadata.tables[name].drop(bind=bind, checkfirst=True)
