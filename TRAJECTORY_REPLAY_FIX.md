# 轨迹回放时间问题修复指南

## 问题概述
轨迹回放时无法按现实时间速度播放，主要原因包括：
1. 定时器时间累积误差
2. 时间戳格式转换错误
3. 帧数计算不准确

## 已实施的改进

### 1. 改进定时器精度（最重要）
**文件**: `src/views/TwinScreen.vue` - `startReplayTimer()` 函数

**改进内容**:
- 从固定间隔 `100ms` 改为 `50ms`，提高精度
- 使用**实际经过时间**而非固定增量来计算下一帧时间
- 解决了长时间播放的时间漂移问题

**原理**:
```javascript
// 旧方案（不精确）
nextTime = currentTime + 100 * speed

// 新方案（精确）
actualElapsedMs = now - lastUpdateTime  // 实际经过的时间
nextTime = lastReplayTime + actualElapsedMs * speed
```

### 2. 改进时间戳归一化（时间戳检测）
**文件**: `src/services/trajectoryService.ts` - `normalizeTimestamp()` 函数

**改进内容**:
- 使用精确的时间范围判断（2000-2100年）
- 优先判断毫秒级（最常见情况）
- 避免歧义导致的错误转换

**支持的时间戳格式**:
- 毫秒级 (1e12-1e13): 直接使用
- 秒级 (1e9-1e12): 乘以 1000
- 微秒级 (1e14-1e15): 除以 1000
- 纳秒级 (1e17+): 除以 1000000

### 3. 优化帧数计算
**文件**: `src/views/TwinScreen.vue` - `prepareReplayFrameTimes()` 函数

**改进内容**:
- 根据实际时间跨度智能计算帧数
- 目标：每帧之间时间差不超过 500ms（确保插值精度）
- 避免帧数过多导致性能问题，也避免帧数过少导致卡顿

### 4. 添加诊断工具
**导出函数**: `diagnoseTimestamp()` 和 `diagnoseReplayTimings()`

**使用方法**:
```javascript
// 在浏览器控制台调试
diagnoseReplayTimings()  // 输出当前回放的所有时序信息
```

**输出示例**:
```
[Replay Diagnosis]
Total points: 450
Start time: 2026-05-20T10:00:00.000Z (1747812000000)
End time: 2026-05-20T10:30:00.000Z (1747813800000)
Duration: 1800.0s (1800000ms)
Frame count: 120
Avg frame interval: 15000ms
Replay speed: 1
Current replay time: 2026-05-20T10:15:00.000Z (1747812900000)
```

## 使用步骤

### 基础使用
1. **启动回放**: 选择日期和时间范围，点击"开始回放"
2. **调整速度**: 使用播放器右侧的速度倍数选项（支持 0.5x, 1x, 2x 等）
3. **控制播放**: 使用暂停/播放按钮或进度条

### 调试步骤（当播放不正常时）

#### 步骤 1: 打开浏览器开发者工具
- 按 `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- 切换到 **Console** 选项卡

#### 步骤 2: 运行诊断
在控制台输入：
```javascript
diagnoseReplayTimings()
```

#### 步骤 3: 检查诊断结果

**检查项 1**: 时间范围是否合理
- Start time 和 End time 的日期应该匹配你选择的日期
- Duration 应该是你选择的时间范围（如 1800s ≈ 30分钟）

**检查项 2**: 帧数计算
- Frame count 应该在 2-600 之间（REPLAY_MAX_FRAMES = 600）
- Avg frame interval 应该在 500ms 左右
- 如果太少（<10），说明时间跨度计算有问题
- 如果太多（>600），说明数据点太多

**检查项 3**: 时间戳诊断
- 查看底部的 `First point timestamp diagnosis` 和 `Last point timestamp diagnosis`
- 确认 `detectedFormat` 是正确的（应该是 'milliseconds'）

### 常见问题排查

#### 问题 1: 播放速度过快或过慢
**原因**: 时间戳单位转换错误
**解决**:
1. 检查 `diagnoseReplayTimings()` 的输出
2. 验证 `detectedFormat` 是否为 'milliseconds'
3. 若不对，检查后端是否返回了错误格式的时间戳

#### 问题 2: 播放卡顿或跳帧
**原因**: 帧数计算过多，导致插值计算缓慢
**解决**:
1. 查看 `Frame count` 是否接近 600
2. 若是，缩短回放时间范围
3. 或在代码中降低 `targetFrameIntervalMs`（目前为 500ms）

#### 问题 3: 时间显示与实际不符
**原因**: 时间戳精度问题或时区问题
**解决**:
1. 查看 `Start time` 和 `End time` 是否正确
2. 确认浏览器时区设置是否正确
3. 检查后端返回的时间戳是否已包含时区信息

## 后端检查清单

如果调试后仍有问题，请检查后端：

- [ ] 所有时间戳使用统一格式（推荐毫秒级 Unix 时间戳）
- [ ] 时间戳精度足够（建议至少毫秒级）
- [ ] 数据按时间排序（API 应返回 `sort((a, b) => a.timestamp - b.timestamp)`）
- [ ] 时间戳不能为 0 或负数
- [ ] 验证 `startTime` 和 `endTime` 参数是否被正确使用

### 建议的后端数据格式
```json
{
  "data": [
    {
      "deviceId": "TAG-10086",
      "x": 5000,
      "y": 3000,
      "z": 100,
      "theta": 0.5,
      "timestamp": 1747812000000
    }
  ]
}
```

其中 `timestamp` 的单位为毫秒（与 JavaScript `Date.getTime()` 一致）。

## 性能优化建议

1. **缩短查询时间范围**: 一次不查询超过 24 小时的数据
2. **限制数据点数量**: 后端应有 `LIMIT` 机制，最多返回 10000 个点
3. **预加载**: 可在用户开始回放前预加载下一个时间段的数据
4. **缓存**: 对同一时间范围的查询结果进行缓存

## 测试验证

### 快速测试脚本
在浏览器控制台运行：
```javascript
// 1. 验证时间戳转换
console.log('Timestamp tests:');
console.log(diagnoseTimestamp(1747812000000));  // 毫秒级
console.log(diagnoseTimestamp(1747812000));     // 秒级

// 2. 开始回放并诊断
// 选择时间范围，开始回放，然后：
diagnoseReplayTimings();

// 3. 验证播放速度是否正确
// 记录当前时间，等待 10 秒，检查 replayCurrentTime 是否增长了 10 秒（speed=1）
console.log('Current:', replayCurrentTime.value);
setTimeout(() => console.log('After 10s:', replayCurrentTime.value), 10000);
```

## 更新说明

### v1.1 (当前版本)
- ✅ 改进定时器精度，使用实际经过时间计算
- ✅ 优化时间戳格式检测
- ✅ 改进帧数计算算法
- ✅ 添加诊断工具函数

### 未来改进方向
- [ ] 使用 `requestAnimationFrame` 代替 `setInterval`
- [ ] 添加 UI 面板显示回放诊断信息
- [ ] 支持可调节的回放速度范围
- [ ] 数据预缓存机制
