-- 对现有 TwinTrack 数据库执行的非破坏性迁移。
BEGIN;

CREATE TABLE IF NOT EXISTS map_building (
    building_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS map_floor (
    building_id VARCHAR(100) NOT NULL REFERENCES map_building(building_id) ON UPDATE CASCADE ON DELETE CASCADE,
    floor_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (building_id, floor_id)
);

ALTER TABLE beacon ADD COLUMN IF NOT EXISTS deployment_status VARCHAR(12) NOT NULL DEFAULT 'undeployed';
ALTER TABLE beacon ADD COLUMN IF NOT EXISTS building_id VARCHAR(100);
ALTER TABLE beacon ADD COLUMN IF NOT EXISTS floor_id VARCHAR(100);
ALTER TABLE beacon DROP CONSTRAINT IF EXISTS beacon_deployment_status_check;
ALTER TABLE beacon ADD CONSTRAINT beacon_deployment_status_check CHECK (deployment_status IN ('undeployed', 'deployed'));
ALTER TABLE beacon DROP CONSTRAINT IF EXISTS fk_beacon_floor;
ALTER TABLE beacon ADD CONSTRAINT fk_beacon_floor FOREIGN KEY (building_id, floor_id)
    REFERENCES map_floor(building_id, floor_id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_beacon_deployment ON beacon (deployment_status);
CREATE INDEX IF NOT EXISTS idx_beacon_floor ON beacon (building_id, floor_id);
COMMIT;
