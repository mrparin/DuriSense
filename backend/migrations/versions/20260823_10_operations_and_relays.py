"""create operations and relays tables

Revision ID: 20260823_10
Revises: 20260822_09
Create Date: 2026-08-23 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260823_10'
down_revision = '20260822_09'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create Enums
    relay_command_state = postgresql.ENUM('PENDING', 'ACKNOWLEDGED', 'FAILED', 'TIMEOUT', 'EXPIRED', 'STATE_MISMATCH', name='relaycommandstate')
    relay_command_state.create(op.get_bind(), checkfirst=True)

    activity_type = postgresql.ENUM('IRRIGATION', 'FERTILIZATION', 'PESTICIDE', 'PRUNING', 'HARVEST', 'OTHER', name='activitytype')
    activity_type.create(op.get_bind(), checkfirst=True)

    # 2. Create relay_channels
    op.create_table(
        'relay_channels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('farm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('farms.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('plot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('plots.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('station_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('channel_number', sa.Integer(), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('gpio_pin', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('desired_state', sa.String(length=10), nullable=False, server_default='OFF'),
        sa.Column('reported_state', sa.String(length=10), nullable=False, server_default='OFF'),
        sa.Column('last_command_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_ack_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 3. Create relay_commands
    op.create_table(
        'relay_commands',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('farm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('farms.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('relay_channels.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('issued_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('target_state', sa.String(length=10), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('state', postgresql.ENUM('PENDING', 'ACKNOWLEDGED', 'FAILED', 'TIMEOUT', 'EXPIRED', 'STATE_MISMATCH', name='relaycommandstate', create_type=False), nullable=False, server_default='PENDING'),
        sa.Column('failure_reason', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 4. Create relay_command_events
    op.create_table(
        'relay_command_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('command_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('relay_commands.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 5. Create farm_activities
    op.create_table(
        'farm_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('farm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('farms.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('plot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('plots.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('recorded_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('activity_type', postgresql.ENUM('IRRIGATION', 'FERTILIZATION', 'PESTICIDE', 'PRUNING', 'HARVEST', 'OTHER', name='activitytype', create_type=False), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('volume_liters', sa.Float(), nullable=True),
        sa.Column('product_name', sa.String(length=150), nullable=True),
        sa.Column('amount_kg', sa.Float(), nullable=True),
        sa.Column('harvest_weight_kg', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('farm_activities')
    op.drop_table('relay_command_events')
    op.drop_table('relay_commands')
    op.drop_table('relay_channels')
    op.execute('DROP TYPE IF EXISTS activitytype')
    op.execute('DROP TYPE IF EXISTS relaycommandstate')
