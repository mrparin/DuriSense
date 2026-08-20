from datetime import timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AuthContext, csrf_protected, current_auth
from app.api.errors import APIError
from app.core.config import Settings, get_settings
from app.core.security import random_token, token_hash
from app.db.session import get_db
from app.domains.identity.models import Membership
from app.domains.identity.schemas import GenericResponse
from app.domains.identity.service import audit, now_utc
from app.domains.registry.models import (
    DecommissionRecord,
    Device,
    DeviceCredential,
    DeviceKind,
    DeviceStatus,
    Farm,
    FarmMembership,
    FarmRole,
    FarmStatus,
    Plot,
    SensorAssignment,
    SoilSensor,
    WeatherStation,
)
from app.domains.registry.schemas import (
    AssignmentCreate,
    AssignmentResponse,
    CredentialResponse,
    DecommissionRequest,
    DeviceResponse,
    DeviceUpdate,
    FarmCreate,
    FarmResponse,
    FarmUpdate,
    PlotCreate,
    PlotResponse,
    PlotUpdate,
    SoilSensorCreate,
    WeatherStationCreate,
)

router = APIRouter(tags=["Farm and Device Registry"])
MANAGER_ROLES = {FarmRole.OWNER, FarmRole.MANAGER}


def clean(value: str | None) -> str | None:
    return value.strip() if value and value.strip() else None


def as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


async def tenant_access(tenant_id: UUID, user_id: UUID, db: AsyncSession) -> Membership:
    item = await db.scalar(select(Membership).where(
        Membership.tenant_id == tenant_id,
        Membership.user_id == user_id,
        Membership.active.is_(True),
    ))
    if item is None:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Resource was not found")
    return item


async def farm_access(farm_id: UUID, user_id: UUID, db: AsyncSession, *, manage: bool = False) -> tuple[Farm, FarmMembership]:
    row = (await db.execute(
        select(Farm, FarmMembership)
        .join(FarmMembership, FarmMembership.farm_id == Farm.id)
        .where(Farm.id == farm_id, FarmMembership.user_id == user_id, FarmMembership.active.is_(True))
    )).first()
    if row is None:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Resource was not found")
    farm, membership = row
    if manage and membership.role not in MANAGER_ROLES:
        raise APIError(403, "FARM_MANAGER_REQUIRED", "Farm manager permission is required")
    return farm, membership


async def plot_in_farm(plot_id: UUID | None, farm: Farm, db: AsyncSession) -> Plot | None:
    if plot_id is None:
        return None
    plot = await db.scalar(select(Plot).where(Plot.id == plot_id, Plot.farm_id == farm.id, Plot.active.is_(True)))
    if plot is None:
        raise APIError(404, "PLOT_NOT_FOUND", "Plot was not found")
    return plot


async def device_access(device_id: UUID, user_id: UUID, db: AsyncSession, *, manage: bool = False) -> tuple[Device, Farm]:
    device = await db.scalar(select(Device).where(Device.id == device_id))
    if device is None:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Resource was not found")
    farm, _ = await farm_access(device.farm_id, user_id, db, manage=manage)
    return device, farm


def farm_response(farm: Farm, membership: FarmMembership) -> FarmResponse:
    return FarmResponse(
        id=farm.id, tenant_id=farm.tenant_id, name=farm.name, timezone=farm.timezone,
        province=farm.province, district=farm.district, subdistrict=farm.subdistrict,
        status=farm.status, membership_role=membership.role, created_at=farm.created_at,
    )


def device_response(device: Device) -> DeviceResponse:
    station = device.weather_station if device.kind == DeviceKind.WEATHER_STATION else None
    sensor = device.soil_sensor if device.kind == DeviceKind.SOIL_SENSOR else None
    return DeviceResponse(
        id=device.id, tenant_id=device.tenant_id, farm_id=device.farm_id, plot_id=device.plot_id,
        device_code=device.device_code, display_name=device.display_name, kind=device.kind,
        status=device.status, firmware_version=device.firmware_version, last_seen_at=device.last_seen_at,
        sensor_type=sensor.sensor_type if sensor else None,
        modbus_address=sensor.modbus_address if sensor else None,
        model=station.model if station else None,
        serial_number=station.serial_number if station else None,
        created_at=device.created_at,
    )


@router.get("/farms", response_model=list[FarmResponse])
async def list_farms(auth: AuthContext = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Farm, FarmMembership)
        .join(FarmMembership, FarmMembership.farm_id == Farm.id)
        .where(FarmMembership.user_id == auth.user.id, FarmMembership.active.is_(True))
        .order_by(Farm.name)
    )).all()
    return [farm_response(farm, membership) for farm, membership in rows]


@router.post("/farms", response_model=FarmResponse, status_code=201)
async def create_farm(payload: FarmCreate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    await tenant_access(payload.tenant_id, auth.user.id, db)
    name = payload.name.strip()
    if await db.scalar(select(Farm.id).where(Farm.tenant_id == payload.tenant_id, Farm.name == name)):
        raise APIError(409, "FARM_NAME_EXISTS", "A farm with this name already exists")
    farm = Farm(
        tenant_id=payload.tenant_id, name=name, timezone=payload.timezone,
        province=clean(payload.province), district=clean(payload.district), subdistrict=clean(payload.subdistrict),
    )
    db.add(farm)
    await db.flush()
    membership = FarmMembership(tenant_id=farm.tenant_id, farm_id=farm.id, user_id=auth.user.id, role=FarmRole.OWNER)
    db.add(membership)
    await audit(db, request.state.request_id, "registry.farm_created", "farm", farm.id, actor_id=auth.user.id, tenant_id=farm.tenant_id)
    await db.commit()
    return farm_response(farm, membership)


@router.get("/farms/{farm_id}", response_model=FarmResponse)
async def read_farm(farm_id: UUID, auth: AuthContext = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    farm, membership = await farm_access(farm_id, auth.user.id, db)
    return farm_response(farm, membership)


@router.patch("/farms/{farm_id}", response_model=FarmResponse)
async def update_farm(farm_id: UUID, payload: FarmUpdate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    farm, membership = await farm_access(farm_id, auth.user.id, db, manage=True)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = payload.name.strip()
        duplicate = await db.scalar(select(Farm.id).where(Farm.tenant_id == farm.tenant_id, Farm.name == changes["name"], Farm.id != farm.id))
        if duplicate:
            raise APIError(409, "FARM_NAME_EXISTS", "A farm with this name already exists")
    for field in ("province", "district", "subdistrict"):
        if field in changes:
            changes[field] = clean(changes[field])
    for field, value in changes.items():
        setattr(farm, field, value)
    await audit(db, request.state.request_id, "registry.farm_updated", "farm", farm.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"fields": list(changes)})
    await db.commit()
    return farm_response(farm, membership)


@router.delete("/farms/{farm_id}", response_model=GenericResponse)
async def archive_farm(farm_id: UUID, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    farm, _ = await farm_access(farm_id, auth.user.id, db, manage=True)
    farm.status = FarmStatus.ARCHIVED
    await audit(db, request.state.request_id, "registry.farm_archived", "farm", farm.id, actor_id=auth.user.id, tenant_id=farm.tenant_id)
    await db.commit()
    return GenericResponse(message="Farm archived")


@router.get("/farms/{farm_id}/plots", response_model=list[PlotResponse])
async def list_plots(farm_id: UUID, include_inactive: bool = False, auth: AuthContext = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    await farm_access(farm_id, auth.user.id, db)
    query = select(Plot).where(Plot.farm_id == farm_id).order_by(Plot.name)
    if not include_inactive:
        query = query.where(Plot.active.is_(True))
    return (await db.scalars(query)).all()


@router.post("/farms/{farm_id}/plots", response_model=PlotResponse, status_code=201)
async def create_plot(farm_id: UUID, payload: PlotCreate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    farm, _ = await farm_access(farm_id, auth.user.id, db, manage=True)
    name = payload.name.strip()
    if await db.scalar(select(Plot.id).where(Plot.farm_id == farm.id, Plot.name == name)):
        raise APIError(409, "PLOT_NAME_EXISTS", "A plot with this name already exists")
    plot = Plot(tenant_id=farm.tenant_id, farm_id=farm.id, name=name, area_rai=payload.area_rai, crop_variety=clean(payload.crop_variety), notes=clean(payload.notes))
    db.add(plot)
    await db.flush()
    await audit(db, request.state.request_id, "registry.plot_created", "plot", plot.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"farm_id": str(farm.id)})
    await db.commit()
    return plot


@router.patch("/plots/{plot_id}", response_model=PlotResponse)
async def update_plot(plot_id: UUID, payload: PlotUpdate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    plot = await db.scalar(select(Plot).where(Plot.id == plot_id))
    if plot is None:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Resource was not found")
    farm, _ = await farm_access(plot.farm_id, auth.user.id, db, manage=True)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = payload.name.strip()
    for field in ("crop_variety", "notes"):
        if field in changes:
            changes[field] = clean(changes[field])
    for field, value in changes.items():
        setattr(plot, field, value)
    await audit(db, request.state.request_id, "registry.plot_updated", "plot", plot.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"fields": list(changes)})
    await db.commit()
    return plot


@router.delete("/plots/{plot_id}", response_model=GenericResponse)
async def archive_plot(plot_id: UUID, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    plot = await db.scalar(select(Plot).where(Plot.id == plot_id))
    if plot is None:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Resource was not found")
    farm, _ = await farm_access(plot.farm_id, auth.user.id, db, manage=True)
    plot.active = False
    await audit(db, request.state.request_id, "registry.plot_archived", "plot", plot.id, actor_id=auth.user.id, tenant_id=farm.tenant_id)
    await db.commit()
    return GenericResponse(message="Plot archived")


async def ensure_device_code(farm: Farm, code: str, db: AsyncSession) -> str:
    normalized = code.strip()
    if await db.scalar(select(Device.id).where(Device.tenant_id == farm.tenant_id, Device.device_code == normalized)):
        raise APIError(409, "DEVICE_CODE_EXISTS", "Device code already exists")
    return normalized


@router.get("/devices", response_model=list[DeviceResponse])
async def list_devices(farm_id: UUID, kind: DeviceKind | None = None, include_decommissioned: bool = False, auth: AuthContext = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    await farm_access(farm_id, auth.user.id, db)
    query = select(Device).where(Device.farm_id == farm_id).order_by(Device.kind, Device.display_name)
    if kind:
        query = query.where(Device.kind == kind)
    if not include_decommissioned:
        query = query.where(Device.status == DeviceStatus.ACTIVE)
    return [device_response(item) for item in (await db.scalars(query)).unique().all()]


@router.post("/weather-stations", response_model=DeviceResponse, status_code=201)
async def create_weather_station(payload: WeatherStationCreate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    farm, _ = await farm_access(payload.farm_id, auth.user.id, db, manage=True)
    await plot_in_farm(payload.plot_id, farm, db)
    device = Device(
        tenant_id=farm.tenant_id, farm_id=farm.id, plot_id=payload.plot_id,
        device_code=await ensure_device_code(farm, payload.device_code, db), display_name=payload.display_name.strip(),
        kind=DeviceKind.WEATHER_STATION, firmware_version=clean(payload.firmware_version),
    )
    device.weather_station = WeatherStation(model=clean(payload.model), serial_number=clean(payload.serial_number))
    db.add(device)
    await db.flush()
    await audit(db, request.state.request_id, "registry.weather_station_created", "device", device.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"farm_id": str(farm.id)})
    await db.commit()
    return device_response(device)


@router.post("/soil-sensors", response_model=DeviceResponse, status_code=201)
async def create_soil_sensor(payload: SoilSensorCreate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    farm, _ = await farm_access(payload.farm_id, auth.user.id, db, manage=True)
    await plot_in_farm(payload.plot_id, farm, db)
    device = Device(
        tenant_id=farm.tenant_id, farm_id=farm.id, plot_id=payload.plot_id,
        device_code=await ensure_device_code(farm, payload.device_code, db), display_name=payload.display_name.strip(),
        kind=DeviceKind.SOIL_SENSOR, firmware_version=clean(payload.firmware_version),
    )
    device.soil_sensor = SoilSensor(sensor_type=payload.sensor_type, modbus_address=payload.modbus_address)
    db.add(device)
    await db.flush()
    await audit(db, request.state.request_id, "registry.soil_sensor_created", "device", device.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"farm_id": str(farm.id), "sensor_type": payload.sensor_type.value})
    await db.commit()
    return device_response(device)


@router.get("/devices/{device_id}", response_model=DeviceResponse)
async def read_device(device_id: UUID, auth: AuthContext = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    device, _ = await device_access(device_id, auth.user.id, db)
    return device_response(device)


@router.patch("/devices/{device_id}", response_model=DeviceResponse)
async def update_device(device_id: UUID, payload: DeviceUpdate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    device, farm = await device_access(device_id, auth.user.id, db, manage=True)
    changes = payload.model_dump(exclude_unset=True)
    if "plot_id" in changes:
        await plot_in_farm(changes["plot_id"], farm, db)
    if "display_name" in changes:
        changes["display_name"] = payload.display_name.strip()
    if "firmware_version" in changes:
        changes["firmware_version"] = clean(changes["firmware_version"])
    for field, value in changes.items():
        setattr(device, field, value)
    await audit(db, request.state.request_id, "registry.device_updated", "device", device.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"fields": list(changes)})
    await db.commit()
    return device_response(device)


@router.post("/sensor-assignments", response_model=AssignmentResponse, status_code=201)
async def assign_sensor(payload: AssignmentCreate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    sensor, farm = await device_access(payload.sensor_id, auth.user.id, db, manage=True)
    station, station_farm = await device_access(payload.station_id, auth.user.id, db, manage=True)
    if sensor.kind != DeviceKind.SOIL_SENSOR or station.kind != DeviceKind.WEATHER_STATION or station_farm.id != farm.id:
        raise APIError(422, "ASSIGNMENT_INVALID", "Sensor and station must be active devices in the same farm")
    if sensor.status != DeviceStatus.ACTIVE or station.status != DeviceStatus.ACTIVE:
        raise APIError(409, "DEVICE_INACTIVE", "Decommissioned devices cannot be assigned")
    await plot_in_farm(payload.plot_id, farm, db)
    start = as_utc(payload.valid_from)
    current = await db.scalar(select(SensorAssignment).where(SensorAssignment.sensor_id == sensor.id, SensorAssignment.valid_to.is_(None)))
    if current:
        if as_utc(current.valid_from) >= start:
            raise APIError(409, "ASSIGNMENT_OVERLAP", "Assignment start must be after the current assignment")
        current.valid_to = start
    assignment = SensorAssignment(
        tenant_id=farm.tenant_id, farm_id=farm.id, plot_id=payload.plot_id,
        sensor_id=sensor.id, station_id=station.id, valid_from=start,
        installation_depth_cm=payload.installation_depth_cm, installed_by=auth.user.id, note=clean(payload.note),
    )
    sensor.plot_id = payload.plot_id
    db.add(assignment)
    await db.flush()
    await audit(db, request.state.request_id, "registry.sensor_assigned", "sensor_assignment", assignment.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"sensor_id": str(sensor.id), "station_id": str(station.id), "plot_id": str(payload.plot_id)})
    await db.commit()
    return assignment


@router.get("/sensor-assignments", response_model=list[AssignmentResponse])
async def list_assignments(sensor_id: UUID, auth: AuthContext = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    sensor, _ = await device_access(sensor_id, auth.user.id, db)
    if sensor.kind != DeviceKind.SOIL_SENSOR:
        raise APIError(422, "SENSOR_REQUIRED", "A soil sensor is required")
    return (await db.scalars(select(SensorAssignment).where(SensorAssignment.sensor_id == sensor.id).order_by(SensorAssignment.valid_from.desc()))).all()


@router.post("/weather-stations/{device_id}/credentials", response_model=CredentialResponse, status_code=201)
async def rotate_station_credential(device_id: UUID, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    device, farm = await device_access(device_id, auth.user.id, db, manage=True)
    if device.kind != DeviceKind.WEATHER_STATION or device.status != DeviceStatus.ACTIVE:
        raise APIError(409, "CREDENTIAL_UNAVAILABLE", "Credential can only be issued to an active weather station")
    await db.execute(update(DeviceCredential).where(DeviceCredential.device_id == device.id, DeviceCredential.revoked_at.is_(None)).values(revoked_at=now_utc()))
    secret = random_token()
    credential = DeviceCredential(device_id=device.id, secret_hash=token_hash(secret, settings.secret_key), issued_by=auth.user.id, created_at=now_utc())
    db.add(credential)
    await db.flush()
    await audit(db, request.state.request_id, "registry.device_credential_rotated", "device", device.id, actor_id=auth.user.id, tenant_id=farm.tenant_id)
    await db.commit()
    return CredentialResponse(credential_id=credential.id, device_id=device.id, secret=secret, message="Copy this credential now; it will not be shown again")


@router.delete("/devices/{device_id}", response_model=GenericResponse)
async def decommission_device(device_id: UUID, payload: DecommissionRequest, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    device, farm = await device_access(device_id, auth.user.id, db, manage=True)
    if device.status == DeviceStatus.DECOMMISSIONED:
        raise APIError(409, "DEVICE_ALREADY_DECOMMISSIONED", "Device is already decommissioned")
    timestamp = now_utc()
    device.status = DeviceStatus.DECOMMISSIONED
    await db.execute(update(DeviceCredential).where(DeviceCredential.device_id == device.id, DeviceCredential.revoked_at.is_(None)).values(revoked_at=timestamp))
    if device.kind == DeviceKind.SOIL_SENSOR:
        await db.execute(update(SensorAssignment).where(SensorAssignment.sensor_id == device.id, SensorAssignment.valid_to.is_(None)).values(valid_to=timestamp))
    else:
        await db.execute(update(SensorAssignment).where(SensorAssignment.station_id == device.id, SensorAssignment.valid_to.is_(None)).values(valid_to=timestamp))
    db.add(DecommissionRecord(device_id=device.id, actor_id=auth.user.id, reason=payload.reason.strip(), created_at=timestamp))
    await audit(db, request.state.request_id, "registry.device_decommissioned", "device", device.id, actor_id=auth.user.id, tenant_id=farm.tenant_id, detail={"reason": payload.reason.strip()})
    await db.commit()
    return GenericResponse(message="Device decommissioned")
