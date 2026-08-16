from copy import deepcopy

from .test_auth import REGISTRATION, login, register_and_activate


async def test_tenant_context_is_not_available_to_another_farmer(client):
    await register_and_activate(client)
    first_login = await login(client)
    first_tenant = first_login.json()["user"]["tenants"][0]["id"]
    client.cookies.clear()

    second = deepcopy(REGISTRATION)
    second.update({"email": "farmer2@example.com", "full_name": "Farmer Two", "farm_name": "Orchard Two"})
    await register_and_activate(client, second)
    second_login = await login(client, email=second["email"])
    assert second_login.status_code == 200

    own_tenant = second_login.json()["user"]["tenants"][0]["id"]
    own = await client.get(f"/api/v1/tenants/{own_tenant}/context")
    assert own.status_code == 200

    cross_tenant = await client.get(f"/api/v1/tenants/{first_tenant}/context")
    assert cross_tenant.status_code == 404
    assert cross_tenant.json()["code"] == "RESOURCE_NOT_FOUND"
