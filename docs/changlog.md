# 人员设备中心数据库变更记录

## 2026-07-31 — 2.0.0 全量重建

`docs/init_postgresql.sql` 已由“增量兼容初始化”改为“删除并重新创建 `dfmotion` 数据库”的全量部署脚本。

### 主要变化

- 删除 `person_device_binding`，当前绑定改为 `device.personnel_id`。
- 删除人员角色、电话、邮箱、在职状态和备注。
- 删除定位设备类型、协议、固件、最后上报时间和备注。
- 删除信标型号、固件、协议、区域、校准时间和备注。
- 删除管理表中当前业务未使用的创建/更新时间字段。
- 删除轨迹表未被 `TrajectoryMapper` 使用的扩展字段。
- 删除所有演示数据和旧数据库增量迁移语句。
- 信标补齐 `x/y/z` 三维坐标。
- 设备和信标电量默认值统一为 `80`。
- 设备状态限定为 `online/offline/SOS`。
- 增加数据库 SOS 触发器，在状态进入 SOS 时自动创建 `alert_event`。
- 保留后端仍在使用的 `alert` 兼容视图，并增加写入转发触发器。
- 轨迹分区改为根据执行日期自动创建当前月与下个月，不再写死月份。

### 破坏性影响

执行脚本会永久删除现有 `dfmotion` 数据库。执行前必须备份并停止所有连接数据库的服务。

旧版 `dfmotion/ManagementMapper.xml` 仍引用已删除列和 `person_device_binding`，不能直接与 2.0.0 数据库配合使用。必须按照 [DATABASE_DESIGN.md](DATABASE_DESIGN.md) 第 7 节同步后端后再部署。

### 部署命令

```bash
pg_dump -h <数据库主机> -U <数据库用户> -Fc \
  -d dfmotion -f dfmotion_before_rebuild.dump

psql -h <数据库主机> -U <数据库所有者或超级用户> \
  -d postgres -f docs/init_postgresql.sql
```

执行账号必须是 `dfmotion` 数据库所有者或 PostgreSQL 超级用户，并具备终止连接与重新建库权限。
