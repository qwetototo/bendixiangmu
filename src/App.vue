<template>
  <main v-if="!authStore.initialized" class="auth-loading">{{ t('login.verifying') }}</main>
  <LoginView
    v-else-if="!isAuthed"
    :error-message="loginError"
    :loading="loginLoading"
    @login="handleLogin"
  />

  <main v-else :class="['admin-shell', `admin-shell--${themeMode}`]">
    <header class="admin-topbar" @mouseleave="closeMenu">
      <button class="brand-button" type="button" @click="selectNav('home', 'overview')">
        <img src="@/assets/image/favicon2.0.svg" alt="DeepFusion" />
      </button>
      <nav class="primary-nav">
        <button
          v-for="section in navSections"
          :key="section.key"
          :ref="(element) => setNavButtonRef(section.key, element)"
          :class="{ active: activeSection === section.key }"
          type="button"
          @click="selectNav(section.key, getDefaultSubmenu(section.key))"
          @mouseenter="openMenu(section.key)"
        >
          <component :is="section.icon" />
          <span>{{ section.label }}</span>
        </button>
      </nav>
      <div class="topbar-actions">
        <button type="button" class="theme-toggle" :title="t('theme.switchTheme')" @click="toggleLanguage">
          <span>{{ languageStore.locale === 'zh-CN' ? 'EN' : '中' }}</span>
        </button>
        <button type="button" class="theme-toggle" :title="t('theme.switchTheme')" @click="toggleTheme">
          <BgColorsOutlined />
          <span>{{ themeMode === 'dark' ? t('theme.light') : t('theme.dark') }}</span>
        </button>
        <button type="button" :title="t('common.notifications')">
          <BellOutlined />
        </button>
        <button type="button" :title="t('common.logout')" @click="handleLogout">
          <LogoutOutlined />
        </button>
      </div>
      <section v-if="openedSection && activeSubmenus.length > 1" class="submenu-panel" :style="submenuStyle">
        <button
          v-for="item in activeSubmenus"
          :key="item.key"
          :class="{ active: activeSection === openedSection && activeSubmenu === item.key }"
          type="button"
          @click="selectNav(openedSection, item.key)"
        >
          <span>{{ item.label }}</span>
        </button>
      </section>
    </header>

    <section class="admin-body">
      <section v-if="activePageKey === 'track.live'" class="track-page">
        <TwinScreen embedded :theme-mode="themeMode" @show-events="selectNav('track', 'events')" />
      </section>

      <section v-else class="content-page">
        <div class="page-heading">
          <div>
            <span>{{ currentSectionLabel }}</span>
            <h1>{{ currentPageTitle }}</h1>
          </div>
          <button class="outline-action" type="button" @click="pageRefreshKey += 1">
            <ReloadOutlined />
            <span>{{ t('common.refresh') }}</span>
          </button>
        </div>

        <HomeView v-if="activePageKey === 'home.overview'" :key="`home-${pageRefreshKey}`" @navigate="selectNav" />
        <EventCenterView v-else-if="activePageKey === 'track.events'" :key="`events-${pageRefreshKey}`" :can-manage="isAdmin" :theme-mode="themeMode" />
        <DeviceManagementView v-else-if="activePageKey === 'identity.devices'" :key="`devices-${pageRefreshKey}`" :theme-mode="themeMode" />
        <IdentityView v-else-if="activePageKey === 'identity.personnel'" :key="`personnel-${pageRefreshKey}`" :theme-mode="themeMode" />
        <BeaconDeviceView v-else-if="activePageKey === 'identity.beacons'" :key="`beacons-${pageRefreshKey}`" :theme-mode="themeMode" />
        <UserManagementView v-else-if="activePageKey === 'config.users'" :key="`users-${pageRefreshKey}`" :theme-mode="themeMode" />
        <ConfigView v-else :key="`config-${activeSubmenu}-${editingMapId}-${pageRefreshKey}`" :page-key="activeSubmenu" :edit-map-id="editingMapId" />
      </section>
    </section>

    <TransitionGroup name="sos-notice" tag="section" class="sos-notice-stack" aria-live="assertive">
      <article v-for="notice in sosNotices" :key="notice.id" class="sos-notice">
        <span class="sos-notice-icon">SOS</span>
        <div>
          <strong>设备紧急告警</strong>
          <p>{{ notice.deviceId }} 已进入 SOS 状态<span v-if="notice.personId"> · 人员 {{ notice.personId }}</span></p>
        </div>
        <button type="button" aria-label="关闭通知" @click="removeSosNotice(notice.id)">×</button>
      </article>
    </TransitionGroup>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { BellOutlined, BgColorsOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import BeaconDeviceView from '@/views/admin/BeaconDeviceView.vue';
import ConfigView from '@/views/admin/ConfigView.vue';
import DeviceManagementView from '@/views/admin/DeviceManagementView.vue';
import EventCenterView from '@/views/admin/EventCenterView.vue';
import HomeView from '@/views/admin/HomeView.vue';
import IdentityView from '@/views/admin/IdentityView.vue';
import UserManagementView from '@/views/admin/UserManagementView.vue';
import LoginView from '@/views/LoginView.vue';
import TwinScreen from '@/views/TwinScreen.vue';
import { useNavigation, type SectionKey } from '@/services/navigation';
import { useLanguageStore } from '@/stores/language';
import { useAuthStore } from '@/stores/auth';
import type { LoginPayload } from '@/services/authApi';
import { fetchAlertEvents, type DeviceStatus, type DeviceVO } from '@/services/adminApi';

const { t, locale } = useI18n();
const languageStore = useLanguageStore();
const authStore = useAuthStore();
const { navSections, findNavSection, getDefaultSubmenu } = useNavigation();

function toggleLanguage() {
  languageStore.toggle();
}

// Sync Pinia locale → vue-i18n locale
watch(
  () => languageStore.locale,
  (next) => {
    locale.value = next;
  },
  { immediate: true },
);

const NAV_STORAGE_KEY = 'twintrack.activeNav';

interface StoredNavState {
  section?: SectionKey;
  submenu?: string;
}

const routeAliases = new Map<string, StoredNavState>([
  ['/', { section: 'home', submenu: 'overview' }],
  ['/home', { section: 'home', submenu: 'overview' }],
  ['/home/overview', { section: 'home', submenu: 'overview' }],
  ['/track', { section: 'track', submenu: 'live' }],
  ['/track/live', { section: 'track', submenu: 'live' }],
  ['/track/events', { section: 'track', submenu: 'events' }],
  ['/identity', { section: 'identity', submenu: 'devices' }],
  ['/identity/devices', { section: 'identity', submenu: 'devices' }],
  ['/identity/personnel', { section: 'identity', submenu: 'personnel' }],
  ['/identity/people-devices', { section: 'identity', submenu: 'personnel' }],
  ['/identity/beacons', { section: 'identity', submenu: 'beacons' }],
  ['/config', { section: 'config', submenu: 'map-editor' }],
  ['/config/scene', { section: 'config', submenu: 'map-editor' }],
  ['/config/users', { section: 'config', submenu: 'users' }],
  ['/config/map-editor', { section: 'config', submenu: 'map-editor' }],
]);

function isValidNavState(state: StoredNavState): state is Required<StoredNavState> {
  const section = state.section ? findNavSection(state.section) : undefined;
  return Boolean(section?.items.some((item) => item.key === state.submenu));
}

function getRouteNavState(): StoredNavState {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const routeState = routeAliases.get(normalizedPath);
  if (routeState) {
    return routeState;
  }
  // Parameterized route: /config/map-editor/:mapId
  const mapEditorMatch = normalizedPath.match(/^\/config\/map-editor\/(.+)$/);
  if (mapEditorMatch) {
    const state: StoredNavState = { section: 'config', submenu: 'map-editor' };
    return state;
  }
  return {};
}

function getStoredNavState(): StoredNavState {
  try {
    const rawValue = localStorage.getItem(NAV_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as StoredNavState;
    return isValidNavState(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const isAuthed = computed(() => authStore.isAuthenticated);
const isAdmin = computed(() => authStore.isAdmin);
const storedNavState = getStoredNavState();
const activeSection = ref<SectionKey>(storedNavState.section && findNavSection(storedNavState.section) ? storedNavState.section : 'home');
const openedSection = ref<SectionKey | null>(null);
const activeSubmenu = ref(storedNavState.submenu || getDefaultSubmenu(activeSection.value));
const themeMode = ref<'dark' | 'light'>('light');
const pageRefreshKey = ref(0);
const loginLoading = ref(false);
const loginError = ref('');
const navButtonRefs = new Map<SectionKey, HTMLElement>();
const submenuLeft = ref(0);
const submenuWidth = ref(0);
const seenSosEventIds = new Set<string>();
const lastSosNoticeAt = new Map<string, number>();
const sosNotices = ref<Array<{ id: string; deviceId: string; personId?: string | null }>>([]);
let sosPollingInitialized = false;
let sosPollingTimer: number | undefined;

const activeSubmenus = computed(() => {
  return openedSection.value ? findNavSection(openedSection.value)?.items ?? [] : [];
});

const currentSectionLabel = computed(() => {
  return findNavSection(activeSection.value)?.label ?? '';
});

const currentPageTitle = computed(() => {
  const section = findNavSection(activeSection.value);
  return section?.items.find((item) => item.key === activeSubmenu.value)?.label ?? section?.label ?? '';
});

const editingMapId = computed(() => {
  if (activeSubmenu.value !== 'map-editor') return '';
  const match = window.location.pathname.match(/^\/config\/map-editor\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : '';
});

const activePageKey = computed(() => `${activeSection.value}.${activeSubmenu.value}`);

const submenuStyle = computed(() => ({
  left: `${submenuLeft.value}px`,
  width: `${submenuWidth.value}px`,
}));

function setNavButtonRef(sectionKey: SectionKey, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    navButtonRefs.set(sectionKey, element);
  } else {
    navButtonRefs.delete(sectionKey);
  }
}

function openMenu(sectionKey: SectionKey) {
  const section = findNavSection(sectionKey);
  if (!section || section.items.length < 2) {
    openedSection.value = null;
    return;
  }

  openedSection.value = sectionKey;
  nextTick(() => updateSubmenuPosition(sectionKey));
}

function updateSubmenuPosition(sectionKey: SectionKey) {
  const button = navButtonRefs.get(sectionKey);
  if (!button) {
    return;
  }

  const rect = button.getBoundingClientRect();
  submenuLeft.value = rect.left;
  submenuWidth.value = rect.width;
}

function closeMenu() {
  openedSection.value = null;
}

function toggleTheme() {
  themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark';
}

async function handleLogin(payload: LoginPayload) {
  loginLoading.value = true;
  loginError.value = '';
  try {
    await authStore.login(payload);
    syncNavFromRoute();
    void pollSosEvents();
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : t('login.failed');
  } finally {
    loginLoading.value = false;
  }
}

function handleLogout() {
  authStore.logout();
  localStorage.removeItem(NAV_STORAGE_KEY);
  activeSection.value = 'home';
  activeSubmenu.value = 'overview';
  window.history.replaceState({}, '', '/home/overview');
}

function handleUnauthorized() {
  if (authStore.isAuthenticated) handleLogout();
}

function removeSosNotice(id: string) {
  sosNotices.value = sosNotices.value.filter((notice) => notice.id !== id);
}

function handleSosTransition(deviceId: string, personId?: string | null) {
  const now = Date.now();
  const previousNoticeAt = lastSosNoticeAt.get(deviceId) ?? 0;
  if (now - previousNoticeAt < 10_000) return;
  lastSosNoticeAt.set(deviceId, now);
  const noticeId = `${deviceId}-${now}-${Math.random().toString(36).slice(2, 7)}`;
  sosNotices.value.push({ id: noticeId, deviceId, personId });
  window.setTimeout(() => removeSosNotice(noticeId), 3000);
}

async function pollSosEvents() {
  if (!isAuthed.value) return;
  try {
    const page = await fetchAlertEvents({ page: 1, pageSize: 100, eventType: 'sos' });
    const newEvents = sosPollingInitialized
      ? page.records
          .filter((event) => !seenSosEventIds.has(event.eventId))
          .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
      : [];
    page.records.forEach((event) => seenSosEventIds.add(event.eventId));
    newEvents.forEach((event) => {
      if (event.deviceId) handleSosTransition(event.deviceId, event.personId);
    });
    if (seenSosEventIds.size > 1000) {
      seenSosEventIds.clear();
      page.records.forEach((event) => seenSosEventIds.add(event.eventId));
    }
    sosPollingInitialized = true;
  } catch (error) {
    console.error('SOS 告警轮询失败', error);
  }
}

function handleDeviceStatusEvent(event: Event) {
  const detail = (event as CustomEvent<{ device: DeviceVO; previousStatus?: DeviceStatus }>).detail;
  if (!detail?.device) return;
  if (detail.previousStatus !== 'SOS' && detail.device.status === 'SOS') {
    handleSosTransition(detail.device.deviceId, detail.device.boundPersonId);
  }
}

function getPathForNav(sectionKey: SectionKey, submenuKey: string) {
  if (sectionKey === 'home') {
    return '/home/overview';
  }

  if (sectionKey === 'config') {
    return `/config/${submenuKey}`;
  }

  return `/${sectionKey}/${submenuKey}`;
}

function selectNav(sectionKey: SectionKey, submenuKey: string, replace = false) {
  if (!isAdmin.value && (sectionKey === 'identity' || sectionKey === 'config')) {
    selectNav('home', 'overview', true);
    return;
  }
  const nextSubmenu = submenuKey || getDefaultSubmenu(sectionKey);
  if (!isValidNavState({ section: sectionKey, submenu: nextSubmenu })) {
    return;
  }

  activeSection.value = sectionKey;
  activeSubmenu.value = nextSubmenu;
  openedSection.value = null;

  const nextPath = getPathForNav(sectionKey, nextSubmenu);
  if (window.location.pathname !== nextPath) {
    const historyMethod = replace ? 'replaceState' : 'pushState';
    window.history[historyMethod]({}, '', nextPath);
  }
}

function syncNavFromRoute() {
  const routeState = getRouteNavState();
  if (routeState.section && routeState.submenu) {
    selectNav(routeState.section, routeState.submenu, true);
    return;
  }
  selectNav('home', 'overview', true);
}

watch(
  [activeSection, activeSubmenu],
  ([section, submenu]) => {
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({ section, submenu }));
  },
  { immediate: true },
);

// Dynamically update the browser tab title based on locale and current page
watch(
  [isAuthed, currentPageTitle, locale],
  () => {
    if (!isAuthed.value) {
      document.title = t('login.title');
      return;
    }
    const site = t('siteTitle');
    document.title = currentPageTitle.value ? `${currentPageTitle.value} - ${site}` : site;
  },
  { immediate: true },
);

onMounted(async () => {
  window.addEventListener('popstate', syncNavFromRoute);
  window.addEventListener('twintrack:device-status', handleDeviceStatusEvent);
  window.addEventListener('twintrack:unauthorized', handleUnauthorized);
  await authStore.initialize();
  if (isAuthed.value) {
    syncNavFromRoute();
    void pollSosEvents();
  }
  sosPollingTimer = window.setInterval(pollSosEvents, 5000);
});

onUnmounted(() => {
  window.removeEventListener('popstate', syncNavFromRoute);
  window.removeEventListener('twintrack:device-status', handleDeviceStatusEvent);
  window.removeEventListener('twintrack:unauthorized', handleUnauthorized);
  if (sosPollingTimer) window.clearInterval(sosPollingTimer);
});
</script>

<style scoped>
.auth-loading {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #dce8ff;
  background: #080a0f;
}

.admin-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: #edf4ff;
  background:
    radial-gradient(circle at 18% 12%, rgba(47, 111, 255, 0.12), transparent 28%),
    radial-gradient(circle at 84% 10%, rgba(126, 93, 255, 0.12), transparent 26%),
    #080a0f;
}

.admin-shell--light {
  color: #172033;
  background:
    radial-gradient(circle at 16% 10%, rgba(47, 111, 255, 0.12), transparent 28%),
    radial-gradient(circle at 84% 12%, rgba(126, 93, 255, 0.1), transparent 25%),
    #eef2f8;
}

.admin-topbar {
  position: relative;
  z-index: 30;
  flex: 0 0 66px;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 0 22px;
  border-bottom: 1px solid rgba(100, 124, 171, 0.22);
  background: linear-gradient(180deg, rgba(17, 20, 30, 0.98), rgba(10, 12, 18, 0.96));
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.35);
}

.admin-shell--light .admin-topbar {
  border-bottom-color: rgba(78, 101, 140, 0.18);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 32px rgba(38, 52, 82, 0.12);
}

.brand-button {
  min-width: 168px;
  border: 0;
  background: transparent;
  color: #fff;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  font-size: 25px;
  font-weight: 900;
  letter-spacing: 0;
  text-align: left;
  text-transform: lowercase;
  cursor: pointer;
}

.admin-shell--light .brand-button {
  color: #111827;
}

.primary-nav {
  display: flex;
  align-items: stretch;
  height: 100%;
  min-width: 0;
}

.primary-nav > button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 118px;
  padding: 0 18px;
  border: 0;
  border-left: 1px solid rgba(100, 124, 171, 0.1);
  background: transparent;
  color: rgba(224, 235, 255, 0.7);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.admin-shell--light .primary-nav > button {
  border-left-color: rgba(78, 101, 140, 0.12);
  color: rgba(34, 45, 66, 0.68);
}

.primary-nav > button.active,
.primary-nav > button:hover {
  color: #fff;
  background: linear-gradient(180deg, rgba(65, 111, 255, 0.24), rgba(65, 111, 255, 0.05));
}

.admin-shell--light .primary-nav > button.active,
.admin-shell--light .primary-nav > button:hover {
  color: #172033;
  background: linear-gradient(180deg, rgba(62, 120, 255, 0.16), rgba(62, 120, 255, 0.04));
}

.topbar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.topbar-actions button,
.outline-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  min-width: 36px;
  border: 1px solid rgba(111, 141, 207, 0.24);
  border-radius: 6px;
  background: rgba(25, 30, 43, 0.82);
  color: rgba(201, 218, 255, 0.76);
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
}

.topbar-actions .theme-toggle {
  padding: 0 12px;
}

.theme-toggle span {
  font-size: 13px;
}

.admin-shell--light .topbar-actions button,
.admin-shell--light .outline-action {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(255, 255, 255, 0.72);
  color: rgba(34, 45, 66, 0.7);
}

.topbar-actions button:hover,
.outline-action:hover {
  border-color: rgba(116, 156, 255, 0.52);
  background: rgba(46, 70, 130, 0.42);
  color: #fff;
}

.submenu-panel {
  position: absolute;
  top: 66px;
  display: flex;
  flex-direction: column;
  min-width: 118px;
  padding: 8px 0;
  border: 1px solid rgba(103, 130, 196, 0.18);
  border-top: 0;
  border-radius: 0;
  background: rgba(12, 16, 25, 0.9);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.28);
  animation: dropdown 160ms ease-out;
}

.admin-shell--light .submenu-panel {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 24px 58px rgba(38, 52, 82, 0.14);
}

.submenu-panel button {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: rgba(224, 235, 255, 0.82);
  font-size: 13px;
  text-align: center;
  cursor: pointer;
}

.admin-shell--light .submenu-panel button {
  color: rgba(34, 45, 66, 0.76);
}

.submenu-panel button.active,
.submenu-panel button:hover {
  color: #4ea3ff;
  background: rgba(78, 163, 255, 0.08);
}

.admin-shell--light .submenu-panel button.active,
.admin-shell--light .submenu-panel button:hover {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
}

.admin-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.track-page {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.content-page {
  height: 100%;
  overflow: auto;
  padding: 24px 32px;
  background:
    linear-gradient(180deg, rgba(13, 16, 24, 0.78), rgba(8, 10, 15, 0.98)),
    radial-gradient(circle at 78% 12%, rgba(89, 86, 255, 0.14), transparent 26%);
}

.admin-shell--light .content-page {
  background:
    linear-gradient(180deg, rgba(246, 249, 253, 0.92), rgba(235, 240, 248, 0.98)),
    radial-gradient(circle at 78% 12%, rgba(77, 128, 255, 0.12), transparent 26%);
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(1440px, 100%);
  margin: 0 auto 18px;
}

.page-heading span {
  color: #719cff;
  font-size: 13px;
  font-weight: 700;
}

.page-heading h1 {
  margin: 6px 0 0;
  color: #fff;
  font-size: 25px;
  letter-spacing: 0;
}

.admin-shell--light .page-heading h1 {
  color: #172033;
}

.admin-shell--light :deep(.home-page),
.admin-shell--light :deep(.identity-page),
.admin-shell--light :deep(.config-page),
.admin-shell--light :deep(.map-editor-page),
.admin-shell--light :deep(.archive-page),
.admin-shell--light :deep(.event-page),
.admin-shell--light :deep(.beacon-page),
:deep(.home-page),
:deep(.identity-page),
:deep(.config-page),
:deep(.map-editor-page),
:deep(.archive-page),
:deep(.event-page),
:deep(.beacon-page) {
  width: min(1440px, 100%);
  margin-inline: auto;
}

.admin-shell--light :deep(.metric-card),
.admin-shell--light :deep(.intro-panel),
.admin-shell--light :deep(.status-panel),
.admin-shell--light :deep(.info-card),
.admin-shell--light :deep(.activity-panel),
.admin-shell--light :deep(.task-panel),
.admin-shell--light :deep(.side-panel),
.admin-shell--light :deep(.list-panel),
.admin-shell--light :deep(.detail-panel),
.admin-shell--light :deep(.hero-panel),
.admin-shell--light :deep(.binding-panel),
.admin-shell--light :deep(.archive-hero),
.admin-shell--light :deep(.stat-card),
.admin-shell--light :deep(.job-panel),
.admin-shell--light :deep(.query-panel),
.admin-shell--light :deep(.setting-panel),
.admin-shell--light :deep(.rule-panel),
.admin-shell--light :deep(.integration-panel),
.admin-shell--light :deep(.audit-panel) {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 16px 36px rgba(38, 52, 82, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.admin-shell--light :deep(.intro-panel),
.admin-shell--light :deep(.detail-panel),
.admin-shell--light :deep(.hero-panel),
.admin-shell--light :deep(.archive-hero) {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(239, 244, 252, 0.92));
}

.admin-shell--light :deep(.metric-card strong),
.admin-shell--light :deep(.intro-panel h2),
.admin-shell--light :deep(.status-panel h3),
.admin-shell--light :deep(.info-card h3),
.admin-shell--light :deep(.activity-panel h3),
.admin-shell--light :deep(.task-panel h3),
.admin-shell--light :deep(.summary-card strong),
.admin-shell--light :deep(.data-row strong),
.admin-shell--light :deep(.detail-panel h3),
.admin-shell--light :deep(.hero-panel h2),
.admin-shell--light :deep(.panel-toolbar h3),
.admin-shell--light :deep(.field-group h4),
.admin-shell--light :deep(.archive-hero h2),
.admin-shell--light :deep(.job-panel h3),
.admin-shell--light :deep(.query-panel h3),
.admin-shell--light :deep(.activity-detail strong),
.admin-shell--light :deep(.selected-channel strong),
.admin-shell--light :deep(.detail-main strong),
.admin-shell--light :deep(.person-cell strong),
.admin-shell--light :deep(.device-cell strong),
.admin-shell--light :deep(.profile-card strong),
.admin-shell--light :deep(.field-group strong),
.admin-shell--light :deep(.stat-card strong),
.admin-shell--light :deep(.job-row strong),
.admin-shell--light :deep(.setting-panel h3),
.admin-shell--light :deep(.rule-panel h3),
.admin-shell--light :deep(.integration-panel h3),
.admin-shell--light :deep(.audit-panel h3),
.admin-shell--light :deep(.rule-list strong),
.admin-shell--light :deep(.channel-list strong),
.admin-shell--light :deep(.status-list strong),
.admin-shell--light :deep(.detail-list strong),
.admin-shell--light :deep(.event-table strong),
.admin-shell--light :deep(.event-card-grid strong),
.admin-shell--light :deep(.beacon-table strong),
.admin-shell--light :deep(.beacon-detail strong) {
  color: #172033;
}

.admin-shell--light :deep(.intro-panel p),
.admin-shell--light :deep(.info-card p),
.admin-shell--light :deep(.setting-panel p),
.admin-shell--light :deep(.hero-panel p),
.admin-shell--light :deep(.archive-hero p),
.admin-shell--light :deep(.hero-panel span),
.admin-shell--light :deep(.panel-toolbar span),
.admin-shell--light :deep(.metric-card span),
.admin-shell--light :deep(.status-list span),
.admin-shell--light :deep(.activity-list span),
.admin-shell--light :deep(.task-list label),
.admin-shell--light :deep(.summary-card span),
.admin-shell--light :deep(.summary-card small),
.admin-shell--light :deep(.data-row span),
.admin-shell--light :deep(.data-row div small),
.admin-shell--light :deep(.detail-main span),
.admin-shell--light :deep(.detail-list span),
.admin-shell--light :deep(.profile-card span),
.admin-shell--light :deep(.field-group span),
.admin-shell--light :deep(.stat-card span),
.admin-shell--light :deep(.stat-card small),
.admin-shell--light :deep(.job-row span),
.admin-shell--light :deep(.job-row small),
.admin-shell--light :deep(.query-panel span),
.admin-shell--light :deep(.rule-list span),
.admin-shell--light :deep(.channel-list span),
.admin-shell--light :deep(.audit-list span),
.admin-shell--light :deep(.channel-list small),
.admin-shell--light :deep(.audit-list time),
.admin-shell--light :deep(.activity-list time),
.admin-shell--light :deep(.event-table span),
.admin-shell--light :deep(.event-table small),
.admin-shell--light :deep(.event-filter label),
.admin-shell--light :deep(.beacon-table span),
.admin-shell--light :deep(.beacon-table small),
.admin-shell--light :deep(.beacon-detail span),
.admin-shell--light :deep(.activity-detail span),
.admin-shell--light :deep(.task-progress span),
.admin-shell--light :deep(.selected-channel span),
.admin-shell--light :deep(.selected-channel small) {
  color: rgba(52, 65, 89, 0.68);
}

.admin-shell--light :deep(.status-list div),
.admin-shell--light :deep(.summary-card),
.admin-shell--light :deep(.detail-main),
.admin-shell--light :deep(.profile-card),
.admin-shell--light :deep(.field-group),
.admin-shell--light :deep(.rule-list div),
.admin-shell--light :deep(.channel-list div),
.admin-shell--light :deep(.task-list label),
.admin-shell--light :deep(.search-box),
.admin-shell--light :deep(.query-panel input),
.admin-shell--light :deep(.event-filter input),
.admin-shell--light :deep(.event-filter select),
.admin-shell--light :deep(.beacon-filter input),
.admin-shell--light :deep(.beacon-filter select),
.admin-shell--light :deep(.event-table article),
.admin-shell--light :deep(.beacon-table article),
.admin-shell--light :deep(.beacon-detail),
.admin-shell--light :deep(.activity-detail),
.admin-shell--light :deep(.task-progress),
.admin-shell--light :deep(.selected-channel) {
  border-color: rgba(78, 101, 140, 0.12);
  background: rgba(246, 249, 253, 0.78);
}

.admin-shell--light :deep(.table-head),
.admin-shell--light :deep(.job-head),
.admin-shell--light :deep(.event-table-head),
.admin-shell--light :deep(.beacon-table-head) {
  color: rgba(52, 65, 89, 0.62);
  background: rgba(235, 240, 248, 0.9);
}

.admin-shell--light :deep(.data-row),
.admin-shell--light :deep(.job-row),
.admin-shell--light :deep(.field-group div),
.admin-shell--light :deep(.activity-list div),
.admin-shell--light :deep(.detail-list div),
.admin-shell--light :deep(.audit-list div) {
  border-color: rgba(78, 101, 140, 0.1);
}

.admin-shell--light :deep(.quick-actions button),
.admin-shell--light :deep(.panel-toolbar button),
.admin-shell--light :deep(.data-row button),
.admin-shell--light :deep(.detail-panel button),
.admin-shell--light :deep(.panel-title button),
.admin-shell--light :deep(.hero-actions button),
.admin-shell--light :deep(.toolbar-actions button),
.admin-shell--light :deep(.archive-hero button),
.admin-shell--light :deep(.filter-row button),
.admin-shell--light :deep(.job-row button),
.admin-shell--light :deep(.query-panel button) {
  border-color: rgba(62, 120, 255, 0.32);
  background: rgba(62, 120, 255, 0.1);
  color: #1d4ed8;
}

.admin-shell--light :deep(.search-box) {
  color: rgba(52, 65, 89, 0.42);
}

.admin-shell--light :deep(.data-row:hover),
.admin-shell--light :deep(.job-row:hover),
.admin-shell--light :deep(.rule-list div:hover),
.admin-shell--light :deep(.rule-list div.active),
.admin-shell--light :deep(.channel-list div:hover),
.admin-shell--light :deep(.channel-list div.active),
.admin-shell--light :deep(.activity-list div:hover),
.admin-shell--light :deep(.activity-list div.active),
.admin-shell--light :deep(.setting-panel.active) {
  background: rgba(62, 120, 255, 0.08);
}

.admin-shell--light :deep(.metric-card small.up) {
  color: #059669;
}

.admin-shell--light :deep(.metric-card small.normal),
.admin-shell--light :deep(.info-card > span) {
  color: #2563eb;
}

.admin-shell--light :deep(.metric-card small.warn) {
  color: #b45309;
}

.admin-shell--light :deep(.data-row > small.online),
.admin-shell--light :deep(.job-row > small.done),
.admin-shell--light :deep(.activity-list small.info) {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.admin-shell--light :deep(.data-row > small.idle),
.admin-shell--light :deep(.rule-list small.normal) {
  color: #475569;
  background: rgba(100, 116, 139, 0.12);
}

.admin-shell--light :deep(.data-row > small.warn),
.admin-shell--light :deep(.job-row > small.warn),
.admin-shell--light :deep(.activity-list small.warn),
.admin-shell--light :deep(.rule-list small.warn) {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.admin-shell--light :deep(.activity-list small.alarm),
.admin-shell--light :deep(.rule-list small.alarm) {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.12);
}

.admin-shell--light :deep(.job-row > small.running),
.admin-shell--light :deep(.data-row > small.offline) {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
}

.sos-notice-stack {
  position: fixed;
  z-index: 1500;
  top: 84px;
  right: 18px;
  display: grid;
  width: min(390px, calc(100vw - 36px));
  gap: 10px;
  pointer-events: none;
}

.sos-notice {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border: 1px solid rgba(255, 112, 112, 0.45);
  border-radius: 10px;
  background: rgba(43, 12, 18, 0.97);
  color: #fff;
  box-shadow: 0 18px 42px rgba(41, 5, 12, 0.34);
  pointer-events: auto;
}

.sos-notice-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 34px;
  border-radius: 7px;
  background: #dc2626;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.sos-notice strong {
  font-size: 14px;
}

.sos-notice p {
  margin: 4px 0 0;
  color: rgba(255, 235, 238, 0.76);
  font-size: 12px;
}

.sos-notice button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 22px;
}

.sos-notice-enter-active,
.sos-notice-leave-active,
.sos-notice-move {
  transition: opacity 280ms ease, transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sos-notice-enter-from,
.sos-notice-leave-to {
  opacity: 0;
  transform: translateX(110%);
}

.sos-notice-leave-active {
  position: absolute;
  width: 100%;
}

@keyframes dropdown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .admin-topbar {
    gap: 8px;
    padding: 0 10px;
  }

  .brand-button {
    min-width: 120px;
    font-size: 20px;
  }

  .primary-nav {
    overflow-x: auto;
  }

  .primary-nav > button {
    min-width: 96px;
    padding: 0 10px;
  }

  .submenu-panel {
    left: 0 !important;
    width: 100vw !important;
    padding: 10px;
  }
}
</style>
