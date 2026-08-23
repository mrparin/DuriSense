from app.domains.operations.models import ActivityType, RelayCommandState
from app.domains.operations.schemas import DispatchRelayCommandRequest, FarmActivityCreate


async def test_operations_schemas_and_enums():
    req = DispatchRelayCommandRequest(target_state="ON", duration_seconds=900)
    assert req.target_state == "ON"
    assert req.duration_seconds == 900

    activity_req = FarmActivityCreate(
        activity_type=ActivityType.IRRIGATION,
        title="ให้น้ำแปลง ZoneA 30 นาที",
        description="เปิดสปริงเกลอร์รดน้ำรอบเช้า",
        volume_liters=1500.0,
    )
    assert activity_req.activity_type == ActivityType.IRRIGATION
    assert activity_req.title == "ให้น้ำแปลง ZoneA 30 นาที"
    assert activity_req.volume_liters == 1500.0
    assert RelayCommandState.ACKNOWLEDGED.value == "ACKNOWLEDGED"


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_operations_schemas_and_enums())
    print("test_operations_schemas_and_enums PASSED OK")
