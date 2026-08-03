-- ============================================================================
-- TwinTrack PostgreSQL 15+ 全量重建脚本
--
-- 警告：本脚本会终止 dfmotion 数据库连接、删除整个 dfmotion 数据库并重新创建。
--       原有人员、设备、信标、告警和轨迹数据都会永久删除，请先完成备份。
--
-- 执行：
--   psql -U <数据库所有者或超级用户> -d postgres -f docs/init_postgresql.sql
--
-- 执行账号必须能够终止 dfmotion 连接，并拥有 DROP DATABASE/CREATEDB 权限。
--
-- 设计原则：
--   1. 只保留当前管理页面、事件中心和轨迹服务实际需要的字段。
--   2. 人员与定位设备采用 device.personnel_id 直接建立当前一对一绑定。
--   3. 设备状态从非 SOS 变为 SOS 时，由数据库触发器自动写入 alert_event。
--   4. 不写入演示数据；部署后通过管理页面或 CSV 导入业务数据。
-- ============================================================================

\set ON_ERROR_STOP on

-- DROP DATABASE 不能在事务中执行，因此先连接 postgres 管理库。
\connect postgres

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'dfmotion'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS dfmotion;
CREATE DATABASE dfmotion WITH ENCODING 'UTF8' TEMPLATE template0;
\connect dfmotion

BEGIN;

SET TIME ZONE 'UTC';

-- ----------------------------------------------------------------------------
-- 1. 部门
-- ----------------------------------------------------------------------------
CREATE TABLE department (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(50)  NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. 人员
--    设备绑定状态由 device.personnel_id 是否为空实时计算，不保存冗余状态字段。
-- ----------------------------------------------------------------------------
CREATE TABLE personnel (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id     VARCHAR(50)  NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    department_id BIGINT REFERENCES department(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_personnel_department_id ON personnel (department_id);

-- ----------------------------------------------------------------------------
-- 3. 定位设备
--    device_id 保存定位设备唯一编号，可使用 MAC、IMEI、序列号或自定义编号，不限制格式。
--    personnel_id 可空且唯一，因此同一人员最多绑定一台设备。
-- ----------------------------------------------------------------------------
CREATE TABLE device (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id    VARCHAR(64) NOT NULL UNIQUE,
    personnel_id BIGINT UNIQUE REFERENCES personnel(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    battery      SMALLINT    NOT NULL DEFAULT 80
        CHECK (battery BETWEEN 0 AND 100),
    status       VARCHAR(10) NOT NULL DEFAULT 'offline'
        CHECK (status IN ('online', 'offline', 'SOS'))
);

CREATE INDEX idx_device_status ON device (status);
CREATE INDEX idx_device_personnel_id ON device (personnel_id);

-- ----------------------------------------------------------------------------
-- 4. 信标设备
-- ----------------------------------------------------------------------------
CREATE TABLE beacon (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    beacon_id VARCHAR(64)      NOT NULL UNIQUE,
    x         DOUBLE PRECISION NOT NULL DEFAULT 0,
    y         DOUBLE PRECISION NOT NULL DEFAULT 0,
    z         DOUBLE PRECISION NOT NULL DEFAULT 0,
    battery   SMALLINT         NOT NULL DEFAULT 80
        CHECK (battery BETWEEN 0 AND 100),
    status    VARCHAR(10)      NOT NULL DEFAULT 'offline'
);

CREATE INDEX idx_beacon_status ON beacon (status);

-- ----------------------------------------------------------------------------
-- 5. 业务区域
--    事件中心和首页区域筛选仍会读取该表。
-- ----------------------------------------------------------------------------
CREATE TABLE area (
    id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    area_id VARCHAR(64)  NOT NULL UNIQUE,
    name    VARCHAR(100) NOT NULL,
    type    VARCHAR(20)  NOT NULL DEFAULT 'zone'
        CHECK (type IN ('zone', 'fence')),
    color   VARCHAR(20)
);

CREATE INDEX idx_area_type ON area (type);

-- ----------------------------------------------------------------------------
-- 6. 告警事件
--    device_id/person_id 使用业务编号，允许记录尚未入库或已删除设备产生的历史告警。
-- ----------------------------------------------------------------------------
CREATE TABLE alert_event (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id    VARCHAR(100) NOT NULL UNIQUE,
    title       VARCHAR(200) NOT NULL,
    device_id   VARCHAR(64),
    person_id   VARCHAR(50),
    area        VARCHAR(100),
    event_type  VARCHAR(20)  NOT NULL
        CHECK (event_type IN ('crossing', 'gather', 'low_battery', 'offline', 'sos', 'legacy')),
    alert_level VARCHAR(10)  NOT NULL DEFAULT 'warn'
        CHECK (alert_level IN ('alarm', 'warn', 'normal')),
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'closed', 'ignored')),
    remark      VARCHAR(500),
    processed_at TIMESTAMP WITH TIME ZONE,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_event_occurred_at ON alert_event (occurred_at DESC);
CREATE INDEX idx_alert_event_device_id ON alert_event (device_id);
CREATE INDEX idx_alert_event_person_id ON alert_event (person_id);
CREATE INDEX idx_alert_event_type ON alert_event (event_type);
CREATE INDEX idx_alert_event_status ON alert_event (status);

-- 定位设备首次以 SOS 创建，或状态由非 SOS 转为 SOS 时，自动生成一条告警。
CREATE OR REPLACE FUNCTION create_sos_alert_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    bound_person_id VARCHAR(50);
    should_create   BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        should_create := NEW.status = 'SOS';
    ELSIF TG_OP = 'UPDATE' THEN
        should_create := NEW.status = 'SOS' AND OLD.status IS DISTINCT FROM 'SOS';
    END IF;

    IF NOT should_create THEN
        RETURN NEW;
    END IF;

    SELECT p.person_id
    INTO bound_person_id
    FROM personnel p
    WHERE p.id = NEW.personnel_id;

    INSERT INTO alert_event (
        event_id,
        title,
        device_id,
        person_id,
        event_type,
        alert_level,
        status,
        remark,
        occurred_at
    ) VALUES (
        'SOS-' || SUBSTRING(MD5(NEW.device_id || TXID_CURRENT()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 24),
        '定位设备 SOS 告警',
        NEW.device_id,
        bound_person_id,
        'sos',
        'alarm',
        'pending',
        '设备状态由非 SOS 转为 SOS，数据库自动创建',
        CURRENT_TIMESTAMP
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_device_sos_alert
AFTER INSERT OR UPDATE OF status ON device
FOR EACH ROW
EXECUTE FUNCTION create_sos_alert_event();

-- 当前后端 /alerts 仍读写 public.alert；保留一个兼容视图，不再维护重复告警表。
CREATE VIEW alert AS
SELECT
    id,
    title,
    device_id AS device,
    occurred_at AS alert_time,
    alert_level,
    CASE
        WHEN alert_level IN ('alarm', 'warn') THEN '!'
        ELSE 'i'
    END::CHAR(1) AS icon,
    (status = 'closed') AS resolved
FROM alert_event;

CREATE OR REPLACE FUNCTION insert_alert_compatibility_view()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO alert_event (
        event_id,
        title,
        device_id,
        event_type,
        alert_level,
        status,
        occurred_at
    ) VALUES (
        'ALERT-' || SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 24),
        NEW.title,
        NEW.device,
        'legacy',
        COALESCE(NEW.alert_level, 'warn'),
        CASE WHEN COALESCE(NEW.resolved, FALSE) THEN 'closed' ELSE 'pending' END,
        COALESCE(NEW.alert_time, CURRENT_TIMESTAMP)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alert_compatibility_insert
INSTEAD OF INSERT ON alert
FOR EACH ROW
EXECUTE FUNCTION insert_alert_compatibility_view();

-- ----------------------------------------------------------------------------
-- 7. 设备轨迹历史
--    仅保留 TrajectoryMapper 实际读写的字段，按 server_ts 月度分区。
-- ----------------------------------------------------------------------------
CREATE TABLE device_location_history (
    id         BIGINT GENERATED ALWAYS AS IDENTITY,
    device_id  VARCHAR(64) NOT NULL REFERENCES device(device_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    server_ts  TIMESTAMP WITH TIME ZONE NOT NULL,
    x_mm       INTEGER NOT NULL,
    y_mm       INTEGER NOT NULL,
    z_mm       INTEGER NOT NULL DEFAULT 0,
    theta_mrad INTEGER,
    PRIMARY KEY (id, server_ts)
) PARTITION BY RANGE (server_ts);

CREATE INDEX idx_location_history_device_ts
    ON device_location_history (device_id, server_ts DESC);

CREATE OR REPLACE FUNCTION ensure_location_history_partition(
    partition_start TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    month_start TIMESTAMP WITH TIME ZONE := DATE_TRUNC('month', partition_start);
    month_end   TIMESTAMP WITH TIME ZONE := month_start + INTERVAL '1 month';
    table_name  TEXT := FORMAT(
        'device_location_history_%s',
        TO_CHAR(month_start AT TIME ZONE 'UTC', 'YYYY_MM')
    );
BEGIN
    EXECUTE FORMAT(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF device_location_history
         FOR VALUES FROM (%L) TO (%L)',
        table_name,
        month_start,
        month_end
    );
END;
$$;

-- 创建当前月和下个月分区，后端定时任务负责继续创建后续分区。
SELECT ensure_location_history_partition(CURRENT_TIMESTAMP);
SELECT ensure_location_history_partition(CURRENT_TIMESTAMP + INTERVAL '1 month');

COMMIT;

-- ----------------------------------------------------------------------------
-- 部署后验证
-- ----------------------------------------------------------------------------
\echo 'TwinTrack dfmotion database rebuilt successfully.'
\echo 'Run: \dt public.*'
\echo 'Run: SELECT status, COUNT(*) FROM device GROUP BY status;'
\echo 'Run: SELECT * FROM alert_event ORDER BY occurred_at DESC LIMIT 5;'
