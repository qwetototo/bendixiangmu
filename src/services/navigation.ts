import {
  ApiOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  HistoryOutlined,
  HomeOutlined,
  SettingOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue';
import { computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

export type SectionKey = 'home' | 'live' | 'events' | 'identity' | 'config';

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

export function useNavigation() {
  const { t } = useI18n();
  const authStore = useAuthStore();

  const navSections = computed<NavSection[]>(() => {
    const sections: NavSection[] = [
    {
      key: 'home',
      label: t('nav.home'),
      icon: HomeOutlined,
      items: [
        { key: 'overview', label: t('nav.overview'), description: t('nav.overviewDesc') },
      ],
    },
    {
      key: 'live',
      label: t('nav.liveTrack'),
      icon: DeploymentUnitOutlined,
      items: [
        { key: 'live', label: t('nav.liveTrack'), description: t('nav.liveTrackDesc') },
      ],
    },
    {
      key: 'events',
      label: t('nav.eventCenter'),
      icon: WarningOutlined,
      items: [
        { key: 'events', label: t('nav.eventCenter'), description: t('nav.eventCenterDesc') },
      ],
    },
    {
      key: 'identity',
      label: t('nav.personDevice'),
      icon: TeamOutlined,
      items: [
        { key: 'devices', label: t('nav.deviceMgmt'), description: t('nav.deviceMgmtDesc') },
        { key: 'personnel', label: t('nav.personnelMgmt'), description: t('nav.personnelMgmtDesc') },
        { key: 'beacons', label: t('nav.beaconMgmt'), description: t('nav.beaconMgmtDesc') },
      ],
    },
    {
      key: 'config',
      label: t('nav.configCenter'),
      icon: SettingOutlined,
      items: [
        { key: 'map-editor', label: t('nav.mapEditor'), description: t('nav.mapEditorDesc') },
        { key: 'users', label: t('nav.userManagement'), description: t('nav.userManagementDesc') },
      ],
    },
    ];
    return sections.filter((section) => authStore.isAdmin || (section.key !== 'identity' && section.key !== 'config'));
  });

  const guideItems = computed(() => [
    { title: t('nav.onboarding1Title'), text: t('nav.onboarding1Text'), icon: DashboardOutlined },
    { title: t('nav.onboarding2Title'), text: t('nav.onboarding2Text'), icon: HistoryOutlined },
    { title: t('nav.onboarding3Title'), text: t('nav.onboarding3Text'), icon: ApiOutlined },
  ]);

  function findNavSection(sectionKey: SectionKey): NavSection | undefined {
    return navSections.value.find((section) => section.key === sectionKey);
  }

  function getDefaultSubmenu(sectionKey: SectionKey): string {
    return findNavSection(sectionKey)?.items[0]?.key ?? '';
  }

  return { navSections, guideItems, findNavSection, getDefaultSubmenu };
}
