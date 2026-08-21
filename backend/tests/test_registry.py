from copy import deepcopy
from uuid import UUID

from sqlalchemy import select

from app.db.session import SessionLocal
from app.domains.identity.models import Membership, User
from app.domains.registry.models import DeviceCredential, FarmMembership, SensorAssignment

from .test_auth import REGISTRATION, login, register_and_activate


def mutation_headers(csrf: str) -> dict[str, str]:
    return {"X-CSRF-Token": csrf, "Origin": "http://localhost:3000"}


async def register_tenant_colleague(client, owner_tenant_id: str, *, email: str, name: str, farm_name: str):
    payload = deepcopy(REGISTRATION)
    payload.update({"email": email, "full_name": name, "farm_name": farm_name})
    await register_and_activate(client, payload)
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        tenant_membership = await db.scalar(select(Membership).where(Membership.user_id == user.id))
        tenant_membership.tenant_id = UUID(owner_tenant_id)
        await db.commit()
    client.cookies.clear()
    return payload


async def test_farm_plot_device_assignment_and_decommission_lifecycle(client):
    await register_and_activate(client)
    authenticated = await login(client)
    csrf = authenticated.json()["csrf_token"]
    headers = mutation_headers(csrf)

    farms = await client.get("/api/v1/farms")
    assert farms.status_code == 200
    assert len(farms.json()) == 1
    farm = farms.json()[0]
    assert farm["name"] == REGISTRATION["farm_name"]
    assert farm["membership_role"] == "OWNER"

    plot = await client.post(
        f"/api/v1/farms/{farm['id']}/plots",
        json={"name": "Plot A", "area_rai": 12.5, "crop_variety": "Monthong"},
        headers=headers,
    )
    assert plot.status_code == 201
    plot_id = plot.json()["id"]

    station = await client.post("/api/v1/weather-stations", json={
        "farm_id": farm["id"], "plot_id": plot_id, "device_code": "WS-001",
        "display_name": "Weather Station A", "model": "DuriSense WS",
    }, headers=headers)
    assert station.status_code == 201

    sensor = await client.post("/api/v1/soil-sensors", json={
        "farm_id": farm["id"], "plot_id": plot_id, "device_code": "SOIL-001",
        "display_name": "Soil Sensor A", "sensor_type": "SOIL_7_IN_1", "modbus_address": 1,
    }, headers=headers)
    assert sensor.status_code == 201
    sensor_id = sensor.json()["id"]

    credential = await client.post(f"/api/v1/weather-stations/{station.json()['id']}/credentials", headers=headers)
    assert credential.status_code == 201
    assert credential.json()["secret"]
    async with SessionLocal() as db:
        stored = await db.scalar(select(DeviceCredential).where(DeviceCredential.id == UUID(credential.json()["credential_id"])))
        assert stored is not None
        assert stored.secret_hash != credential.json()["secret"]

    assignment = await client.post("/api/v1/sensor-assignments", json={
        "sensor_id": sensor_id, "station_id": station.json()["id"], "plot_id": plot_id,
        "installation_depth_cm": 30,
    }, headers=headers)
    assert assignment.status_code == 201
    history = await client.get(f"/api/v1/sensor-assignments?sensor_id={sensor_id}")
    assert history.status_code == 200
    assert len(history.json()) == 1

    missing_reason = await client.request("DELETE", f"/api/v1/devices/{sensor_id}", json={"reason": "x"}, headers=headers)
    assert missing_reason.status_code == 422
    decommissioned = await client.request("DELETE", f"/api/v1/devices/{sensor_id}", json={"reason": "Replaced after field inspection"}, headers=headers)
    assert decommissioned.status_code == 200
    device = await client.get(f"/api/v1/devices/{sensor_id}")
    assert device.json()["status"] == "DECOMMISSIONED"
    async with SessionLocal() as db:
        current = await db.scalar(select(SensorAssignment).where(SensorAssignment.sensor_id == UUID(sensor_id)))
        assert current.valid_to is not None


async def test_registry_mutations_require_csrf(client):
    await register_and_activate(client)
    authenticated = await login(client)
    farm_id = authenticated.json()["user"]["tenants"][0]["id"]
    farms = await client.get("/api/v1/farms")
    assert farms.status_code == 200

    rejected = await client.post(f"/api/v1/farms/{farms.json()[0]['id']}/plots", json={"name": "No CSRF"})
    assert rejected.status_code == 403
    assert rejected.json()["code"] == "CSRF_INVALID"
    assert farm_id == farms.json()[0]["tenant_id"]


async def test_farm_and_device_are_hidden_across_tenants(client):
    await register_and_activate(client)
    first_login = await login(client)
    first_headers = mutation_headers(first_login.json()["csrf_token"])
    first_farm = (await client.get("/api/v1/farms")).json()[0]
    station = await client.post("/api/v1/weather-stations", json={
        "farm_id": first_farm["id"], "device_code": "PRIVATE-WS", "display_name": "Private Station",
    }, headers=first_headers)
    assert station.status_code == 201
    client.cookies.clear()

    second = deepcopy(REGISTRATION)
    second.update({"email": "registry2@example.com", "full_name": "Registry Farmer Two", "farm_name": "Orchard Two"})
    await register_and_activate(client, second)
    await login(client, email=second["email"])

    farm = await client.get(f"/api/v1/farms/{first_farm['id']}")
    assert farm.status_code == 404
    device = await client.get(f"/api/v1/devices/{station.json()['id']}")
    assert device.status_code == 404


async def test_farm_membership_permission_matrix_and_revocation(client):
    await register_and_activate(client)
    owner_login = await login(client)
    owner_headers = mutation_headers(owner_login.json()["csrf_token"])
    farm = (await client.get("/api/v1/farms")).json()[0]

    manager = await register_tenant_colleague(
        client,
        farm["tenant_id"],
        email="manager@example.com",
        name="Farm Manager",
        farm_name="Manager Personal Farm",
    )
    technician = await register_tenant_colleague(
        client,
        farm["tenant_id"],
        email="technician@example.com",
        name="Field Technician",
        farm_name="Technician Personal Farm",
    )

    owner_login = await login(client)
    owner_headers = mutation_headers(owner_login.json()["csrf_token"])
    added_manager = await client.post(
        f"/api/v1/farms/{farm['id']}/memberships",
        json={"email": manager["email"], "role": "MANAGER"},
        headers=owner_headers,
    )
    assert added_manager.status_code == 201
    memberships = (await client.get(f"/api/v1/farms/{farm['id']}/memberships")).json()
    owner_membership = next(item for item in memberships if item["role"] == "OWNER")
    assert {item["email"] for item in memberships} == {REGISTRATION["email"], manager["email"]}

    client.cookies.clear()
    manager_login = await login(client, email=manager["email"])
    manager_headers = mutation_headers(manager_login.json()["csrf_token"])
    forbidden_promotion = await client.post(
        f"/api/v1/farms/{farm['id']}/memberships",
        json={"email": technician["email"], "role": "MANAGER"},
        headers=manager_headers,
    )
    assert forbidden_promotion.status_code == 403
    assert forbidden_promotion.json()["code"] == "FARM_OWNER_REQUIRED"
    added_technician = await client.post(
        f"/api/v1/farms/{farm['id']}/memberships",
        json={"email": technician["email"], "role": "TECHNICIAN"},
        headers=manager_headers,
    )
    assert added_technician.status_code == 201
    forbidden_owner_change = await client.patch(
        f"/api/v1/farms/{farm['id']}/memberships/{owner_membership['id']}",
        json={"role": "MEMBER"},
        headers=manager_headers,
    )
    assert forbidden_owner_change.status_code == 409
    assert forbidden_owner_change.json()["code"] == "FARM_OWNER_IMMUTABLE"

    client.cookies.clear()
    technician_login = await login(client, email=technician["email"])
    technician_headers = mutation_headers(technician_login.json()["csrf_token"])
    cannot_manage = await client.post(
        f"/api/v1/farms/{farm['id']}/memberships",
        json={"email": "nobody@example.com", "role": "MEMBER"},
        headers=technician_headers,
    )
    assert cannot_manage.status_code == 403
    assert cannot_manage.json()["code"] == "FARM_MANAGER_REQUIRED"

    client.cookies.clear()
    owner_login = await login(client)
    owner_headers = mutation_headers(owner_login.json()["csrf_token"])
    role_changed = await client.patch(
        f"/api/v1/farms/{farm['id']}/memberships/{added_technician.json()['id']}",
        json={"role": "MEMBER"},
        headers=owner_headers,
    )
    assert role_changed.status_code == 200
    assert role_changed.json()["role"] == "MEMBER"
    revoked = await client.delete(
        f"/api/v1/farms/{farm['id']}/memberships/{added_technician.json()['id']}",
        headers=owner_headers,
    )
    assert revoked.status_code == 200

    client.cookies.clear()
    await login(client, email=technician["email"])
    hidden_after_revoke = await client.get(f"/api/v1/farms/{farm['id']}")
    assert hidden_after_revoke.status_code == 404

    async with SessionLocal() as db:
        stored = await db.scalar(select(FarmMembership).where(FarmMembership.id == UUID(added_technician.json()["id"])))
        assert stored.active is False
