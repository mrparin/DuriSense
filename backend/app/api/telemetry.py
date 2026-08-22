from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AuthContext, current_auth, require_admin
from app.api.errors import APIError
from app.db.session import get_db
from app.domains.telemetry import service
from app.domains.telemetry.schemas import (
    AdminTelemetryOverview,
    DeviceHealthResponse,
    LatestTelemetryResponse,
    TimeSeriesResponse,
)

router = APIRouter(tags=["telemetry"])


@router.get("/farms/{farm_id}/telemetry/latest", response_model=LatestTelemetryResponse)
async def get_latest_farm_telemetry(
    farm_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    result = await service.get_latest_telemetry(db, farm_id, auth.user)
    if not result:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return result


@router.get("/farms/{farm_id}/telemetry/series", response_model=TimeSeriesResponse)
async def get_farm_time_series(
    farm_id: UUID,
    metric_key: str = Query(..., description="e.g. air_temperature, soil_moisture, soil_ph, soil_ec"),
    device_id: UUID | None = Query(default=None),
    from_time: datetime | None = Query(default=None),
    to_time: datetime | None = Query(default=None),
    interval: str = Query(default="raw", pattern="^(raw|5m|1h|1d)$"),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    result = await service.get_time_series(db, farm_id, metric_key, device_id, from_time, to_time, interval, auth.user)
    if not result:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return result


@router.get("/devices/{device_id}/health", response_model=DeviceHealthResponse)
async def get_device_health_status(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    result = await service.get_device_health(db, device_id, auth.user)
    if not result:
        raise APIError(404, "DEVICE_NOT_FOUND", "Device not found or access denied")
    return result


@router.get("/admin/telemetry/overview", response_model=AdminTelemetryOverview)
async def get_admin_telemetry_overview(
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(require_admin),
):
    result = await service.get_admin_telemetry_overview(db, auth.user)
    if not result:
        raise APIError(403, "ADMIN_REQUIRED", "Administrator permission is required")
    return result
