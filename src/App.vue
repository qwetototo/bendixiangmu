<template>
  <LoginView v-if="!isAuthed" @login="isAuthed = true" />

  <main v-else :class="['admin-shell', `admin-shell--${themeMode}`]">
    <header class="admin-topbar" @mouseleave="closeMenu">
      <button class="brand-button" type="button" @click="selectNav('home', 'overview')">deepfusion</button>
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
        <button type="button" class="theme-toggle" title="切换主题" @click="toggleTheme">
          <BgColorsOutlined />
          <span>{{ themeMode === 'dark' ? '浅色' : '深色' }}</span>
        </button>
        <button type="button" title="通知">
          <BellOutlined />
        </button>
        <button type="button" title="退出登录" @click="isAuthed = false">
          <LogoutOutlined />
        </button>
      </div>
      <section v-if="openedSection" class="submenu-panel" :style="submenuStyle">
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
      <section v-if="activeSection === 'track' && activeSubmenu !== 'archive'" class="track-page">
        <TwinScreen embedded :theme-mode="themeMode" />
      </section>

      <section v-else class="content-page">
        <div class="page-heading">
          <div>
            <span>{{ currentSectionLabel }}</span>
            <h1>{{ currentPageTitle }}</h1>
          </div>
          <button class="outline-action" type="button">
            <ReloadOutlined />
            <span>刷新</span>
          </button>
        </div>

        <HomeView v-if="activeSection === 'home'" @navigate="selectNav" />
        <TrackArchiveView v-else-if="activeSection === 'track'" />
        <IdentityView v-else-if="activeSection === 'identity'" :active-submenu="activeSubmenu" :theme-mode="themeMode" />
        <ConfigView v-else />
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue';
import { BellOutlined, BgColorsOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import ConfigView from '@/views/admin/ConfigView.vue';
import HomeView from '@/views/admin/HomeView.vue';
import IdentityView from '@/views/admin/IdentityView.vue';
import TrackArchiveView from '@/views/admin/TrackArchiveView.vue';
import LoginView from '@/views/LoginView.vue';
import TwinScreen from '@/views/TwinScreen.vue';
import { findNavSection, getDefaultSubmenu, navSections, type SectionKey } from '@/services/navigation';

const isAuthed = ref(false);
const activeSection = ref<SectionKey>('home');
const openedSection = ref<SectionKey | null>(null);
const activeSubmenu = ref(getDefaultSubmenu('home'));
const themeMode = ref<'dark' | 'light'>('dark');
const navButtonRefs = new Map<SectionKey, HTMLElement>();
const submenuLeft = ref(0);
const submenuWidth = ref(0);

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

function selectNav(sectionKey: SectionKey, submenuKey: string) {
  activeSection.value = sectionKey;
  activeSubmenu.value = submenuKey || getDefaultSubmenu(sectionKey);
  openedSection.value = null;
}
</script>

<style scoped>
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
.admin-shell--light :deep(.archive-page),
:deep(.home-page),
:deep(.identity-page),
:deep(.config-page),
:deep(.archive-page) {
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
.admin-shell--light :deep(.detail-list strong) {
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
.admin-shell--light :deep(.activity-list time) {
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
.admin-shell--light :deep(.query-panel input) {
  border-color: rgba(78, 101, 140, 0.12);
  background: rgba(246, 249, 253, 0.78);
}

.admin-shell--light :deep(.table-head),
.admin-shell--light :deep(.job-head) {
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
.admin-shell--light :deep(.channel-list div:hover) {
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
