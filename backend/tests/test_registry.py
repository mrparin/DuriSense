from copy import deepcopy
from uuid import UUID

from sqlalchemy import select

from app.db.session import SessionLocal
from app.domains.registry.models import DeviceCredential, SensorAssignment

from .test_auth import REGISTRATION, login, register_and_activate


def mutation_headers(csrf: str) -> dict[str, str]:
    return {"X-CSRF-Token": csrf, "Origin": "http://localhost:3000"}


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
