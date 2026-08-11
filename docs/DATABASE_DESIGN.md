# TwinTrack 数据库设计

> 数据库：PostgreSQL 15+
>
> 数据库名：`dfmotion`
>
> 初始化脚本：[init_postgresql.sql](init_postgresql.sql)
>
> 当前版本：2.0.0（全量重建设计）

## 1. 部署原则

`init_postgresql.sql` 是全量重建脚本，不是增量迁移脚本。执行时会：

1. 连接 PostgreSQL 的 `postgres` 管理库。
2. 终止所有连接到 `dfmotion` 的会话。
3. 删除 `dfmotion` 数据库。
4. 重新创建空的 `dfmotion` 数据库。
5. 创建管理、告警和轨迹表、索引、约束、函数及触发器。
6. 创建当前月和下个月的轨迹分区。

脚本不包含演示数据。人员、部门、设备和信标数据通过管理页面新增或 CSV 导入。

## 2. 数据关系

```text
department 1 ─── N personnel
personnel  1 ─── 0..1 device
device     1 ─── N device_location_history
device 状态转为 SOS ─── N alert_event
beacon 独立保存三维坐标
area 为事件中心和区域筛选提供基础数据
app_user 保存登录账号、BCrypt 密码摘要和用户等级
```

人员与设备只维护当前绑定，不再保存历史绑定、权限和授权到期时间。关系直接保存在 `device.personnel_id`：

- `NULL`：设备未绑定。
- 非空：关联 `personnel.id`。
- `UNIQUE`：同一人员最多绑定一台设备。
- 一个设备只有一个 `personnel_id`，因此一台设备最多绑定一人。
- 删除人员时使用 `ON DELETE SET NULL`，设备自动变为未绑定。

## 3. 表结构

### 3.1 `app_user`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK, IDENTITY | 登录用户主键 |
| `username` | VARCHAR(64) | UNIQUE, NOT NULL | 登录用户名 |
| `password_hash` | VARCHAR(255) | NOT NULL | BCrypt 密码摘要，禁止保存明文 |
| `user_level` | SMALLINT | NOT NULL, CHECK | `0` 管理员，`1` 普通用户 |

管理员可以调用全部接口；普通用户只能调用查询接口。首次部署通过
`DFMOTION_INITIAL_ADMIN_USERNAME` 和 `DFMOTION_INITIAL_ADMIN_PASSWORD` 创建初始管理员，
后端写入数据库前会使用 BCrypt 处理密码。

### 3.2 `department`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK, IDENTITY | 内部关联主键 |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | 部门编号 |
| `name` | VARCHAR(100) | NOT NULL | 部门名称 |

部门人数不保存为字段，通过以下查询实时计算：

```sql
SELECT d.code, d.name, COUNT(p.id) AS personnel_count
FROM department d
LEFT JOIN personnel p ON p.department_id = d.id
GROUP BY d.id, d.code, d.name;
```

### 3.3 `personnel`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK, IDENTITY | 内部关联主键 |
| `person_id` | VARCHAR(50) | UNIQUE, NOT NULL | 人员编号 |
| `name` | VARCHAR(100) | NOT NULL | 姓名 |
| `department_id` | BIGINT | FK, NULL | 所属部门 |

“已绑定设备 / 未绑定”不保存为字段，通过 `device.personnel_id` 是否存在实时计算。

### 3.4 `device`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK, IDENTITY | 内部关联主键 |
| `device_id` | VARCHAR(64) | UNIQUE, NOT NULL | 定位设备唯一编号 |
| `personnel_id` | BIGINT | UNIQUE, FK, NULL | 当前绑定人员 |
| `battery` | SMALLINT | NOT NULL, DEFAULT 80, 0–100 | 电量百分比 |
| `status` | VARCHAR(10) | NOT NULL, DEFAULT `offline` | `online`、`offline`、`SOS` |

`device_id` 同时是轨迹数据中的设备业务编号。它只要求非空且唯一，不限制为
MAC 地址，可保存 MAC、IMEI、序列号或 `860000000000022` 这类自定义编号。

### 3.5 `beacon`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK, IDENTITY | 内部关联主键 |
| `beacon_id` | VARCHAR(64) | UNIQUE, NOT NULL | 信标唯一编号 |
| `x` | DOUBLE PRECISION | NOT NULL, DEFAULT 0 | X 坐标 |
| `y` | DOUBLE PRECISION | NOT NULL, DEFAULT 0 | Y 坐标 |
| `z` | DOUBLE PRECISION | NOT NULL, DEFAULT 0 | Z 坐标 |
| `battery` | SMALLINT | NOT NULL, DEFAULT 80, 0–100 | 电量百分比 |
| `status` | VARCHAR(10) | NOT NULL, DEFAULT `offline` | 预留状态字符串 |

### 3.6 `alert_event`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK, IDENTITY | 内部主键 |
| `event_id` | VARCHAR(100) | UNIQUE, NOT NULL | 告警业务编号 |
| `title` | VARCHAR(200) | NOT NULL | 告警标题 |
| `device_id` | VARCHAR(64) | NULL | 设备业务编号 |
| `person_id` | VARCHAR(50) | NULL | 人员业务编号 |
| `area` | VARCHAR(100) | NULL | 发生区域 |
| `event_type` | VARCHAR(20) | NOT NULL | 告警类型 |
| `alert_level` | VARCHAR(10) | NOT NULL | `alarm`、`warn`、`normal` |
| `status` | VARCHAR(20) | NOT NULL | `pending`、`processing`、`closed` |
| `remark` | VARCHAR(500) | NULL | 处理备注 |
| `occurred_at` | TIMESTAMPTZ | NOT NULL | 发生时间 |

`device_id` 和 `person_id` 不使用外键，使历史告警在设备或人员删除后仍能保留。

### 3.7 `area`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK, IDENTITY | 内部主键 |
| `area_id` | VARCHAR(64) | UNIQUE, NOT NULL | 区域编号 |
| `name` | VARCHAR(100) | NOT NULL | 区域名称 |
| `type` | VARCHAR(20) | NOT NULL | `zone` 或 `fence` |
| `color` | VARCHAR(20) | NULL | 前端显示颜色 |

### 3.8 `device_location_history`

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `id` | BIGINT | IDENTITY | 轨迹记录编号 |
| `device_id` | VARCHAR(64) | FK, NOT NULL | 定位设备唯一编号 |
| `server_ts` | TIMESTAMPTZ | 分区键, NOT NULL | 服务端时间 |
| `x_mm` | INTEGER | NOT NULL | X 坐标，毫米 |
| `y_mm` | INTEGER | NOT NULL | Y 坐标，毫米 |
| `z_mm` | INTEGER | NOT NULL, DEFAULT 0 | Z 坐标，毫米 |
| `theta_mrad` | INTEGER | NULL | 朝向，毫弧度 |

该表按 `server_ts` 月度分区。初始化脚本创建当前月和下个月分区；后端 `PartitionManagerTask` 继续维护后续分区。

## 4. SOS 数据库规则

`trg_device_sos_alert` 监听 `device`：

- 新增设备时状态为 `SOS`：创建告警。
- 更新时状态从非 `SOS` 变为 `SOS`：创建告警。
- `SOS` 更新为 `SOS`：不重复创建。
- 状态离开 SOS 后再次进入 SOS：创建新告警。

告警固定写入：

```text
event_type  = sos
alert_level = alarm
status      = pending
title       = 定位设备 SOS 告警
```

人员编号从设备当前的 `personnel_id` 关系查询；设备未绑定时 `person_id` 为 `NULL`。前端只负责轮询并显示全局通知，不再负责插入 SOS 告警。

## 5. 保留的兼容对象

当前后端 `AlertMapper` 仍访问 `public.alert`。数据库不再创建第二张告警表，而是创建：

- `alert` 视图：从 `alert_event` 映射旧查询字段。
- `trg_alert_compatibility_insert`：将旧的 `INSERT INTO alert` 转写到 `alert_event`。

这两个对象目前仍被后端使用，不属于无用结构。后端统一改为 `alert_event` 后可以删除。

## 6. 已删除结构

| 删除内容 | 原因 |
| --- | --- |
| `person_device_binding` 表 | 页面只需要当前绑定，改由 `device.personnel_id` 直接维护 |
| 人员 `role/phone/email/status/remark` | 当前人员管理页面不采集、不展示 |
| 设备 `device_type/protocol/firmware_version/last_report_time/remark` | 当前定位设备管理页面不采集、不展示 |
| 信标 `model/firmware_version/protocol/area/last_calibrated_at/remark` | 当前信标页面只管理编号、坐标、电量、状态 |
| 各管理表 `created_at/updated_at` | 当前业务没有审计时间需求 |
| 绑定的 `area/permission/permission_expires_at/unbound_at` | 不再保存绑定历史和权限 |
| 轨迹 `created_at/trajectory_id/quality_flag/sample_type` | 当前 `TrajectoryMapper` 不读写 |
| 初始化演示数据 | 全量部署应生成空业务库 |
| 旧表迁移和 `ALTER TABLE` 逻辑 | 当前脚本只用于从零重建 |

## 7. 后端接口同步结果

后端管理接口已按 2.0.0 数据库结构完成以下同步：

1. 人员、设备查询改为 `device.personnel_id = personnel.id`，删除 `person_device_binding` JOIN。
2. 人员 DTO 只保留 `personId`、`name`、`departmentCode`。
3. 设备 DTO 只保留 `deviceId`、`boundPersonId`、`battery`、`status`。
4. 设备写入时将 `boundPersonId` 查询并转换成 `personnel.id`。
5. 信标 DTO/VO 只保留 `beaconId`、`x`、`y`、`z`、`battery`、`status`。
6. 增加部门 CRUD 和实时部门人数统计查询。
7. 首页活跃人员数改为人员总数；低电量设备使用 `battery < 20`。
8. SOS 告警由数据库触发器生成，设备更新接口不再重复插入。

管理接口继续使用不带 `/api` 的后端路由；部署环境由反向代理添加 `/api` 前缀。
列表接口统一返回 `Result<PageResult<T>>`，新增、修改和删除接口统一返回 `Result<T>`。

### 7.1 未知轨迹设备自动注册

后端可在轨迹批量写入前自动补录 `device` 表中不存在的设备编号：

```yaml
dfmotion:
  trajectory:
    auto-register-unknown-devices: true
```

启用时，自动注册与本批轨迹写入处于同一事务。新设备默认未绑定人员，电量为 `80`，
状态为 `online`；设备编号采用轨迹上报的 `deviceId` 原值。并发首次上报通过
`ON CONFLICT (device_id) DO NOTHING` 保持幂等。

设置为 `false` 后不再补录设备，未知设备的轨迹会继续被
`device_location_history.device_id` 外键拒绝。部署时也可通过环境变量
`DFMOTION_TRAJECTORY_AUTO_REGISTER_UNKNOWN_DEVICES` 覆盖该配置。

## 8. 全量部署

### 8.1 备份

```bash
pg_dump -h <数据库主机> -U <数据库用户> -Fc \
  -d dfmotion -f dfmotion_before_rebuild.dump
```

### 8.2 停止服务

停止 `dfmotion` 后端、MQTT 轨迹写入进程以及其他访问 `dfmotion` 的服务。脚本会主动终止残留数据库连接。

### 8.3 执行

```bash
psql -h <数据库主机> -U <数据库所有者或超级用户> \
  -d postgres -f docs/init_postgresql.sql
```

执行账号应为 `dfmotion` 数据库所有者或 PostgreSQL 超级用户，并具备终止现有连接和重新创建数据库的权限。

### 8.4 启动认证服务

后端数据库凭据、JWT 签名密钥和初始管理员密码不再写入配置文件。首次启动前设置：

```bash
export DB_URL='jdbc:postgresql://<数据库主机>:5432/dfmotion'
export DB_USERNAME='<数据库用户名>'
export DB_PASSWORD='<数据库密码>'
export DFMOTION_JWT_SECRET='<至少 32 字节的随机密钥>'
export DFMOTION_INITIAL_ADMIN_USERNAME='admin'
export DFMOTION_INITIAL_ADMIN_PASSWORD='<至少 8 位的初始密码>'
```

首次启动会在用户表为空时创建 `user_level = 0` 的管理员，密码只以 BCrypt 摘要保存。
确认管理员创建成功后，应从长期部署配置中移除 `DFMOTION_INITIAL_ADMIN_PASSWORD`。
现有数据库应先执行 `docs/migrations/20260805_create_app_user.sql`。

配置中心的用户管理接口为 `/api/users`：列表、创建、修改、修改密码和删除均只允许
管理员访问。创建账号时使用默认密码 `deepfusionrobotics`；管理员之后可通过
`PUT /api/users/{id}/password` 设置 8 到 128 位的新密码。后端在写入
`app_user.password_hash` 前使用 BCrypt 生成不可逆摘要，接口响应不会返回密码或摘要。
系统禁止删除当前账号、降低当前管理员等级，以及删除或降级最后一个管理员。

JWT 和 BCrypt 分别解决接口身份校验与数据库密码保护，不会加密浏览器到服务器之间的
网络传输。生产环境必须在反向代理或网关启用 HTTPS，并将 HTTP 重定向到 HTTPS；JWT
签名密钥应通过安全的部署变量注入，不应提交到代码仓库。

### 8.5 验证

```sql
\c dfmotion
\dt public.*
\dv public.*

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

SELECT child.relname AS partition_name
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'device_location_history'
ORDER BY child.relname;
```

预期业务表：

```text
app_user
department
personnel
device
beacon
area
alert_event
device_location_history
device_location_history_YYYY_MM（当前月）
device_location_history_YYYY_MM（下个月）
```

预期兼容视图：

```text
alert
```

### 8.6 验证 SOS

```sql
INSERT INTO device (device_id) VALUES ('860000000000022');
UPDATE device
SET status = 'SOS'
WHERE device_id = '860000000000022';

SELECT event_id, device_id, event_type, alert_level, status
FROM alert_event
WHERE device_id = '860000000000022';
```

应只新增一条 `event_type = 'sos'` 的告警。重复执行同一条 `UPDATE ... SET status = 'SOS'` 不应新增告警。
