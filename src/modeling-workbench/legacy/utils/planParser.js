const footprint = [
  { x: 120, y: 90 }, { x: 1080, y: 90 }, { x: 1080, y: 600 },
  { x: 820, y: 600 }, { x: 820, y: 300 }, { x: 380, y: 300 },
  { x: 380, y: 600 }, { x: 120, y: 600 }
]

const wall = (id, x1, y1, x2, y2) => ({ id, x1, y1, x2, y2 })

function room(id, name, code, x, y, width, height, tone = 'blue') {
  return { id, name, code, x, y, width, height, tone }
}

function floorRooms(floor) {
  if (floor === 1) return [
    room('r101', '客户接待', '01', 130, 105, 112, 106, 'sand'),
    room('r102', '董事会议', '02', 258, 105, 112, 106, 'lavender'),
    room('r103', '开放办公 A', '03', 130, 236, 112, 126),
    room('r104', '研发实验室', '04', 258, 236, 112, 126, 'mint'),
    room('r105', '专注工作间', '05', 130, 376, 112, 96, 'lavender'),
    room('r106', '弱电机房', '06', 258, 376, 112, 96, 'slate'),
    room('r107', '员工餐吧', '07', 130, 486, 112, 98, 'sand'),
    room('r108', '茶歇休闲', '08', 258, 486, 112, 98, 'mint'),
    room('r109', '创新展廊', '09', 390, 104, 130, 84, 'sand'),
    room('r110', '灵活会议', '10', 530, 104, 130, 84, 'lavender'),
    room('r111', '品牌体验厅', '11', 670, 104, 130, 84, 'mint'),
    room('r112', '中央门厅', '12', 390, 205, 410, 75, 'blue'),
    room('r113', '开放办公 B', '13', 830, 105, 112, 106),
    room('r114', '项目会议室', '14', 958, 105, 112, 106, 'lavender'),
    room('r115', '数字孪生实验室', '15', 830, 236, 112, 126, 'mint'),
    room('r116', '开放办公 C', '16', 958, 236, 112, 126),
    room('r117', '设备控制室', '17', 830, 376, 112, 96, 'slate'),
    room('r118', '静音舱', '18', 958, 376, 112, 96, 'lavender'),
    room('r119', '咖啡休息区', '19', 830, 486, 112, 98, 'sand'),
    room('r120', '产品体验区', '20', 958, 486, 112, 98, 'mint')
  ]

  if (floor === 2) return [
    room('r201', '联合办公 A', '21', 130, 105, 112, 106), room('r202', '专利资料室', '22', 258, 105, 112, 106, 'sand'),
    room('r203', '智能硬件实验室', '23', 130, 236, 112, 126, 'mint'), room('r204', '材料测试室', '24', 258, 236, 112, 126, 'mint'),
    room('r205', '项目讨论间', '25', 130, 376, 112, 96, 'lavender'), room('r206', '样品间', '26', 258, 376, 112, 96, 'slate'),
    room('r207', '员工休息区', '27', 130, 486, 112, 98, 'sand'), room('r208', '安静工作区', '28', 258, 486, 112, 98, 'lavender'),
    room('r209', '沉浸演示厅', '29', 390, 104, 270, 84, 'blue'), room('r210', '方案评审室', '30', 670, 104, 130, 84, 'lavender'),
    room('r211', '共享中庭连廊', '31', 390, 205, 410, 75, 'sand'),
    room('r212', '联合办公 B', '32', 830, 105, 112, 106), room('r213', '客户协作室', '33', 958, 105, 112, 106, 'lavender'),
    room('r214', '机器人实验室', '34', 830, 236, 112, 126, 'mint'), room('r215', '视觉计算实验室', '35', 958, 236, 112, 126, 'mint'),
    room('r216', '数据机房', '36', 830, 376, 112, 96, 'slate'), room('r217', '电话会议间', '37', 958, 376, 112, 96, 'lavender'),
    room('r218', '休闲区', '38', 830, 486, 112, 98, 'sand'), room('r219', '打印文档中心', '39', 958, 486, 112, 98, 'slate')
  ]

  return [
    room('r301', '总经理办公室', '41', 130, 105, 112, 106, 'sand'), room('r302', '战略会议室', '42', 258, 105, 112, 106, 'lavender'),
    room('r303', '培训教室 A', '43', 130, 236, 112, 126, 'blue'), room('r304', '培训教室 B', '44', 258, 236, 112, 126, 'blue'),
    room('r305', '人力资源部', '45', 130, 376, 112, 96), room('r306', '财务室', '46', 258, 376, 112, 96, 'slate'),
    room('r307', '员工成长中心', '47', 130, 486, 112, 98, 'mint'), room('r308', '母婴室', '48', 258, 486, 112, 98, 'sand'),
    room('r309', '多功能发布厅', '49', 390, 104, 270, 84, 'lavender'), room('r310', '录播室', '50', 670, 104, 130, 84, 'slate'),
    room('r311', '空中会客厅', '51', 390, 205, 410, 75, 'sand'),
    room('r312', '培训教室 C', '52', 830, 105, 112, 106, 'blue'), room('r313', '培训教室 D', '53', 958, 105, 112, 106, 'blue'),
    room('r314', '法务办公室', '54', 830, 236, 112, 126), room('r315', '行政支持部', '55', 958, 236, 112, 126),
    room('r316', '档案室', '56', 830, 376, 112, 96, 'slate'), room('r317', '专注工作间', '57', 958, 376, 112, 96, 'lavender'),
    room('r318', '阅览区', '58', 830, 486, 112, 98, 'sand'), room('r319', '露台休息区', '59', 958, 486, 112, 98, 'mint')
  ]
}

function floorWalls(floor) {
  const walls = [
    wall('west-spine', 250, 90, 250, 600),
    wall('east-spine', 950, 90, 950, 600),
    ...[220, 370, 480].flatMap((y, i) => [
      wall(`west-cross-${i}-a`, 120, y, 250, y), wall(`west-cross-${i}-b`, 250, y, 380, y),
      wall(`east-cross-${i}-a`, 820, y, 950, y), wall(`east-cross-${i}-b`, 950, y, 1080, y)
    ]),
    wall('gallery-a', 525, 90, 525, 195), wall('gallery-b', 665, 90, 665, 195),
    wall('gallery-cross', 380, 198, 820, 198),
    wall('core-west', 530, 210, 530, 278), wall('core-north', 530, 210, 650, 210),
    wall('core-east', 650, 210, 650, 278), wall('core-south', 530, 278, 650, 278)
  ]
  if (floor === 2) walls.push(wall('lab-divider', 250, 300, 380, 300), wall('east-lab-divider', 820, 300, 950, 300))
  if (floor === 3) walls.push(wall('training-divider-west', 250, 300, 380, 300), wall('training-divider-east', 820, 300, 950, 300))
  return walls
}

function floorAssets(floor) {
  const desks = floor === 1
    ? [[278, 260], [330, 260], [278, 310], [330, 310], [278, 410], [330, 410], [840, 260], [895, 260], [840, 315], [895, 315], [840, 410], [895, 410], [575, 235], [730, 235]]
    : floor === 2
      ? [[278, 260], [330, 260], [278, 315], [330, 315], [840, 260], [895, 260], [840, 315], [895, 315], [575, 235], [730, 235]]
      : [[278, 260], [330, 260], [840, 260], [895, 260], [440, 235], [735, 235]]
  const assets = desks.map(([x, y], index) => ({
    id: 'desk-basic', instanceId: `demo-desk-${floor}-${index + 1}`,
    name: floor === 2 ? '研发工位' : floor === 3 ? '办公工位' : '协作工位',
    type: 'desk', color: floor === 2 ? '#57b8a4' : '#dfaa55', x, y
  }))
  assets.push(
    { id: 'sensor-basic', instanceId: `demo-sensor-${floor}-1`, name: '室内定位基站', type: 'sensor', color: '#42b7d5', x: 500, y: 160 },
    { id: 'sensor-basic', instanceId: `demo-sensor-${floor}-2`, name: '室内定位基站', type: 'sensor', color: '#42b7d5', x: 700, y: 160 },
    { id: 'chair-basic', instanceId: `demo-chair-${floor}-1`, name: '休闲座椅', type: 'chair', color: '#879fcd', x: 185, y: 530 },
    { id: 'chair-basic', instanceId: `demo-chair-${floor}-2`, name: '休闲座椅', type: 'chair', color: '#879fcd', x: 1015, y: 530 }
  )
  return assets
}

function floorDoors(floor) {
  const doors = [
    [250, 165, 0.9], [250, 300, 0.9], [250, 430, 0.9],
    [950, 165, 0.9], [950, 300, 0.9], [950, 430, 0.9],
    [525, 145, 0.9], [665, 145, 0.9], [590, 198, 1.0], [560, 278, 0.9], [620, 278, 0.9],
    [380, 430, 0.9], [820, 430, 0.9], [600, 300, 1.8], [180, 90, 0.9], [1020, 90, 0.9]
  ]
  return doors.map(([x, y, width], index) => ({ id: `door-${floor}-${index + 1}`, x, y, width }))
}

function siteFeatures() {
  return [
    { id: 'courtyard-garden', type: 'garden', x: 390, y: 310, width: 420, height: 280 },
    { id: 'main-canopy', type: 'canopy', x: 520, y: 282, width: 160, height: 20 },
    { id: 'pond', type: 'water', x: 470, y: 395, width: 260, height: 70 },
    ...[[430, 350], [770, 350], [430, 545], [770, 545]].map(([x, y], index) => ({ id: `tree-${index + 1}`, type: 'tree', x, y })),
    { id: 'bench-left', type: 'bench', x: 510, y: 510, rotation: 0 },
    { id: 'bench-right', type: 'bench', x: 690, y: 510, rotation: 0 }
  ]
}

export function demoPlan(floor = 1) {
  return {
    buildings: [{ id: `innovation-center-${floor}`, name: '云栖创新中心', closed: true, outer: footprint.map((point) => ({ ...point })) }],
    rooms: floorRooms(floor),
    walls: floorWalls(floor),
    doors: floorDoors(floor),
    assets: floorAssets(floor),
    siteFeatures: floor === 1 ? siteFeatures() : []
  }
}

export async function parsePlanFile(file) {
  const text = await file.text()
  if (file.name.toLowerCase().endsWith('.svg')) return parseSvg(text)
  const data = JSON.parse(text)
  if (data.plan) return data.plan
  if (Array.isArray(data.buildings)) return {
    ...data,
    buildings: data.buildings,
    walls: data.walls || [], doors: data.doors || [], assets: data.assets || [], rooms: data.rooms || []
  }
  if (Array.isArray(data.outerPolygon)) {
    return {
      buildings: [{ id: `building-${Date.now()}`, name: data.name || '导入建筑', closed: true,
        outer: data.outerPolygon.map(([x, y]) => ({ x: 80 + x * 18, y: 560 - y * 12 })) }],
      walls: (data.innerWalls || []).map((item, index) => ({
        id: `wall-${index + 1}`, x1: 80 + item[0][0] * 18, y1: 560 - item[0][1] * 12,
        x2: 80 + item[1][0] * 18, y2: 560 - item[1][1] * 12
      })),
      doors: data.doors || [], assets: data.assets || [], rooms: data.rooms || []
    }
  }
  throw new Error('文件中没有可识别的建筑轮廓。')
}

function parseSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('SVG 文件格式无效。')
  const polygon = doc.querySelector('polygon')
  if (!polygon) throw new Error('SVG 中没有 polygon 建筑轮廓。')
  const outer = polygon.getAttribute('points').trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('SVG 轮廓点格式无效。')
    return { x, y }
  })
  if (outer.length < 3) throw new Error('建筑轮廓至少需要三个有效点。')
  return { buildings: [{ id: `building-${Date.now()}`, name: 'SVG 建筑', closed: true, outer }], walls: [], doors: [], assets: [], rooms: [] }
}
