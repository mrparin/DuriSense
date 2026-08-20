"""Backfill a first farm for tenants registered before Phase 1C."""

from alembic import op

revision = "20260820_07"
down_revision = "20260820_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO farms (id, tenant_id, name, timezone, status, created_at, updated_at)
        SELECT gen_random_uuid(), tenants.id, tenants.name, 'Asia/Bangkok', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM tenants
        WHERE NOT EXISTS (SELECT 1 FROM farms WHERE farms.tenant_id = tenants.id)
    """)
    op.execute("""
        INSERT INTO farm_memberships (id, tenant_id, farm_id, user_id, role, active, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            memberships.tenant_id,
            farms.id,
            memberships.user_id,
            CASE WHEN ROW_NUMBER() OVER (PARTITION BY memberships.tenant_id, farms.id ORDER BY memberships.created_at, memberships.id) = 1
                THEN 'OWNER' ELSE 'MEMBER' END,
            memberships.active,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM memberships
        JOIN farms ON farms.tenant_id = memberships.tenant_id
        WHERE NOT EXISTS (
            SELECT 1 FROM farm_memberships
            WHERE farm_memberships.farm_id = farms.id
              AND farm_memberships.user_id = memberships.user_id
        )
    """)


def downgrade() -> None:
    # Backfilled rows are valid registry data and are intentionally preserved.
    pass
