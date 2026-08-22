"""Add telemetry tables: sensor_readings, device_health_history, raw_mqtt_messages."""

from alembic import op

from app.db.base import Base
from app.domains.identity import models as identity_models  # noqa: F401
from app.domains.registry import models as registry_models  # noqa: F401
from app.domains.telemetry import models as telemetry_models  # noqa: F401

revision = "20260822_09"
down_revision = "20260822_08"
branch_labels = None
depends_on = None

TABLE_NAMES = ["sensor_readings", "device_health_history", "raw_mqtt_messages"]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in TABLE_NAMES:
        if table_name in Base.metadata.tables:
            Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(TABLE_NAMES):
        if table_name in Base.metadata.tables:
            Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
