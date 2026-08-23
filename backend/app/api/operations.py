from uuid import UUID

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.dependencies import AuthContext, current_auth
from app.domains.operations import service
from app.domains.operations.schemas import (
    DispatchRelayCommandRequest,
    FarmActivityCreate,
    FarmActivityResponse,
    RelayChannelResponse,
    RelayCommandResponse,
)
from app.api.errors import APIError

router = APIRouter(tags=["Operations"])


@router.get("/farms/{farm_id}/relays", response_model=list[RelayChannelResponse])
async def get_farm_relays(
    farm_id: UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    channels = await service.get_farm_relay_channels(db, farm_id, auth.user)
    if channels is None:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return channels


@router.post("/farms/{farm_id}/relays/{channel_id}/command", response_model=RelayCommandResponse)
async def dispatch_relay_command(
    farm_id: UUID = Path(...),
    channel_id: UUID = Path(...),
    req: DispatchRelayCommandRequest = ...,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    cmd = await service.dispatch_relay_command(db, farm_id, channel_id, req, auth.user)
    if cmd is None:
        raise APIError(404, "RELAY_CHANNEL_NOT_FOUND", "Relay channel not found or access denied")
    return cmd


@router.get("/farms/{farm_id}/activities", response_model=list[FarmActivityResponse])
async def get_farm_activities(
    farm_id: UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    activities = await service.get_farm_activities(db, farm_id, auth.user)
    if activities is None:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return activities


@router.post("/farms/{farm_id}/activities", response_model=FarmActivityResponse, status_code=201)
async def create_farm_activity(
    farm_id: UUID = Path(...),
    req: FarmActivityCreate = ...,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    activity = await service.create_farm_activity(db, farm_id, req, auth.user)
    if activity is None:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return activity


@router.delete("/farms/{farm_id}/activities/{activity_id}", status_code=204)
async def delete_farm_activity(
    farm_id: UUID = Path(...),
    activity_id: UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    success = await service.delete_farm_activity(db, farm_id, activity_id, auth.user)
    if not success:
        raise APIError(404, "ACTIVITY_NOT_FOUND", "Farm activity not found or access denied")
    return None
