# TwinTrack 数据库设计文档 — 人员与设备模块

> 版本: 1.0.0  
> 日期: 2026-07-24  
> 配套脚本: [schema.sql](schema.sql)

---

## 一、概述

### 1.1 背景

TwinTrack 是一个面向企业园区、工厂与实验空间的人员轨迹数字孪生平台。项目原为前端 SPA（Vue 3 + Three.js），所有数据采用前端硬编码模拟或 localStorage 存储。第一阶段需将**人员管理**与**设备管理**模块接入后端数据库。

项目**已有轨迹相关的数据库**（`trajectory_points` 表），本次设计是在其基础上补充人员和设备管理模块，并通过 `device_id` 与轨迹数据关联。

### 1.2 设计范围

| 模块         | 说明                   |
| ---------- | -------------------- |
| **人员管理**   | 企业组织架构（部门）、人员基本信息    |
| **定位设备管理** | 人员佩戴的定位标签/腕带终端       |
| **信标设备管理** | 部署在场所中的定位基础设施（锚点）    |
| **绑定关系管理** | 人员与定位设备的一对一绑定（含历史追溯） |
| **告警事件**   | 系统告警事件记录，关联设备与人员     |
| **业务区域**   | 平台中的物理/业务区域定义        |

### 1.3 核心关联关系

```
personnel (1) ──── (1) person_device_binding (1) ──── (1) device
                                        │
                                        └── area / permission 等业务属性

device (1) ──── (N) trajectory_points (已存在)
device (1) ──── (N) alert_event

personnel (1) ──── (N) alert_event

beacon ──── 独立的基础设施台账，通过 area 与业务区域关联
```

---

## 二、表结构详解

### 2.1 部门表 (`department`)

企业组织架构中的部门或团队。

| 字段            | 类型           | 约束                          | 说明                          |
| ------------- | ------------ | --------------------------- | --------------------------- |
| `id`          | BIGINT       | PK, AUTO_INCREMENT          | 自增主键                        |
| `name`        | VARCHAR(50)  | NOT NULL                    | 部门名称，如"研发部"                 |
| `code`        | VARCHAR(20)  | UNIQUE, NOT NULL            | 部门编码，如 `deptRD`，供前端 i18n 引用 |
| `description` | VARCHAR(200) | DEFAULT NULL                | 部门描述                        |
| `created_at`  | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | 创建时间                        |
| `updated_at`  | DATETIME     | ON UPDATE CURRENT_TIMESTAMP | 更新时间                        |

**设计说明：**

- `code` 字段对应前端 `IdentityView.vue` 中的 `departmentKey`（如 `deptRD`、`deptOps`），前端通过 `departmentMap` 映射到 i18n key。
- 采用独立的部门表而非硬编码枚举，便于未来在管理后台维护。 

### 2.2 人员表 (`personnel`)

平台所有人员的核心信息。

| 字段              | 类型           | 约束                          | 说明                                                    |
| --------------- | ------------ | --------------------------- | ----------------------------------------------------- |
| `id`            | BIGINT       | PK, AUTO_INCREMENT          | 自增主键                                                  |
| `person_id`     | VARCHAR(20)  | UNIQUE, NOT NULL            | 人员编号，如 `P-001`，业务标识符                                  |
| `name`          | VARCHAR(50)  | NOT NULL                    | 姓名                                                    |
| `department_id` | BIGINT       | FK → department.id          | 所属部门（支持 NULL）                                         |
| `role`          | VARCHAR(20)  | NOT NULL, DEFAULT 'user'    | 角色: `admin`, `operator`, `auditor`, `user`, `visitor` |
| `phone`         | VARCHAR(20)  | DEFAULT NULL                | 联系电话                                                  |
| `email`         | VARCHAR(100) | DEFAULT NULL                | 电子邮箱                                                  |
| `status`        | TINYINT      | NOT NULL, DEFAULT 1         | 1=在职/激活, 0=离职/停用                                      |
| `remark`        | VARCHAR(500) | DEFAULT NULL                | 备注                                                    |
| `created_at`    | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | 创建时间                                                  |
| `updated_at`    | DATETIME     | ON UPDATE CURRENT_TIMESTAMP | 更新时间                                                  |

**索引：**

- `uk_person_id`: 人员编号唯一索引
- `idx_department_id`: 部门外键索引
- `idx_status`: 状态筛选索引

**设计说明：**

- `person_id` 是业务标识符（如 `P-001`），在 API 响应和前端显示中使用；`id` 是内部主键，用于外键关联。
- `role` 字段使用枚举字符串而非独立表，因角色类型固定且数量少（5种），符合前端 `roleMap` 的定义。
- `status` 使用 TINYINT 以支持未来扩展（如 2=休假, 3=外派）。

### 2.3 定位设备表 (`device`)

人员佩戴/携带的定位终端设备（标签、腕带等）。**这是轨迹数据的外键关联目标**。

| 字段                 | 类型           | 约束                          | 说明                                     |
| ------------------ | ------------ | --------------------------- | -------------------------------------- |
| `id`               | BIGINT       | PK, AUTO_INCREMENT          | 自增主键                                   |
| `device_id`        | VARCHAR(50)  | UNIQUE, NOT NULL            | 设备编号，如 `TAG-10086`                     |
| `device_type`      | VARCHAR(20)  | NOT NULL, DEFAULT 'tag'     | 类型: `tag`=定位标签, `wristband`=腕带         |
| `protocol`         | VARCHAR(10)  | NOT NULL, DEFAULT 'UWB'     | 协议: `UWB`, `BLE`                       |
| `firmware_version` | VARCHAR(20)  | DEFAULT NULL                | 固件版本，如 `v2.4.1`                        |
| `battery`          | INT          | NOT NULL, DEFAULT 0         | 电量百分比 0-100                            |
| `status`           | VARCHAR(20)  | NOT NULL, DEFAULT 'online'  | 状态: `online`, `offline`, `low_battery` |
| `last_report_time` | DATETIME     | DEFAULT NULL                | 最后上报时间（由 MQTT 心跳更新）                    |
| `remark`           | VARCHAR(500) | DEFAULT NULL                | 备注                                     |
| `created_at`       | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | 创建时间                                   |
| `updated_at`       | DATETIME     | ON UPDATE CURRENT_TIMESTAMP | 更新时间                                   |

**索引：**

- `uk_device_id`: 设备编号唯一索引
- `idx_status`: 状态筛选索引
- `idx_device_type`: 设备类型筛选索引

**设计说明：**

- `device_id` 同时作为**轨迹表的外键**——项目现有的 `trajectory_service.ts` 中查询轨迹时使用 `deviceId` 参数。轨迹表 `trajectory_points` 通过 `device_id` 与此表关联。
- `battery` 用 INT 而非 VARCHAR（前端 mock 中为 `"86%"`），更利于计算和筛选（如 `WHERE battery < 20`）。
- `status` 中的 `low_battery` 状态对应前端 IdentityView 中的 `warn` 状态显示。

### 2.4 信标设备表 (`beacon`)

部署在场所中的定位信标（锚点），属于定位基础设施。**不与人员直接绑定**，但通过部署区域与业务关联。

| 字段                   | 类型           | 约束                          | 说明                                           |
| -------------------- | ------------ | --------------------------- | -------------------------------------------- |
| `id`                 | BIGINT       | PK, AUTO_INCREMENT          | 自增主键                                         |
| `beacon_id`          | VARCHAR(50)  | UNIQUE, NOT NULL            | 信标编号，如 `BCN-A-001`                           |
| `model`              | VARCHAR(100) | DEFAULT NULL                | 设备型号，如 `UWB Anchor X2`                       |
| `firmware_version`   | VARCHAR(20)  | DEFAULT NULL                | 固件版本                                         |
| `protocol`           | VARCHAR(10)  | NOT NULL, DEFAULT 'UWB'     | 协议: `UWB`, `BLE`                             |
| `battery`            | INT          | NOT NULL, DEFAULT 0         | 电量百分比 0-100                                  |
| `area`               | VARCHAR(50)  | DEFAULT NULL                | 部署区域名称                                       |
| `status`             | VARCHAR(20)  | NOT NULL, DEFAULT 'online'  | `online`=在线, `maintenance`=维护中, `offline`=离线 |
| `last_calibrated_at` | DATETIME     | DEFAULT NULL                | 最近校准时间                                       |
| `remark`             | VARCHAR(500) | DEFAULT NULL                | 备注                                           |
| `created_at`         | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | 创建时间                                         |
| `updated_at`         | DATETIME     | ON UPDATE CURRENT_TIMESTAMP | 更新时间                                         |

**设计说明：**

- 信标设备与定位设备（`device` 表）是两类不同实体，遵循前端 `IdentityView` vs `BeaconDeviceView` 的分离设计。
- `area` 使用 VARCHAR 而非 FK 引用 `area` 表，因为信标的部署区域可能比业务区域更细致（如"办公区A-东北角"），且作为固定台账信息不需要强关联。

### 2.5 人员-设备绑定关系表 (`person_device_binding`)

核心业务表，维护人员与定位设备的一对一绑定关系。

| 字段                      | 类型           | 约束                          | 说明              |
| ----------------------- | ------------ | --------------------------- | --------------- |
| `id`                    | BIGINT       | PK, AUTO_INCREMENT          | 自增主键            |
| `person_id`             | BIGINT       | FK → personnel.id           | 人员 ID           |
| `device_id`             | BIGINT       | FK → device.id              | 设备 ID           |
| `area`                  | VARCHAR(50)  | DEFAULT NULL                | 常驻区域            |
| `permission`            | VARCHAR(50)  | DEFAULT NULL                | 授权范围            |
| `permission_expires_at` | DATETIME     | DEFAULT NULL                | 授权到期时间          |
| `bound_at`              | DATETIME     | NOT NULL                    | 绑定时间            |
| `unbound_at`            | DATETIME     | DEFAULT NULL                | 解绑时间（NULL=当前有效） |
| `remark`                | VARCHAR(500) | DEFAULT NULL                | 备注              |
| `created_at`            | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | 创建时间            |
| `updated_at`            | DATETIME     | ON UPDATE CURRENT_TIMESTAMP | 更新时间            |

**索引与约束：**

- `uk_person_device_active`: 联合唯一索引 `(person_id, unbound_at)`——同一人员在同一时间段只能有一条有效绑定
- `uk_device_person_active`: 联合唯一索引 `(device_id, unbound_at)`——同一设备同一时间只能绑定一人
- `fk_binding_personnel`: 外键 → `personnel.id`，级联删除/更新
- `fk_binding_device`: 外键 → `device.id`，级联删除/更新

**设计说明：**

- **逻辑约束**（前端代码 `IdentityView.vue` 注释）："人员编号只能出现在一条绑定关系中"、"设备换绑后自动释放旧库存"。这两个约束通过 `uk_person_device_active` 和 `uk_device_person_active` 实现。
- **历史追溯**：使用 `unbound_at` 而非物理删除。`unbound_at IS NULL` 表示当前有效绑定。这满足前端显示"当前选中"和历史记录查询的需求。
- **授权时间**：`permission_expires_at` 支持临时授权场景（如访客A的"18:00过期"），可触发定时任务自动解绑或告警。

### 2.6 告警事件表 (`alert_event`)

系统产生的告警/事件记录。

| 字段            | 类型           | 约束                          | 说明                                                          |
| ------------- | ------------ | --------------------------- | ----------------------------------------------------------- |
| `id`          | BIGINT       | PK, AUTO_INCREMENT          | 自增主键                                                        |
| `event_id`    | VARCHAR(50)  | UNIQUE, NOT NULL            | 事件编号，如 `E-1025`                                             |
| `title`       | VARCHAR(200) | NOT NULL                    | 事件标题                                                        |
| `device_id`   | VARCHAR(50)  | DEFAULT NULL                | 关联设备编号（`device.device_id`）                                  |
| `person_id`   | VARCHAR(20)  | DEFAULT NULL                | 关联人员编号（`personnel.person_id`）                               |
| `area`        | VARCHAR(50)  | DEFAULT NULL                | 事件发生区域                                                      |
| `event_type`  | VARCHAR(20)  | NOT NULL                    | `crossing`=越界, `gather`=聚集, `low_battery`=低电量, `offline`=离线 |
| `alert_level` | VARCHAR(10)  | NOT NULL, DEFAULT 'warn'    | `alarm`=高, `warn`=中, `normal`=低                             |
| `status`      | VARCHAR(20)  | NOT NULL, DEFAULT 'pending' | `pending`=待处理, `processing`=处理中, `closed`=已关闭               |
| `remark`      | VARCHAR(500) | DEFAULT NULL                | 处理备注                                                        |
| `occurred_at` | DATETIME     | NOT NULL                    | 事件发生时间                                                      |
| `created_at`  | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | 创建时间                                                        |
| `updated_at`  | DATETIME     | ON UPDATE CURRENT_TIMESTAMP | 更新时间                                                        |

**设计说明：**

- `device_id` 和 `person_id` 使用业务标识符（`VARCHAR`）而非内部 `id`（`BIGINT`），因为告警可能来源于 MQTT 实时消息，此时的设备数据可能尚未入库。这避免了必须等待设备入库才能创建告警的时序耦合。
- `event_type` 和 `alert_level` 使用字符串枚举，与前端 `EventCenterView.vue` 中的类型定义一致。

### 2.7 业务区域表 (`area`)

平台定义的物理/业务区域，对应 `SceneConfig` 中的 fences/areas。

| 字段            | 类型           | 约束                          | 说明                        |
| ------------- | ------------ | --------------------------- | ------------------------- |
| `id`          | BIGINT       | PK, AUTO_INCREMENT          | 自增主键                      |
| `area_id`     | VARCHAR(50)  | UNIQUE, NOT NULL            | 区域编号，如 `AREA-Office-A`    |
| `name`        | VARCHAR(50)  | NOT NULL                    | 区域名称                      |
| `type`        | VARCHAR(20)  | NOT NULL, DEFAULT 'zone'    | `zone`=业务区域, `fence`=围栏区域 |
| `description` | VARCHAR(200) | DEFAULT NULL                | 区域描述                      |
| `color`       | VARCHAR(20)  | DEFAULT NULL                | 显示颜色，如 `#2e86ff`          |
| `created_at`  | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | 创建时间                      |
| `updated_at`  | DATETIME     | ON UPDATE CURRENT_TIMESTAMP | 更新时间                      |

---

## 三、参考：轨迹点表结构（已存在）

以下为 `trajectory_points` 表的参考结构。此表**不属于本次建表范围**，仅说明其与本 schema 的关联方式：

```sql
CREATE TABLE `trajectory_points` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT,
    `device_id` VARCHAR(50)  NOT NULL          COMMENT '设备编号，关联 device.device_id',
    `x`         INT          NOT NULL DEFAULT 0 COMMENT 'X坐标，存储值 = 实际值 × 1000',
    `y`         INT          NOT NULL DEFAULT 0 COMMENT 'Y坐标，存储值 = 实际值 × 1000',
    `z`         INT          NOT NULL DEFAULT 0 COMMENT 'Z坐标，存储值 = 实际值 × 1000',
    `theta`     INT          NOT NULL DEFAULT 0 COMMENT '朝向角度，存储值 = 实际值 × 1000',
    `timestamp` BIGINT       NOT NULL          COMMENT 'Unix毫秒时间戳',
    `created_at` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_device_id` (`device_id`),
    KEY `idx_timestamp` (`timestamp`),
    KEY `idx_device_timestamp` (`device_id`, `timestamp`),
    CONSTRAINT `fk_trajectory_device` FOREIGN KEY (`device_id`) 
        REFERENCES `device`(`device_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轨迹点表（已存在）';
```

**关联说明**：

- `trajectory_points.device_id` → `device.device_id`：轨迹点通过设备编号关联到设备表
- 前端 `trajectoryService.ts` 中 `fetchTrajectoryPoints()` 的 `deviceId` 参数即是此字段
- 坐标存储为 `INT = 实际值 × 1000`，前端读取时 `/1000` 还原

---

## 四、模拟数据来源与映射

### 4.1 人员数据来源

| 前端组件                             | 模拟数据                 | 对应 SQL                |
| -------------------------------- | -------------------- | --------------------- |
| `IdentityView.vue` `rawBindings` | 5条人员记录（P-001~P-005）  | `personnel` 表 id 1-5  |
| 补充（参考摘要"248人"）                   | 新增5条（P-006~P-010）    | `personnel` 表 id 6-10 |
| 部门字段映射                           | `departmentKey` → 名称 | `department` 表 5个部门   |

### 4.2 设备数据来源

| 前端组件                        | 模拟数据               | 对应 SQL             |
| --------------------------- | ------------------ | ------------------ |
| `IdentityView.vue` 绑定中的设备   | 4台定位设备（TAG-10086等） | `device` 表 id 1-4  |
| `EventCenterView.vue` 提及的设备 | TAG-10042          | `device` 表 id 5    |
| 补充（参考摘要"18台库存"）             | 新增5台库存设备           | `device` 表 id 6-10 |

### 4.3 信标数据来源

| 前端组件                                | 模拟数据             | 对应 SQL            |
| ----------------------------------- | ---------------- | ----------------- |
| `BeaconDeviceView.vue` `rawBeacons` | 4台信标（BCN-A-001等） | `beacon` 表 id 1-4 |
| 补充（参考摘要"64台"）                       | 新增4台覆盖各类型        | `beacon` 表 id 5-8 |

### 4.4 告警事件数据来源

| 前端组件                           | 模拟数据              | 对应 SQL                     |
| ------------------------------ | ----------------- | -------------------------- |
| `EventCenterView.vue` `events` | 4条（E-1025~E-1028） | `alert_event` 表 id 1-4     |
| `HomeView.vue` `events`        | 4条活动事件            | 去重后 `alert_event` 表 id 5-6 |

### 4.5 绑定关系数据来源

| 前端组件                    | 模拟数据         | 对应 SQL                               |
| ----------------------- | ------------ | ------------------------------------ |
| `IdentityView.vue` 绑定关系 | 4条有效+1条待分配   | `person_device_binding` 表 id 1-4（有效） |
| 补充                      | 1条历史绑定+1条新绑定 | `person_device_binding` 表 id 5-6     |

---

## 五、API 与前端对照

### 5.1 现有 API 映射

| 前端调用                         | 方法    | 所需后端实现              |
| ---------------------------- | ----- | ------------------- |
| `GET /api/trajectory/points` | Axios | ✅ 已存在轨迹数据接口         |
| `GET /api/alerts`            | Axios | 从 `alert_event` 表查询 |
| `POST /api/models/upload`    | fetch | 地图模型管理（已有）          |
| `GET /api/models`            | fetch | 地图列表（已有）            |

### 5.2 新增 API 建议

| 接口                             | 说明            | 涉及表                                  |
| ------------------------------ | ------------- | ------------------------------------ |
| `GET /api/personnel`           | 人员列表（支持分页/搜索） | `personnel`, `department`            |
| `GET /api/personnel/:id`       | 人员详情          | `personnel`, `person_device_binding` |
| `POST /api/personnel`          | 新增人员          | `personnel`                          |
| `PUT /api/personnel/:id`       | 更新人员          | `personnel`                          |
| `GET /api/devices`             | 设备列表          | `device`                             |
| `GET /api/devices/:id`         | 设备详情          | `device`, `person_device_binding`    |
| `GET /api/bindings`            | 绑定关系列表        | `person_device_binding` + JOIN       |
| `POST /api/bindings`           | 创建绑定          | `person_device_binding`              |
| `PUT /api/bindings/:id/unbind` | 解绑            | `person_device_binding`              |
| `GET /api/beacons`             | 信标列表          | `beacon`                             |
| `GET /api/areas`               | 业务区域列表        | `area`                               |

### 5.3 前端字段映射

前端 `IdentityView.vue` 中使用的字段与数据库列的对照：

| 前端显示字段       | 数据库来源                              | 说明              |
| ------------ | ---------------------------------- | --------------- |
| `personId`   | `personnel.person_id`              |                 |
| `personName` | `personnel.name`                   |                 |
| `department` | `department.name`                  | LEFT JOIN       |
| `role`       | `personnel.role`                   | 映射 i18n key     |
| `deviceId`   | `device.device_id`                 | 通过 binding JOIN |
| `deviceType` | `device.device_type`               |                 |
| `protocol`   | `device.protocol`                  |                 |
| `battery`    | `device.battery`                   | INT 转 "86%" 格式  |
| `firmware`   | `device.firmware_version`          |                 |
| `area`       | `person_device_binding.area`       |                 |
| `permission` | `person_device_binding.permission` |                 |
| `status`     | 根据 `device.status` + `binding` 计算  | 前端逻辑            |

---

## 六、执行说明

### 6.1 前置条件

- MySQL 8.0+（支持 utf8mb4）
- 已有轨迹数据库 `twintrack`（或使用其他名称）

### 6.2 执行建表

```bash
mysql -u root -p < docs/database/schema.sql
```

或登录后执行：

```sql
SOURCE docs/database/schema.sql;
```

### 6.3 验证

执行后检查表是否创建成功：

```sql
USE twintrack;
SHOW TABLES;
-- 预期输出: department, personnel, device, beacon, person_device_binding, alert_event, area

-- 检查种子数据
SELECT COUNT(*) FROM personnel;  -- 10
SELECT COUNT(*) FROM device;     -- 10
SELECT COUNT(*) FROM beacon;     -- 8
SELECT COUNT(*) FROM person_device_binding; -- 6
```

### 6.4 与轨迹表关联

如果 `trajectory_points` 表已存在且已有数据，可执行以下 SQL 检查设备编号的关联性：

```sql
-- 查看轨迹数据关联到设备表的完整性
SELECT t.device_id, d.device_id AS matched
FROM (SELECT DISTINCT device_id FROM trajectory_points) t
LEFT JOIN device d ON t.device_id = d.device_id
WHERE d.device_id IS NULL;
-- 预期结果：空集（所有轨迹点都能关联到设备），否则需要补充缺失的设备记录
```

---

## 七、后续扩展建议

1. **建立后端项目**：建议使用 Node.js (NestJS/Express) 或 Java (Spring Boot) 对接本 schema
2. **数据同步**：设备 `status` 和 `battery` 等动态字段应由 MQTT 服务更新，可建立 MQTT Consumer 服务
3. **历史数据归档**：`person_device_binding` 的 `unbound_at` 字段支持历史查询；对于轨迹数据可建立独立归档表
4. **权限体系**：当前 `role` 为简单枚举，如需精细权限控制建议引入 RBAC 表结构
5. **设备分组**：若需按区域批量管理信标，可增加 `beacon_group` 表
