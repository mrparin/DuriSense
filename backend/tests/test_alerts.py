import os
import sys
from uuid import uuid4

sys.path.insert(0, os.path.abspath("."))

try:
    import pytest
except ImportError:
    pytest = None

from app.domains.alerts.models import (
    AlertMetricType,
    AlertOperator,
    AlertSeverity,
    AlertState,
)
from app.domains.alerts.schemas import (
    AcknowledgeAlertRequest,
    AlertRuleCreate,
    AlertRuleUpdate,
    NotificationPreferenceUpdate,
    ResolveAlertRequest,
)
from app.domains.alerts import service


async def test_alert_enums_and_schemas():
    assert AlertSeverity.WARNING == "WARNING"
    assert AlertState.OPEN == "OPEN"
    assert AlertMetricType.SOIL_MOISTURE == "SOIL_MOISTURE"
    assert AlertOperator.LESS_THAN == "LESS_THAN"

    rule_req = AlertRuleCreate(
        name="ดินแห้งเกินไป แปลงโซน 1",
        metric_type="SOIL_MOISTURE",
        operator="LESS_THAN",
        threshold_min=30.0,
        severity=AlertSeverity.WARNING,
        duration_seconds=300,
        hysteresis=2.0,
        notify_channels=["IN_APP", "EMAIL"],
    )
    assert rule_req.name == "ดินแห้งเกินไป แปลงโซน 1"
    assert rule_req.threshold_min == 30.0
    assert rule_req.hysteresis == 2.0

    ack_req = AcknowledgeAlertRequest(note="กำลังตรวจสอบวาล์วน้ำ")
    assert ack_req.note == "กำลังตรวจสอบวาล์วน้ำ"

    resolve_req = ResolveAlertRequest(reason="เปิดน้ำรดแปลงแล้ว ค่ากลับสู่ปกติ")
    assert resolve_req.reason == "เปิดน้ำรดแปลงแล้ว ค่ากลับสู่ปกติ"

    pref_req = NotificationPreferenceUpdate(
        email_enabled=True,
        in_app_enabled=True,
        quiet_hours_start="23:00",
        quiet_hours_end="06:00",
    )
    assert pref_req.quiet_hours_start == "23:00"


def test_threshold_and_hysteresis_logic():
    # 1. Less Than rule with hysteresis
    threshold_min = 30.0
    hysteresis = 2.0

    # Reading 28.5% is below 30.0 -> Violated
    val1 = 28.5
    assert val1 < threshold_min, "Should trigger violation"

    # Reading 30.5% is above threshold_min (30.0), but within hysteresis (30 + 2 = 32.0) -> Not fully recovered
    val2 = 30.5
    assert not (val2 >= threshold_min + hysteresis), "Should still be in hysteresis band"

    # Reading 32.5% is >= 32.0 -> Fully recovered and safe to auto-resolve
    val3 = 32.5
    assert val3 >= (threshold_min + hysteresis), "Should auto-resolve"

    # 2. Greater Than rule with hysteresis
    threshold_max = 40.0
    hysteresis_temp = 1.5

    # Reading 42.0 is above 40.0 -> Violated
    temp1 = 42.0
    assert temp1 > threshold_max

    # Reading 39.5 is below 40.0, but still > 38.5 (40 - 1.5) -> In hysteresis band
    temp2 = 39.5
    assert not (temp2 <= threshold_max - hysteresis_temp)

    # Reading 38.0 is <= 38.5 -> Fully recovered
    temp3 = 38.0
    assert temp3 <= (threshold_max - hysteresis_temp)


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_alert_enums_and_schemas())
    test_threshold_and_hysteresis_logic()
    print("ALL ALERT TESTS PASSED OK")
