import * as THREE from 'three'
import { snapPointToPlan } from './planGeometry.js'

const generatedTag = 'generated-model'
const metersPerPixel = 0.08
const centerX = 600
const centerY = 340
const toWorldPoint = (point) => ({
  x: (point.x - centerX) * metersPerPixel,
  y: (centerY - point.y) * metersPerPixel
})
const toFloorPoint = (point) => ({
  x: (point.x - centerX) * metersPerPixel,
  z: (point.y - centerY) * metersPerPixel
})

export function buildScene(scene, floors) {
  scene.children.filter((child) => child.userData.tag === generatedTag).forEach((child) => {
    scene.remove(child)
    disposeTree(child)
  })

  const materials = createMaterials()
  const bounds = new THREE.Box3()
  let hasBounds = false
  let baseY = 0

  floors.forEach((floor, floorIndex) => {
    const plan = floor.plan || {}
    const floorHeight = Number(floor.height) > 0 ? Number(floor.height) : 3.6
    const wallHeight = Math.max(2.7, floorHeight - 0.25)
    const group = new THREE.Group()
    group.userData.tag = generatedTag
    group.userData.floorName = floor.name

    ;(plan.buildings || []).forEach((building) => {
      if (!building.closed || building.outer?.length < 3) return
      addFloorPlate(group, building.outer, baseY, materials.floor)
      building.outer.forEach((point, edgeIndex) => {
        const next = building.outer[(edgeIndex + 1) % building.outer.length]
        const perimeterWalls = (plan.walls || []).filter((wall) => wallMatchesBoundaryEdge(wall, point, next))
        if (perimeterWalls.length) {
          perimeterWalls.forEach((wall) => {
            const start = { x: wall.x1, y: wall.y1 }
            const end = { x: wall.x2, y: wall.y2 }
            const intervals = doorIntervals(plan, { type: 'wall', id: wall.id }, start, end)
            addExteriorWall(group, start, end, intervals, baseY + 0.16, wallHeight, materials)
          })
          return
        }

        const intervals = doorIntervals(plan, { type: 'building', id: building.id, edgeIndex }, point, next)
        addExteriorWall(group, point, next, intervals, baseY + 0.16, wallHeight, materials)
      })
    })

    ;(plan.rooms || []).forEach((room) => addRoomTint(group, room, baseY, materials.roomTints[room.tone] || materials.roomTints.blue))
    ;(plan.walls || []).filter((wall) => !isBuildingBoundaryWall(wall, plan.buildings || [])).forEach((wall) => {
      const start = { x: wall.x1, y: wall.y1 }
      const end = { x: wall.x2, y: wall.y2 }
      const intervals = doorIntervals(plan, { type: 'wall', id: wall.id }, start, end)
      addInteriorWall(group, start, end, intervals, baseY + 0.16, 2.35, materials)
    })

    ;(plan.doors || []).forEach((door) => {
      const segment = resolveDoorSegment(door, plan)
      if (!segment) return
      const snapped = snapPointToPlan(door, plan, Infinity)
      const position = toFloorPoint(snapped)
      const marker = doorMarker(Number(door.width) || 0.9, materials)
      marker.position.set(position.x, baseY + 0.16, position.z)
      marker.rotation.y = segmentRotation(segment)
      group.add(marker)
    })

    ;(plan.assets || []).forEach((asset) => {
      if (asset.storageId && asset.format === 'glb') return
      const point = toFloorPoint(asset)
      const model = assetModel(asset, materials)
      model.position.set(point.x, baseY + 0.16, point.z)
      group.add(model)
    })

    if (floorIndex === 0) (plan.siteFeatures || []).forEach((feature) => addSiteFeature(group, feature, baseY, materials))
    scene.add(group)
    group.updateMatrixWorld(true)
    const floorBounds = new THREE.Box3().setFromObject(group)
    if (!floorBounds.isEmpty()) {
      if (!hasBounds) { bounds.copy(floorBounds); hasBounds = true }
      else bounds.union(floorBounds)
    }
    baseY += floorHeight
  })

  return hasBounds ? bounds : null
}

function createMaterials() {
  return {
    floor: markPreviewMaterial(new THREE.MeshStandardMaterial({ color: 0xcfd6d8, roughness: 0.86, metalness: 0.02 }), 'floor-plate'),
    wall: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.78 }),
    wallAccent: new THREE.MeshStandardMaterial({ color: 0x71828c, roughness: 0.68, metalness: 0.3 }),
    facade: markPreviewMaterial(new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.78 }), 'exterior'),
    facadeAccent: markPreviewMaterial(new THREE.MeshStandardMaterial({ color: 0x71828c, roughness: 0.68, metalness: 0.3 }), 'exterior'),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x78c8d5, roughness: 0.18, metalness: 0.12, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    facadeGlass: new THREE.MeshPhysicalMaterial({ color: 0x78c8d5, roughness: 0.18, metalness: 0.12, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    frame: new THREE.MeshStandardMaterial({ color: 0x536b75, roughness: 0.42, metalness: 0.62 }),
    door: new THREE.MeshStandardMaterial({ color: 0xa96f42, roughness: 0.55 }),
    doorAccent: new THREE.MeshStandardMaterial({ color: 0xe8b76a, roughness: 0.38, metalness: 0.34 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x3eafc4, roughness: 0.14, metalness: 0.22, transparent: true, opacity: 0.82 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x779878, roughness: 0.94 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x795f47, roughness: 0.9 }),
    canopy: new THREE.MeshStandardMaterial({ color: 0x5c9472, roughness: 0.86 }),
    bench: new THREE.MeshStandardMaterial({ color: 0x9b7953, roughness: 0.68 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.65 }),
    roomTints: {
      blue: new THREE.MeshStandardMaterial({ color: 0x9dbbcb, roughness: 0.92, transparent: true, opacity: 0.26, side: THREE.DoubleSide }),
      mint: new THREE.MeshStandardMaterial({ color: 0x9dc5b6, roughness: 0.92, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
      sand: new THREE.MeshStandardMaterial({ color: 0xd4bd91, roughness: 0.92, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
      lavender: new THREE.MeshStandardMaterial({ color: 0xb4accb, roughness: 0.92, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
      slate: new THREE.MeshStandardMaterial({ color: 0x9caab4, roughness: 0.92, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    }
  }
}

function markPreviewMaterial(material, role) {
  material.userData.previewVisibilityRole = role
  material.userData.previewBaseOpacity = material.opacity
  return material
}
function addFloorPlate(group, points, baseY, material) {
  const shape = pointsToShape(points)
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false }), material)
  slab.rotation.x = -Math.PI / 2
  slab.position.y = baseY
  slab.receiveShadow = true
  group.add(slab)
}

function addRoomTint(group, room, baseY, material) {
  const shape = new THREE.Shape()
  shape.moveTo((room.x - centerX) * metersPerPixel, (centerY - room.y) * metersPerPixel)
  shape.lineTo((room.x + room.width - centerX) * metersPerPixel, (centerY - room.y) * metersPerPixel)
  shape.lineTo((room.x + room.width - centerX) * metersPerPixel, (centerY - room.y - room.height) * metersPerPixel)
  shape.lineTo((room.x - centerX) * metersPerPixel, (centerY - room.y - room.height) * metersPerPixel)
  shape.closePath()
  const tint = new THREE.Mesh(new THREE.ShapeGeometry(shape), material)
  tint.rotation.x = -Math.PI / 2
  tint.position.y = baseY + 0.175
  group.add(tint)
}

function addFacadeEdge(group, start, end, doorRanges, baseY, height, materials) {
  const lowerHeight = 1.08
  const glassBottom = 1.17
  const glassTop = Math.max(glassBottom + 0.35, height - 0.12)
  const spans = clearSpans(doorRanges)
  spans.forEach(([from, to]) => {
    const a = interpolate(start, end, from)
    const b = interpolate(start, end, to)
    addWallBand(group, a, b, baseY + 0.16, lowerHeight, 0.18, materials.facade)
    addWindowBand(group, a, b, baseY + glassBottom, glassTop - glassBottom, materials)
    addWallBand(group, a, b, baseY + glassTop, Math.max(0.1, height - glassTop), 0.2, materials.facadeAccent)
  })
  doorRanges.forEach(({ from, to }) => {
    const a = interpolate(start, end, from)
    const b = interpolate(start, end, to)
    addWallBand(group, a, b, baseY + Math.max(2.1, height - 0.25), 0.25, 0.18, materials.facadeAccent)
  })
}

function addWindowBand(group, start, end, bottom, height, materials) {
  const a = toFloorPoint(start)
  const b = toFloorPoint(end)
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = Math.hypot(dx, dz)
  if (length < 0.12 || height <= 0) return
  const yaw = Math.atan2(-dz, dx)
  const count = Math.max(1, Math.ceil(length / 2.8))
  const panelLength = length / count
  for (let index = 0; index < count; index += 1) {
    const mid = (index + 0.5) / count
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(panelLength - 0.035, height, 0.065), materials.facadeGlass)
    mesh.position.set(a.x + dx * mid, bottom + height / 2, a.z + dz * mid)
    mesh.rotation.y = yaw
    group.add(mesh)
  }
  for (let index = 0; index <= count; index += 1) {
    const t = index / count
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.055, height + 0.04, 0.11), materials.frame)
    mullion.position.set(a.x + dx * t, bottom + height / 2, a.z + dz * t)
    mullion.rotation.y = yaw
    group.add(mullion)
  }
}

function isBuildingBoundaryWall(wall, buildings) {
  return buildings.some((building) => {
    if (!building.closed || !Array.isArray(building.outer) || building.outer.length < 3) return false
    return building.outer.some((edgeStart, index) => {
      const edgeEnd = building.outer[(index + 1) % building.outer.length]
      return wallMatchesBoundaryEdge(wall, edgeStart, edgeEnd)
    })
  })
}

function wallMatchesBoundaryEdge(wall, edgeStart, edgeEnd) {
  const start = { x: Number(wall.x1), y: Number(wall.y1) }
  const end = { x: Number(wall.x2), y: Number(wall.y2) }
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return false
  return pointOnSegment(start, edgeStart, edgeEnd) && pointOnSegment(end, edgeStart, edgeEnd)
}

function pointOnSegment(point, start, end, tolerance = 2.5) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length < 0.001) return false
  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length)
  if (projection < -tolerance / length || projection > 1 + tolerance / length) return false
  const projectedX = start.x + dx * projection
  const projectedY = start.y + dy * projection
  return Math.hypot(point.x - projectedX, point.y - projectedY) <= tolerance
}

function addInteriorWall(group, start, end, doorRanges, baseY, height, materials) {
  clearSpans(doorRanges).forEach(([from, to]) => {
    addWallBand(group, interpolate(start, end, from), interpolate(start, end, to), baseY, height, 0.13, materials.wall)
  })
  doorRanges.forEach(({ from, to }) => {
    addWallBand(group, interpolate(start, end, from), interpolate(start, end, to), baseY + 2.08, 0.27, 0.13, materials.wallAccent)
  })
}

function addExteriorWall(group, start, end, doorRanges, baseY, height, materials) {
  clearSpans(doorRanges).forEach(([from, to]) => {
    addWallBand(group, interpolate(start, end, from), interpolate(start, end, to), baseY, height, 0.18, materials.facade)
  })
  doorRanges.forEach(({ from, to }) => {
    addWallBand(group, interpolate(start, end, from), interpolate(start, end, to), baseY + Math.max(2.1, height - 0.25), 0.25, 0.18, materials.facadeAccent)
  })
}

function addWallBand(group, start, end, bottom, height, thickness, material) {
  if (height <= 0.02) return
  const a = toFloorPoint(start)
  const b = toFloorPoint(end)
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = Math.hypot(dx, dz)
  if (length < 0.025) return
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), material)
  mesh.position.set((a.x + b.x) / 2, bottom + height / 2, (a.z + b.z) / 2)
  mesh.rotation.y = Math.atan2(-dz, dx)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function doorIntervals(plan, identity, start, end) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return []
  const intervals = []
  ;(plan.doors || []).forEach((door) => {
    const segment = resolveDoorSegment(door, plan)
    if (!segment || segment.type !== identity.type || segment.id !== identity.id) return
    if (identity.edgeIndex !== undefined && segment.edgeIndex !== identity.edgeIndex) return
    const t = Math.max(0, Math.min(1, ((door.x - start.x) * dx + (door.y - start.y) * dy) / lengthSquared))
    const point = { x: start.x + dx * t, y: start.y + dy * t }
    if (Math.hypot(door.x - point.x, door.y - point.y) > 20) return
    const openingPixels = (Number(door.width) || 0.9) / metersPerPixel
    const half = openingPixels / (2 * Math.sqrt(lengthSquared))
    const from = Math.max(0, t - half)
    const to = Math.min(1, t + half)
    if (to - from > 0.001) intervals.push({ from, to })
  })
  return intervals.sort((a, b) => a.from - b.from)
}

function clearSpans(intervals) {
  const merged = []
  intervals.forEach((item) => {
    const last = merged[merged.length - 1]
    if (last && item.from <= last.to + 0.002) last.to = Math.max(last.to, item.to)
    else merged.push({ from: item.from, to: item.to })
  })
  const spans = []
  let cursor = 0
  merged.forEach(({ from, to }) => {
    if (from - cursor > 0.001) spans.push([cursor, from])
    cursor = Math.max(cursor, to)
  })
  if (1 - cursor > 0.001) spans.push([cursor, 1])
  return spans
}

function resolveDoorSegment(door, plan) {
  const segments = []
  ;(plan.walls || []).forEach((wall) => segments.push({
    type: 'wall', id: wall.id,
    a: { x: wall.x1, y: wall.y1 }, b: { x: wall.x2, y: wall.y2 }
  }))
  ;(plan.buildings || []).forEach((building) => {
    if (!building.closed) return
    building.outer.forEach((a, edgeIndex) => segments.push({
      type: 'building', id: building.id, edgeIndex, a,
      b: building.outer[(edgeIndex + 1) % building.outer.length]
    }))
  })

  if (door.hostType && door.hostId) {
    const hosted = segments.find((segment) => segment.type === door.hostType && segment.id === door.hostId &&
      (door.hostType !== 'building' || door.edgeIndex === undefined || segment.edgeIndex === door.edgeIndex))
    if (hosted) return hosted
  }
  const snapped = snapPointToPlan(door, plan, Infinity)
  return snapped.segment || null
}

function segmentRotation(segment) {
  const dx = (segment.b.x - segment.a.x) * metersPerPixel
  const dz = (segment.b.y - segment.a.y) * metersPerPixel
  return Math.atan2(-dz, dx)
}

function interpolate(start, end, t) {
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
}

function pointsToShape(points) {
  const shape = new THREE.Shape()
  points.forEach((point, index) => {
    const world = toWorldPoint(point)
    if (index === 0) shape.moveTo(world.x, world.y)
    else shape.lineTo(world.x, world.y)
  })
  shape.closePath()
  return shape
}

function doorMarker(widthMeters, materials) {
  const group = new THREE.Group()
  const width = Math.max(0.7, widthMeters)
  const jambWidth = 0.07
  addBox(group, [-width / 2, 1.08, 0], [jambWidth, 2.16, 0.1], materials.frame)
  addBox(group, [width / 2, 1.08, 0], [jambWidth, 2.16, 0.1], materials.frame)
  addBox(group, [0, 2.12, 0], [width + jambWidth, 0.08, 0.1], materials.frame)
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 2.02, 0.045), materials.door)
  leaf.position.set(-width / 2 + 0.05, 1.03, 0.17)
  leaf.rotation.y = Math.PI / 2
  group.add(leaf)
  const swing = new THREE.Mesh(new THREE.TorusGeometry(width - 0.08, 0.012, 6, 28, Math.PI / 2), materials.doorAccent)
  swing.rotation.x = Math.PI / 2
  swing.position.set(-width / 2 + 0.05, 0.035, 0)
  group.add(swing)
  return group
}

function assetModel(asset, materials) {
  const group = new THREE.Group()
  const color = new THREE.MeshStandardMaterial({ color: asset.color || '#dfaa55', roughness: 0.62 })
  if (asset.type === 'chair') {
    addBox(group, [0, 0.25, 0], [0.43, 0.08, 0.43], color)
    addBox(group, [0, 0.52, 0.18], [0.43, 0.48, 0.08], color)
    for (const x of [-0.16, 0.16]) for (const z of [-0.15, 0.15]) addBox(group, [x, 0.12, z], [0.045, 0.25, 0.045], materials.frame)
  } else if (asset.type === 'desk') {
    const top = new THREE.MeshStandardMaterial({ color: 0xd5c7ad, roughness: 0.62 })
    addBox(group, [0, 0.72, 0], [1.25, 0.08, 0.74], top)
    for (const x of [-0.53, 0.53]) for (const z of [-0.29, 0.29]) addBox(group, [x, 0.36, z], [0.055, 0.68, 0.055], materials.frame)
    addBox(group, [0.18, 0.8, -0.08], [0.38, 0.04, 0.23], color)
    const chair = assetModel({ type: 'chair', color: '#7d97a2' }, materials)
    chair.position.set(0, 0, 0.68)
    group.add(chair)
  } else {
    addCylinder(group, [0, 0.28, 0], 0.16, 0.52, color, 20)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), materials.glass)
    beacon.position.set(0, 0.58, 0)
    group.add(beacon)
  }
  return group
}

function addSiteFeature(group, feature, baseY, materials) {
  const point = toFloorPoint(feature)
  if (feature.type === 'garden') {
    const shape = new THREE.Shape()
    const left = (feature.x - centerX) * metersPerPixel
    const right = (feature.x + feature.width - centerX) * metersPerPixel
    const top = (centerY - feature.y) * metersPerPixel
    const bottom = (centerY - feature.y - feature.height) * metersPerPixel
    shape.moveTo(left, top); shape.lineTo(right, top); shape.lineTo(right, bottom); shape.lineTo(left, bottom); shape.closePath()
    const lawn = new THREE.Mesh(new THREE.ShapeGeometry(shape), materials.grass)
    lawn.rotation.x = -Math.PI / 2
    lawn.position.y = baseY + 0.025
    group.add(lawn)
    return
  }
  if (feature.type === 'canopy') {
    const center = toFloorPoint({ x: feature.x + feature.width / 2, y: feature.y + feature.height / 2 })
    const width = feature.width * metersPerPixel
    const depth = feature.height * metersPerPixel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, depth), materials.glass)
    roof.position.set(center.x, baseY + 3.25, center.z)
    group.add(roof)
    addBox(group, [center.x, baseY + 3.18, center.z - depth / 2], [width, 0.12, 0.1], materials.frame)
    addBox(group, [center.x, baseY + 3.18, center.z + depth / 2], [width, 0.12, 0.1], materials.frame)
    for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) for (const z of [-depth / 2 + 0.12, depth / 2 - 0.12]) {
      addBox(group, [center.x + x, baseY + 1.6, center.z + z], [0.08, 3.2, 0.08], materials.frame)
    }
    return
  }
  if (feature.type === 'water') {
    const center = toFloorPoint({ x: feature.x + feature.width / 2, y: feature.y + feature.height / 2 })
    const shape = new THREE.Shape()
    const left = (feature.x - centerX) * metersPerPixel
    const right = (feature.x + feature.width - centerX) * metersPerPixel
    const top = (centerY - feature.y) * metersPerPixel
    const bottom = (centerY - feature.y - feature.height) * metersPerPixel
    shape.moveTo(left, top); shape.lineTo(right, top); shape.lineTo(right, bottom); shape.lineTo(left, bottom); shape.closePath()
    const pool = new THREE.Mesh(new THREE.ShapeGeometry(shape), materials.water)
    pool.rotation.x = -Math.PI / 2
    pool.position.y = baseY + 0.03
    group.add(pool)
    const poolWidth = feature.width * metersPerPixel
    const poolDepth = feature.height * metersPerPixel
    const railY = baseY + 0.03
    addBox(group, [center.x, railY, center.z - poolDepth / 2 - 0.08], [poolWidth + 0.28, 0.14, 0.16], materials.white)
    addBox(group, [center.x, railY, center.z + poolDepth / 2 + 0.08], [poolWidth + 0.28, 0.14, 0.16], materials.white)
    addBox(group, [center.x - poolWidth / 2 - 0.08, railY, center.z], [0.16, 0.14, poolDepth], materials.white)
    addBox(group, [center.x + poolWidth / 2 + 0.08, railY, center.z], [0.16, 0.14, poolDepth], materials.white)
    return
  }
  if (feature.type === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 1.5, 10), materials.trunk)
    trunk.position.set(point.x, baseY + 0.78, point.z)
    group.add(trunk)
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 1), materials.canopy)
    canopy.position.set(point.x, baseY + 2.05, point.z)
    canopy.castShadow = true
    group.add(canopy)
    return
  }
  if (feature.type === 'bench') {
    const bench = new THREE.Group()
    addBox(bench, [0, 0.46, 0], [1.35, 0.1, 0.42], materials.bench)
    addBox(bench, [0, 0.72, -0.17], [1.35, 0.42, 0.08], materials.bench)
    addBox(bench, [-0.5, 0.2, 0], [0.08, 0.48, 0.08], materials.frame)
    addBox(bench, [0.5, 0.2, 0], [0.08, 0.48, 0.08], materials.frame)
    bench.position.set(point.x, baseY, point.z)
    bench.rotation.y = Number(feature.rotation) || 0
    group.add(bench)
  }
}

function addBox(group, position, size, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function addCylinder(group, position, radius, height, material, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material)
  mesh.position.set(...position)
  mesh.castShadow = true
  group.add(mesh)
}

function disposeTree(root) {
  const geometries = new Set()
  const materials = new Set()
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry)
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    objectMaterials.filter(Boolean).forEach((material) => materials.add(material))
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}
