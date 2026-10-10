"""create alert rules, alert events, and notification preferences tables

Revision ID: 20260824_11
Revises: 20260823_10
Create Date: 2026-08-24 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260824_11'
down_revision = '20260823_10'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create Enums
    alert_severity = postgresql.ENUM('INFO', 'WARNING', 'CRITICAL', name='alertseverity')
    alert_severity.create(op.get_bind(), checkfirst=True)

    alert_state = postgresql.ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', name='alertstate')
    alert_state.create(op.get_bind(), checkfirst=True)

    # 2. Create alert_rules
    op.create_table(
        'alert_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('farm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('farms.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('plot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('plots.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('station_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('metric_type', sa.String(length=50), nullable=False),
        sa.Column('operator', sa.String(length=30), nullable=False),
        sa.Column('threshold_min', sa.Float(), nullable=True),
        sa.Column('threshold_max', sa.Float(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hysteresis', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('severity', postgresql.ENUM('INFO', 'WARNING', 'CRITICAL', name='alertseverity', create_type=False), nullable=False, server_default='WARNING'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notify_channels', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='["IN_APP"]'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 3. Create alert_events
    op.create_table(
        'alert_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('farm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('farms.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('alert_rules.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('station_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('plot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('plots.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('severity', postgresql.ENUM('INFO', 'WARNING', 'CRITICAL', name='alertseverity', create_type=False), nullable=False, server_default='WARNING'),
        sa.Column('state', postgresql.ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', name='alertstate', create_type=False), nullable=False, server_default='OPEN', index=True),
        sa.Column('triggered_value', sa.Float(), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('acknowledged_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledge_note', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolve_reason', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 4. Create notification_preferences
    op.create_table(
        'notification_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('email_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('in_app_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('quiet_hours_start', sa.String(length=5), nullable=True),
        sa.Column('quiet_hours_end', sa.String(length=5), nullable=True),
        sa.Column('min_severity', postgresql.ENUM('INFO', 'WARNING', 'CRITICAL', name='alertseverity', create_type=False), nullable=False, server_default='INFO'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('notification_preferences')
    op.drop_table('alert_events')
    op.drop_table('alert_rules')
    op.execute('DROP TYPE IF EXISTS alertstate')
    op.execute('DROP TYPE IF EXISTS alertseverity')
