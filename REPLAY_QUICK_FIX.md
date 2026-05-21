# 轨迹回放时间问题 - 快速参考

## 🔧 已修复的 3 个关键问题

| 问题 | 原因 | 修复方案 | 文件 |
|------|------|--------|------|
| **时间漂移** | setInterval 定时器累积误差 | 使用实际经过时间计算 | `TwinScreen.vue:962` |
| **时间转换错误** | 时间戳格式判断不精确 | 基于年份范围判断 | `trajectoryService.ts:77` |
| **帧数不合理** | 固定公式计算不适应不同数据 | 基于时间跨度智能计算 | `TwinScreen.vue:836` |

## 📋 诊断检查清单

```
□ 确认后端时间戳格式一致（毫秒级或秒级）
□ 在浏览器控制台运行 diagnoseReplayTimings()
□ 验证 detectedFormat 显示为 'milliseconds'
□ 检查 Duration 是否与选择的时间范围一致
□ 检查 Frame count 是否在 2-600 之间
□ 验证 Avg frame interval 约为 500ms
```

## 🎯 立即使用

### 方式 1: 直接启用修复（推荐）
1. 代码已自动应用，重新加载页面即可生效
2. 测试轨迹回放，观察是否按实时速度播放

### 方式 2: 进阶诊断
```javascript
// 浏览器控制台执行
diagnoseReplayTimings()
```

查看输出的诊断信息，确认：
- Start time 和 End time 日期正确
- Duration 与选择的时间范围一致
- Frame count 合理（通常 50-200）

## ⚠️ 如果问题仍存在

### 检查 1: 后端数据格式
请求示例：
```
GET /api/trajectory/points?deviceId=TAG-10086&startTime=1747812000000&endTime=1747813800000
```

预期响应：
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

### 检查 2: 时间戳单位
运行诊断，查看时间戳格式是否匹配后端返回的实际格式。

### 检查 3: 播放速度
```javascript
// 确认速度设置生效
console.log('replaySpeed:', replaySpeed.value);
// 应该显示 1（1x速度）或其他设置值
```

## 🚀 性能优化建议

- **查询范围**: 单次不超过 24 小时
- **数据点数**: 单次不超过 10,000 个点
- **帧间隔**: 500ms (自动计算)

## 📞 文档位置

详细文档：[TRAJECTORY_REPLAY_FIX.md](./TRAJECTORY_REPLAY_FIX.md)

---

**版本**: v1.1  
**最后更新**: 2026-05-20
