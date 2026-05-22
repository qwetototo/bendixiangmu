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
      { key: 'tutorial', label: '使用教学', description: '轨迹展示、保存、回放操作说明' },
    ],
  },
  {
    key: 'track',
    label: '轨迹中心',
    icon: DeploymentUnitOutlined,
    items: [
      { key: 'live', label: '实时展示', description: '接入当前 3D 场景与实时轨迹能力' },
      { key: 'replay', label: '轨迹回放', description: '复用已有回放面板与轨迹控制' },
      { key: 'archive', label: '轨迹保存', description: '为历史轨迹归档与检索预留入口' },
    ],
  },
  {
    key: 'identity',
    label: '人员设备中心',
    icon: TeamOutlined,
    items: [
      { key: 'bindings', label: '绑定管理', description: '一人一设备绑定关系与在线状态' },
      { key: 'people', label: '人员字段', description: '数据库人员表字段与授权信息' },
      { key: 'devices', label: '设备字段', description: '数据库设备表字段与运行参数' },
    ],
  },
  {
    key: 'config',
    label: '配置中心',
    icon: SettingOutlined,
    items: [
      { key: 'scene', label: '场景配置', description: '区域、围栏、楼层与模型配置' },
      { key: 'rules', label: '告警规则', description: '越界、滞留、低电量等规则策略' },
      { key: 'integration', label: '数据接入', description: 'MQTT、接口密钥与外部系统集成' },
    ],
  },
];

export const guideItems = [
  { title: '实时展示', text: '进入轨迹中心后可查看在线人员、设备状态与 3D 空间位置。', icon: DashboardOutlined },
  { title: '历史回放', text: '按人员、设备和时间范围筛选轨迹，使用播放控件复盘移动过程。', icon: HistoryOutlined },
  { title: '企业集成', text: '配置中心预留场景、规则与数据接入能力，便于后续扩展。', icon: ApiOutlined },
];

export function findNavSection(sectionKey: SectionKey): NavSection | undefined {
  return navSections.find((section) => section.key === sectionKey);
}

export function getDefaultSubmenu(sectionKey: SectionKey): string {
  return findNavSection(sectionKey)?.items[0]?.key ?? '';
}
