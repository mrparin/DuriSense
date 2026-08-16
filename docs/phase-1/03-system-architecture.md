# System Architecture

## Context Diagram

```mermaid
flowchart LR
    V[Visitor] --> EDGE[University Firewall / WAF / Reverse Proxy]
    F[Farmer] --> EDGE
    A[Admin] --> EDGE
    EDGE --> N[Nginx]
    N --> FE[Next.js]
    N --> API[FastAPI]
    SIM[Sensor and Relay Simulator] -->|MQTT TLS 8883| MQ[Eclipse Mosquitto]
    HW[ESP32 Hardware] -->|MQTT TLS 8883| MQ
    MQ --> ING[Python MQTT Ingestor]
    ING --> DB[(PostgreSQL + TimescaleDB)]
    API --> DB
    API --> R[(Redis)]
    API --> MQ
    ING --> W[Worker]
    W --> DB
    FE -->|REST + SSE| API
```

## Container Boundary

| Network | Services | Public exposure |
| --- | --- | --- |
| `edge_net` | Nginx | รับเฉพาะ origin traffic ที่มหาวิทยาลัยอนุมัติ |
| `app_net` | Nginx, Next.js, FastAPI | ไม่มี public host port |
| `iot_net` | FastAPI, Mosquitto, Ingestor, Simulator (dev/test) | เฉพาะ Mosquitto TLS 8883 |
| `data_net` | FastAPI, Ingestor, Worker, PostgreSQL, Redis | ไม่มี public host port |

Simulator ใน production-like environment ต้องใช้ credential/ACL เหมือนอุปกรณ์จริง และไม่ใช้สิทธิ์
database หรือ internal API เพื่อข้าม ingestion path

## Telemetry Flow

```mermaid
sequenceDiagram
    participant D as Simulator / Hardware
    participant M as Mosquitto
    participant I as Ingestor
    participant T as TimescaleDB
    participant W as Alert Worker
    participant A as FastAPI SSE
    participant U as Dashboard

    D->>M: Publish Schema 2.0 + message_id + sequence
    M->>I: Deliver under station ACL
    I->>I: Validate identity, topic, schema, assignment, unit and time
    alt valid and not duplicate
        I->>T: Store raw message and normalized readings
        I->>W: Emit telemetry event
        W->>T: Evaluate alert and device state
        A-->>U: Push latest data / status / alert
    else invalid
        I->>T: Store quarantine reason and raw evidence
    end
```

## Relay Command Flow

```mermaid
sequenceDiagram
    participant U as Farmer Dashboard
    participant A as FastAPI
    participant DB as PostgreSQL
    participant M as Mosquitto
    participant D as Relay Simulator / Hardware

    U->>A: POST desired state
    A->>A: Check session, farm scope, control permission and online state
    A->>DB: Create command PENDING + audit
    A->>M: Publish command with command_id and expires_at
    M->>D: Deliver under station ACL
    D->>D: Validate, execute and read reported state
    D->>M: Publish ACK and state
    M->>A: Command result via ingestion path
    A->>DB: Append event and final state
    A-->>U: SSE ACKNOWLEDGED / FAILED / TIMEOUT / STATE_MISMATCH
```

UI ห้ามเปลี่ยนเป็น `ON` หรือ `OFF` แบบยืนยันแล้วจาก optimistic state ต้องแสดง `กำลังส่ง`
จนได้รับ ACK/reported state หาก timeout ต้องแสดง `ไม่ทราบสถานะ` และไม่ retry คำสั่ง `ON` อัตโนมัติ

## Trust Boundaries

- University Edge ตรวจ web traffic ก่อนถึง Nginx
- Mosquitto ตรวจ device credential และ topic ACL ก่อนถึง Ingestor
- FastAPI ตรวจ role และ resource scope ทุก endpoint
- Ingestor ยึด authenticated connection + registry มากกว่า ID ใน payload
- Database runtime roles แยก migration, API, ingestor, readonly และ backup
- Raw telemetry เป็น immutable; normalization/derived metrics มี version และ provenance

## Operational Signals

- API/worker/ingestor readiness และ database/MQTT connectivity
- ingest rate, validation failure, duplicate และ quarantine count
- queue lag, database latency และ SSE connection count
- device last seen, sequence gap, battery/RSSI และ firmware
- relay ACK latency, timeout, failure และ state mismatch
- backup status และผล restore drill ล่าสุด

