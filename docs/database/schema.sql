-- ============================================================================
-- TwinTrack 数据库初始化脚本
-- 版本: 1.0.0
-- 说明: 人员与设备管理相关表结构 + 模拟种子数据
-- 配套文档: DATABASE_DESIGN.md
-- ============================================================================

-- ============================================================================
-- 前置条件: 轨迹数据库已存在
-- 项目已有一个轨迹相关的数据库（存放 trajectory_points 等表），
-- 本脚本在其基础上扩展人员和设备管理模块。
-- ============================================================================

-- 如果数据库不存在则创建（根据实际环境调整库名）
CREATE DATABASE IF NOT EXISTS `twintrack` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `twintrack`;

-- ----------------------------------------------------------------------------
-- 1. 部门表 (department)
-- 说明: 企业组织架构中的部门/团队，供 personnel 表引用
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `department`;
CREATE TABLE `department` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    `name`        VARCHAR(50)  NOT NULL                 COMMENT '部门名称（如 研发部、运维部）',
    `code`        VARCHAR(20)  NOT NULL                 COMMENT '部门编码（如 deptRD, deptOps）',
    `description` VARCHAR(200) DEFAULT NULL             COMMENT '部门描述',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表';

-- ----------------------------------------------------------------------------
-- 2. 人员表 (personnel)
-- 说明: 平台所有人员的核心信息，每个人员拥有唯一的人员编号 person_id
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `personnel`;
CREATE TABLE `personnel` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    `person_id`     VARCHAR(20)  NOT NULL                 COMMENT '人员编号（如 P-001），业务标识符',
    `name`          VARCHAR(50)  NOT NULL                 COMMENT '姓名',
    `department_id` BIGINT       DEFAULT NULL             COMMENT '所属部门ID，关联 department.id',
    `role`          VARCHAR(20)  NOT NULL DEFAULT 'user'  COMMENT '角色：admin=管理员, operator=操作员, auditor=审计员, user=普通用户, visitor=访客',
    `phone`         VARCHAR(20)  DEFAULT NULL             COMMENT '联系电话',
    `email`         VARCHAR(100) DEFAULT NULL             COMMENT '电子邮箱',
    `status`        TINYINT      NOT NULL DEFAULT 1       COMMENT '状态：1=在职/激活, 0=离职/停用',
    `remark`        VARCHAR(500) DEFAULT NULL             COMMENT '备注',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_person_id` (`person_id`),
    KEY `idx_department_id` (`department_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_personnel_department` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人员表';

-- ----------------------------------------------------------------------------
-- 3. 定位设备表 (device)
-- 说明: 人员佩戴/携带的定位标签、腕带等终端设备
-- trajectory_points 表通过 device.device_id 关联到此表
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `device`;
CREATE TABLE `device` (
    `id`               BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    `device_id`        VARCHAR(50)  NOT NULL                 COMMENT '设备编号（如 TAG-10086），作为轨迹表的外键关联',
    `device_type`      VARCHAR(20)  NOT NULL DEFAULT 'tag'   COMMENT '设备类型：tag=定位标签, wristband=腕带',
    `protocol`         VARCHAR(10)  NOT NULL DEFAULT 'UWB'   COMMENT '通信协议：UWB, BLE',
    `firmware_version` VARCHAR(20)  DEFAULT NULL             COMMENT '固件版本（如 v2.4.1）',
    `battery`          INT          NOT NULL DEFAULT 0       COMMENT '电量百分比 0-100',
    `status`           VARCHAR(20)  NOT NULL DEFAULT 'online' COMMENT '运行状态：online=在线, offline=离线, low_battery=低电量',
    `last_report_time` DATETIME     DEFAULT NULL             COMMENT '最后上报时间，由 MQTT 心跳更新',
    `remark`           VARCHAR(500) DEFAULT NULL             COMMENT '备注',
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_device_id` (`device_id`),
    KEY `idx_status` (`status`),
    KEY `idx_device_type` (`device_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定位设备表（人员佩戴的终端设备，关联轨迹数据）';

-- ----------------------------------------------------------------------------
-- 4. 信标设备表 (beacon)
-- 说明: 部署在场所中的定位信标（锚点），用于辅助定位基础设施
-- 不直接与人员绑定，但通过部署区域与业务关联
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `beacon`;
CREATE TABLE `beacon` (
    `id`                BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    `beacon_id`         VARCHAR(50)  NOT NULL                 COMMENT '信标编号（如 BCN-A-001）',
    `model`             VARCHAR(100) DEFAULT NULL             COMMENT '设备型号（如 UWB Anchor X2, BLE Beacon S1）',
    `firmware_version`  VARCHAR(20)  DEFAULT NULL             COMMENT '固件版本（如 v3.2.1）',
    `protocol`          VARCHAR(10)  NOT NULL DEFAULT 'UWB'   COMMENT '通信协议：UWB, BLE',
    `battery`           INT          NOT NULL DEFAULT 0       COMMENT '电量百分比 0-100',
    `area`              VARCHAR(50)  DEFAULT NULL             COMMENT '部署区域（如 办公区A、会议区）',
    `status`            VARCHAR(20)  NOT NULL DEFAULT 'online' COMMENT '运行状态：online=在线, maintenance=维护中, offline=离线',
    `last_calibrated_at` DATETIME    DEFAULT NULL             COMMENT '最近校准时间',
    `remark`            VARCHAR(500) DEFAULT NULL             COMMENT '备注',
    `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_beacon_id` (`beacon_id`),
    KEY `idx_status` (`status`),
    KEY `idx_area` (`area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='信标设备表（定位于基础设施，不直接关联人员）';

-- ----------------------------------------------------------------------------
-- 5. 人员-设备绑定关系表 (person_device_binding)
-- 说明: 维护人员与定位设备的一对一绑定关系
--  - 人员维度唯一：同一时间一个人只能绑定一台设备
--  - 设备维度唯一：同一时间一台设备只能被一个人绑定
--  - 通过 unbound_at 字段支持历史追溯
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `person_device_binding`;
CREATE TABLE `person_device_binding` (
    `id`                   BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    `person_id`            BIGINT       NOT NULL                 COMMENT '人员ID，关联 personnel.id',
    `device_id`            BIGINT       NOT NULL                 COMMENT '设备ID，关联 device.id',
    `area`                 VARCHAR(50)  DEFAULT NULL             COMMENT '常驻区域（如 办公区A、实验区）',
    `permission`           VARCHAR(50)  DEFAULT NULL             COMMENT '授权范围（如 全域通行、值班权限、重点区域）',
    `permission_expires_at` DATETIME    DEFAULT NULL             COMMENT '授权到期时间',
    `bound_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
    `unbound_at`           DATETIME     DEFAULT NULL             COMMENT '解绑时间，NULL 表示当前有效绑定',
    `remark`               VARCHAR(500) DEFAULT NULL             COMMENT '备注',
    `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_person_device_active` (`person_id`, `unbound_at`) COMMENT '同一人员在同一时间段只能有一条有效绑定',
    UNIQUE KEY `uk_device_person_active` (`device_id`, `unbound_at`) COMMENT '同一设备在同一时间段只能被一个人绑定',
    KEY `idx_person_id` (`person_id`),
    KEY `idx_device_id` (`device_id`),
    KEY `idx_bound_at` (`bound_at`),
    CONSTRAINT `fk_binding_personnel` FOREIGN KEY (`person_id`) REFERENCES `personnel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_binding_device`   FOREIGN KEY (`device_id`) REFERENCES `device`(`id`)   ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人员-设备绑定关系表（一对一，支持历史追溯）';

-- ----------------------------------------------------------------------------
-- 6. 告警事件表 (alert_event)
-- 说明: 系统产生的告警/事件记录，可关联设备和/或人员
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `alert_event`;
CREATE TABLE `alert_event` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    `event_id`      VARCHAR(50)  NOT NULL                 COMMENT '事件编号（如 E-1025）',
    `title`         VARCHAR(200) NOT NULL                 COMMENT '事件标题',
    `device_id`     VARCHAR(50)  DEFAULT NULL             COMMENT '关联设备编号（device.device_id），可空',
    `person_id`     VARCHAR(20)  DEFAULT NULL             COMMENT '关联人员编号（personnel.person_id），可空',
    `area`          VARCHAR(50)  DEFAULT NULL             COMMENT '事件发生区域',
    `event_type`    VARCHAR(20)  NOT NULL                 COMMENT '事件类型：crossing=越界, gather=聚集, low_battery=低电量, offline=离线',
    `alert_level`   VARCHAR(10)  NOT NULL DEFAULT 'warn'  COMMENT '告警等级：alarm=高, warn=中, normal=低',
    `status`        VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '处理状态：pending=待处理, processing=处理中, closed=已关闭',
    `remark`        VARCHAR(500) DEFAULT NULL             COMMENT '处理备注',
    `occurred_at`   DATETIME     NOT NULL                 COMMENT '事件发生时间',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_event_id` (`event_id`),
    KEY `idx_device_id` (`device_id`),
    KEY `idx_person_id` (`person_id`),
    KEY `idx_event_type` (`event_type`),
    KEY `idx_alert_level` (`alert_level`),
    KEY `idx_status` (`status`),
    KEY `idx_occurred_at` (`occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警事件表（关联设备与人员的事件记录）';

-- ----------------------------------------------------------------------------
-- 7. 业务区域表 (area)
-- 说明: 平台中定义的业务区域，对应 SceneConfig 中的 fences/areas。
-- 供设备常驻区域、告警位置等业务逻辑使用
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `area`;
CREATE TABLE `area` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    `area_id`     VARCHAR(50)  NOT NULL                 COMMENT '区域编号（如 AREA-Office-A）',
    `name`        VARCHAR(50)  NOT NULL                 COMMENT '区域名称（如 办公区A、实验区）',
    `type`        VARCHAR(20)  NOT NULL DEFAULT 'zone'  COMMENT '区域类型：zone=业务区域, fence=围栏区域',
    `description` VARCHAR(200) DEFAULT NULL             COMMENT '区域描述',
    `color`       VARCHAR(20)  DEFAULT NULL             COMMENT '区域颜色（用于前端显示，如 #2e86ff）',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_area_id` (`area_id`),
    KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业务区域表（对应场景配置中的区域和围栏）';

-- ============================================================================
-- 参考：轨迹点表（已存在）
-- 此表不属于本次建表范围，仅作为参考说明。
-- 实际项目中 trajectory_points 表已存在，通过 device_id 与本 schema 的 device 表关联。
-- ============================================================================
-- CREATE TABLE `trajectory_points` (
--     `id`        BIGINT       NOT NULL AUTO_INCREMENT,
--     `device_id` VARCHAR(50)  NOT NULL          COMMENT '设备编号，关联 device.device_id',
--     `x`         INT          NOT NULL DEFAULT 0 COMMENT 'X坐标，存储值 = 实际值 * 1000',
--     `y`         INT          NOT NULL DEFAULT 0 COMMENT 'Y坐标，存储值 = 实际值 * 1000',
--     `z`         INT          NOT NULL DEFAULT 0 COMMENT 'Z坐标，存储值 = 实际值 * 1000',
--     `theta`     INT          NOT NULL DEFAULT 0 COMMENT '朝向角度，存储值 = 实际值 * 1000',
--     `timestamp` BIGINT       NOT NULL          COMMENT 'Unix毫秒时间戳',
--     `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     PRIMARY KEY (`id`),
--     KEY `idx_device_id` (`device_id`),
--     KEY `idx_timestamp` (`timestamp`),
--     KEY `idx_device_timestamp` (`device_id`, `timestamp`),
--     CONSTRAINT `fk_trajectory_device` FOREIGN KEY (`device_id`) REFERENCES `device`(`device_id`) ON DELETE CASCADE ON UPDATE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='轨迹点表（已存在，参考结构）';
-- ============================================================================



-- ============================================================================
-- 种子数据（从项目现有模拟数据提取）
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 部门数据
-- 来源: IdentityView.vue rawBindings → departmentKey 判断
-- ----------------------------------------------------------------------------
INSERT INTO `department` (`id`, `name`, `code`, `description`) VALUES
(1, '研发部',     'deptRD',       '负责产品研发与技术攻关'),
(2, '运维部',     'deptOps',      '负责系统运维与设备维护'),
(3, '安全部',     'deptSecurity', '负责场所安全与监控管理'),
(4, '生产部',     'deptProduction','负责生产制造与物流管理'),
(5, '临时访客',   'deptVisitor',  '访客及临时出入人员');

-- ----------------------------------------------------------------------------
-- 人员数据
-- 来源: IdentityView.vue rawBindings（5条）+ HomeView.vue 摘要（112在线/248总）
-- 扩充至 10 条以覆盖更多角色组合
-- ----------------------------------------------------------------------------
INSERT INTO `personnel` (`id`, `person_id`, `name`, `department_id`, `role`, `phone`, `email`, `status`, `remark`) VALUES
(1,  'P-001', '张工',  1, 'admin',   '13800138001', 'zhang@example.com',    1, '研发部管理员'),
(2,  'P-002', '李工',  2, 'operator','13800138002', 'li@example.com',       1, '运维部操作员'),
(3,  'P-003', '王工',  3, 'auditor', '13800138003', 'wang@example.com',     1, '安全部审计员'),
(4,  'P-004', '访客A', 5, 'visitor', '13800138004', 'visitor_a@example.com', 1, '临时访客，有效期至今日18:00'),
(5,  'P-005', '赵工',  4, 'user',    '13800138005', 'zhao@example.com',     1, '生产部员工'),
(6,  'P-006', '陈工',  1, 'user',    '13800138006', 'chen@example.com',     1, '研发部普通员工'),
(7,  'P-007', '刘工',  2, 'operator','13800138007', 'liu@example.com',      1, '运维部操作员'),
(8,  'P-008', '周工',  3, 'user',    '13800138008', 'zhou@example.com',     0, '安全部员工（已离职）'),
(9,  'P-009', '吴工',  4, 'auditor', '13800138009', 'wu@example.com',       1, '生产部审计员'),
(10, 'P-010', '访客B', 5, 'visitor', '13800138010', 'visitor_b@example.com',1, '商务访客');

-- ----------------------------------------------------------------------------
-- 定位设备数据（人员佩戴的标签/腕带）
-- 来源: IdentityView.vue rawBindings 中的设备信息
-- 补充额外设备以覆盖库存场景（IdentityView 摘要: 18台库存）
-- ----------------------------------------------------------------------------
INSERT INTO `device` (`id`, `device_id`, `device_type`, `protocol`, `firmware_version`, `battery`, `status`, `last_report_time`, `remark`) VALUES
(1,  'TAG-10086', 'tag',       'UWB', 'v2.4.1', 86,  'online',     '2026-07-24 10:48:00', '张工佩戴的定位标签'),
(2,  'TAG-10015', 'wristband', 'UWB', 'v2.3.8', 18,  'low_battery','2026-07-24 10:45:00', '李工佩戴的腕带（低电量提醒）'),
(3,  'TAG-10003', 'tag',       'BLE', 'v2.4.0', 72,  'online',     '2026-07-24 10:47:00', '王工佩戴的定位标签'),
(4,  'TAG-10021', 'tag',       'UWB', 'v2.4.1', 61,  'online',     '2026-07-24 10:48:12', '访客A佩戴的定位标签'),
(5,  'TAG-10042', 'tag',       'UWB', 'v2.4.1', 13,  'low_battery','2026-07-24 10:31:00', '陈工佩戴的低电量标签（需更换电池）'),
(6,  'TAG-10055', 'wristband', 'BLE', 'v2.3.8', 94,  'online',     '2026-07-24 10:46:00', '刘工佩戴的腕带'),
(7,  'TAG-10067', 'tag',       'UWB', 'v2.4.0', 45,  'online',     '2026-07-24 10:40:00', '库存备用标签'),
(8,  'TAG-10078', 'tag',       'UWB', 'v2.4.1', 100, 'offline',    NULL,                  '新入库标签（未激活）'),
(9,  'TAG-10089', 'wristband', 'BLE', 'v2.3.8', 0,   'offline',    NULL,                  '库存腕带（未分配）'),
(10, 'TAG-10090', 'tag',       'UWB', 'v2.4.1', 100, 'offline',    NULL,                  '新入库标签（未激活）');

-- ----------------------------------------------------------------------------
-- 信标设备数据（定位基础设施）
-- 来源: BeaconDeviceView.vue rawBeacons（4条）+ 摘要统计（64总/58在线/4维护/2离线）
-- 扩充至 8 条以覆盖各场景
-- ----------------------------------------------------------------------------
INSERT INTO `beacon` (`id`, `beacon_id`, `model`, `firmware_version`, `protocol`, `battery`, `area`, `status`, `last_calibrated_at`, `remark`) VALUES
(1, 'BCN-A-001', 'UWB Anchor X2', 'v3.2.1', 'UWB', 92, '办公区A', 'online',      '2026-07-23 10:12:00', '办公区主定位锚点'),
(2, 'BCN-M-012', 'BLE Beacon S1', 'v2.8.4', 'BLE', 78, '会议区',   'online',      '2026-07-23 09:40:00', '会议区信标'),
(3, 'BCN-L-006', 'UWB Anchor X2', 'v3.1.9', 'UWB', 36, '实验区',   'maintenance', '2026-07-22 18:20:00', '需固件升级'),
(4, 'BCN-W-019', 'BLE Beacon S1', 'v2.7.6', 'BLE', 14, '仓储区',   'offline',     NULL,                  '电量过低需更换'),
(5, 'BCN-A-002', 'UWB Anchor X2', 'v3.2.1', 'UWB', 88, '办公区B', 'online',      '2026-07-20 14:30:00', '办公区B备用锚点'),
(6, 'BCN-E-003', 'UWB Anchor X2', 'v3.2.0', 'UWB', 67, '设备间',   'online',      '2026-07-18 11:00:00', '设备间定位锚点'),
(7, 'BCN-L-007', 'BLE Beacon S1', 'v2.8.4', 'BLE', 55, '实验区',   'maintenance', '2026-07-10 09:00:00', '需校准'),
(8, 'BCN-P-001', 'UWB Anchor X2', 'v3.1.8', 'UWB', 43, '生产区',   'online',      '2026-07-15 16:20:00', '生产区定位锚点');

-- ----------------------------------------------------------------------------
-- 人员-设备绑定关系数据
-- 来源: IdentityView.vue rawBindings 中的绑定关系
-- 说明: 前 4 条为有效绑定（unbound_at = NULL），第 5 条人员未分配设备
-- ----------------------------------------------------------------------------
INSERT INTO `person_device_binding` (`id`, `person_id`, `device_id`, `area`, `permission`, `permission_expires_at`, `bound_at`, `unbound_at`, `remark`) VALUES
(1, 1,  1, '办公区A', '全域通行',   NULL,                   '2026-01-15 09:00:00', NULL, '张工绑定 TAG-10086'),
(2, 2,  2, '设备间',   '值班权限',   NULL,                   '2026-03-01 09:00:00', NULL, '李工绑定 TAG-10015'),
(3, 3,  3, '实验区',   '重点区域',   NULL,                   '2026-02-10 09:00:00', NULL, '王工绑定 TAG-10003'),
(4, 4,  4, '会议区',   '18:00 过期', '2026-07-24 18:00:00',  '2026-07-24 08:00:00', NULL, '访客A临时绑定 TAG-10021'),
(5, 6,  5, '办公区A', '全域通行',   NULL,                   '2026-06-01 09:00:00', '2026-07-23 17:00:00', '陈工此前绑定 TAG-10042（历史记录）'),
(6, 7,  6, '办公区A', '值班权限',   NULL,                   '2026-07-01 09:00:00', NULL, '刘工绑定 TAG-10055');

-- ----------------------------------------------------------------------------
-- 业务区域数据
-- 来源: SceneConfig 中的 fences + IdentityView/BeaconView 区域引用
-- ----------------------------------------------------------------------------
INSERT INTO `area` (`id`, `area_id`, `name`, `type`, `description`, `color`) VALUES
(1, 'AREA-Office-A',  '办公区A', 'zone', '研发部办公区域',    '#2e86ff'),
(2, 'AREA-Office-B',  '办公区B', 'zone', '运维部办公区域',    '#4ea3ff'),
(3, 'AREA-Equipment', '设备间',   'zone', '服务器及网络设备间', '#8a62ff'),
(4, 'AREA-Lab',       '实验区',   'zone', '产品实验与测试区域', '#ff7548'),
(5, 'AREA-Meeting',   '会议区',   'zone', '会议室区域',        '#ffc23d'),
(6, 'AREA-Production', '生产区',  'zone', '生产制造区域',      '#ff5353'),
(7, 'AREA-Warehouse', '仓储区',   'zone', '仓储物流区域',      '#27d57d');

-- ----------------------------------------------------------------------------
-- 告警事件数据
-- 来源: EventCenterView.vue events（4条）+ HomeView.vue events（4条）
-- 合并去重后共 6 条，覆盖各类型和状态
-- ----------------------------------------------------------------------------
INSERT INTO `alert_event` (`id`, `event_id`, `title`, `device_id`, `person_id`, `area`, `event_type`, `alert_level`, `status`, `remark`, `occurred_at`) VALUES
(1, 'E-1028', '访客A离开授权区域',     'TAG-10021', 'P-004', '会议区',   'crossing',     'alarm', 'pending',    '等待安保复核',          '2026-07-24 10:48:12'),
(2, 'E-1027', '会议室2出现人员聚集',   NULL,        NULL,    '会议区',   'gather',       'warn',  'processing', '已通知现场管理员',      '2026-07-24 10:39:12'),
(3, 'E-1026', 'TAG-10042电量低于20%', 'TAG-10042', 'P-006', '办公区A',  'low_battery',  'warn',  'pending',    '待更换标签电池',        '2026-07-24 10:31:08'),
(4, 'E-1025', 'TAG-10003超过3分钟未上报', 'TAG-10003', 'P-003', '实验区', 'offline',      'normal','closed',     '设备已恢复上报',        '2026-07-24 10:18:44'),
(5, 'E-1024', 'TAG-10086进入办公区A',  'TAG-10086', 'P-001', '办公区A',  'crossing',     'normal','closed',     '常规出入记录',          '2026-07-24 10:42:31'),
(6, 'E-1023', '实验区非授权时段闯入',    'TAG-10003', 'P-003', '实验区',   'crossing',     'alarm', 'processing', '已升级为安全事件',      '2026-07-24 09:15:00');
