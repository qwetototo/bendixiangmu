// 2D 平面图几何工具:门吸附墙线与朝向计算,2D 编辑与 3D 生成共用

export function planSegments(plan) {
  const segments = []
  plan?.walls?.forEach((wall) => {
    segments.push({
      a: { x: wall.x1, y: wall.y1 }, b: { x: wall.x2, y: wall.y2 },
      type: 'wall', id: wall.id
    })
  })
  plan?.buildings?.forEach((building) => {
    if (!building.closed) return
    const pts = building.outer || []
    for (let i = 0; i < pts.length; i += 1) {
      segments.push({
        a: pts[i], b: pts[(i + 1) % pts.length],
        type: 'building', id: building.id, edgeIndex: i
      })
    }
  })
  return segments
}

export function projectPointToSegment(point, seg) {
  const dx = seg.b.x - seg.a.x
  const dy = seg.b.y - seg.a.y
  const len2 = dx * dx + dy * dy
  const t = len2
    ? Math.max(0, Math.min(1, ((point.x - seg.a.x) * dx + (point.y - seg.a.y) * dy) / len2))
    : 0
  return {
    x: seg.a.x + t * dx,
    y: seg.a.y + t * dy,
    distance: Math.hypot(point.x - seg.a.x - t * dx, point.y - seg.a.y - t * dy)
  }
}

// 把点吸附到最近的墙线(内部框架或闭合外墙的边);超过 maxDistance(画布像素)则原样返回
export function snapPointToPlan(point, plan, maxDistance = 12) {
  let best = null
  planSegments(plan).forEach((seg) => {
    const hit = projectPointToSegment(point, seg)
    if (!best || hit.distance < best.hit.distance) best = { hit, seg }
  })
  if (!best || best.hit.distance > maxDistance) return { x: point.x, y: point.y, segment: null, distance: best?.hit.distance ?? Infinity }
  return { x: best.hit.x, y: best.hit.y, segment: best.seg, distance: best.hit.distance }
}
