"""Identity and tenant isolation baseline."""

from alembic import op

from app.db.base import Base
from app.domains.identity import models  # noqa: F401

revision = "20260816_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind(), checkfirst=True)
