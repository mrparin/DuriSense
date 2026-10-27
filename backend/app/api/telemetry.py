from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AuthContext, current_auth, require_admin
from app.api.errors import APIError
from app.db.session import get_db
from app.domains.telemetry import service
from app.domains.telemetry.schemas import (
    AdminTelemetryOverview,
    DataGapReportResponse,
    DeviceHealthDetailResponse,
    DeviceHealthResponse,
    FarmHealthSummaryResponse,
    LatestTelemetryResponse,
    OfflineCheckResult,
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
    interval: str = Query(default="raw", pattern="^(raw|5m|15m|1h|1d)$"),
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


@router.get("/devices/{device_id}/health/detail", response_model=DeviceHealthDetailResponse)
async def get_device_health_detail(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    result = await service.get_device_health_detail(db, device_id, auth.user)
    if not result:
        raise APIError(404, "DEVICE_NOT_FOUND", "Device not found or access denied")
    return result


@router.get("/farms/{farm_id}/health/summary", response_model=FarmHealthSummaryResponse)
async def get_farm_health_summary(
    farm_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    result = await service.get_farm_health_summary(db, farm_id, auth.user)
    if not result:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return result


@router.get("/farms/{farm_id}/health/data-gaps", response_model=DataGapReportResponse)
async def get_farm_data_gaps(
    farm_id: UUID,
    start_date: datetime | None = Query(default=None, description="Start date/time UTC"),
    end_date: datetime | None = Query(default=None, description="End date/time UTC"),
    threshold_minutes: int = Query(default=30, ge=5, le=1440, description="Minimum duration to qualify as data gap"),
    station_id: UUID | None = Query(default=None, description="Filter by specific station ID"),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    now = service.now_utc()
    actual_end = end_date or now
    actual_start = start_date or (actual_end - timedelta(hours=24))

    result = await service.get_farm_data_gaps(
        db=db,
        farm_id=farm_id,
        start_date=actual_start,
        end_date=actual_end,
        threshold_minutes=threshold_minutes,
        station_id=station_id,
        user=auth.user,
    )
    if not result:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return result


@router.post("/farms/{farm_id}/health/check-offline", response_model=OfflineCheckResult)
async def check_farm_offline(
    farm_id: UUID,
    timeout_seconds: int = Query(default=3600, ge=60, le=86400, description="Offline timeout threshold in seconds"),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    return await service.check_farm_offline_devices(
        db=db,
        farm_id=farm_id,
        timeout_seconds=timeout_seconds,
        user=auth.user,
    )


@router.get("/admin/telemetry/overview", response_model=AdminTelemetryOverview)
async def get_admin_telemetry_overview(
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(require_admin),
):
    result = await service.get_admin_telemetry_overview(db, auth.user)
    if not result:
        raise APIError(403, "ADMIN_REQUIRED", "Administrator permission is required")
    return result
