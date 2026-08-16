"""Retire legacy plaintext outbox payloads."""

from alembic import op

revision = "20260816_05"
down_revision = "20260816_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE email_outbox
        SET payload = '{"retired": true}'::jsonb,
            sent_at = COALESCE(sent_at, NOW()),
            last_error = 'Legacy plaintext payload retired during encrypted outbox migration'
        WHERE NOT (payload::jsonb ? 'encrypted')
    """)


def downgrade() -> None:
    pass
