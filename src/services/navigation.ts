import {
  ApiOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  HistoryOutlined,
  HomeOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue';
import type { Component } from 'vue';

export type SectionKey = 'home' | 'track' | 'identity' | 'config';

export interface NavItem {
  key: string;
  label: string;
  description: string;
}

export interface NavSection {
  key: SectionKey;
  label: string;
  icon: Component;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    key: 'home',
    label: '首页',
    icon: HomeOutlined,
    items: [
      { key: 'overview', label: '项目概览', description: '基础信息、数据摘要与教学入口' },
    ],
  },
  {
    key: 'track',
    label: '轨迹中心',
    icon: DeploymentUnitOutlined,
    items: [
      { key: 'live', label: '实时轨迹', description: '接入当前 3D 场景与实时轨迹能力' },
      { key: 'events', label: '事件中心', description: '集中处理告警事件、筛选与操作记录' },
    ],
  },
  {
    key: 'identity',
    label: '人员设备中心',
    icon: TeamOutlined,
    items: [
      { key: 'people-devices', label: '人员设备管理', description: '一人一设备绑定关系与在线状态' },
      { key: 'beacons', label: '信标设备管理', description: '信标设备库存、区域与运行状态' },
    ],
  },
  {
    key: 'config',
    label: '配置中心',
    icon: SettingOutlined,
    items: [
      { key: 'scene', label: '场景配置', description: '区域、围栏、楼层与模型配置' },
      { key: 'map-editor', label: '地图编辑', description: '导入地图、编辑模型并切换轨迹中心地图' },
    ],
  },
];

export const guideItems = [
  { title: '实时展示', text: '进入轨迹中心后可查看在线人员、设备状态与 3D 空间位置。', icon: DashboardOutlined },
  { title: '事件处理', text: '在事件中心筛选告警列表，并对单条事件进行备注、详情查看和处置。', icon: HistoryOutlined },
  { title: '企业集成', text: '配置中心预留场景、规则与数据接入能力，便于后续扩展。', icon: ApiOutlined },
];

export function findNavSection(sectionKey: SectionKey): NavSection | undefined {
  return navSections.find((section) => section.key === sectionKey);
}

export function getDefaultSubmenu(sectionKey: SectionKey): string {
  return findNavSection(sectionKey)?.items[0]?.key ?? '';
}
