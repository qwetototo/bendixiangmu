<template>
  <main :class="['login-page', `login-page--${themeMode}`]">
    <button class="login-theme-toggle" type="button" :title="t('theme.switchTheme')" @click="$emit('toggleTheme')">
      <BgColorsOutlined />
      <span>{{ themeMode === 'dark' ? t('theme.light') : t('theme.dark') }}</span>
    </button>
    <section class="login-panel">
      <div class="login-brand">
        <span>deepfusion</span>
        <strong>{{ t('login.title') }}</strong>
      </div>
      <form class="login-form" @submit.prevent="submitLogin">
        <label>
          <span>{{ t('login.account') }}</span>
          <input v-model.trim="loginForm.username" autocomplete="username" :disabled="loading" />
        </label>
        <label>
          <span>{{ t('login.password') }}</span>
          <input v-model="loginForm.password" autocomplete="current-password" :disabled="loading" :placeholder="t('login.passwordPlaceholder')" type="password" />
        </label>
        <div class="login-options">
          <label>
            <input v-model="loginForm.remember" :disabled="loading" type="checkbox" />
            <span>{{ t('login.rememberMe') }}</span>
          </label>
          <button type="button" @click="forgotOpen = true">{{ t('login.forgotPassword') }}</button>
        </div>
        <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>
        <button class="login-submit" type="submit" :disabled="loading">
          {{ loading ? t('login.loggingIn') : t('login.submit') }}
        </button>
      </form>
      <div class="login-metrics">
        <div>
          <strong>3D</strong>
          <span>{{ t('login.feature1') }}</span>
        </div>
        <div>
          <strong>24h</strong>
          <span>{{ t('login.feature2') }}</span>
        </div>
        <div>
          <strong>IoT</strong>
          <span>{{ t('login.feature3') }}</span>
        </div>
      </div>
    </section>
  </main>

  <Teleport to="body">
    <div
      v-if="forgotOpen"
      :class="['forgot-mask', `forgot-mask--${themeMode}`]"
      @click.self="forgotOpen = false"
    >
      <section class="forgot-dialog" role="dialog" aria-modal="true">
        <header>
          <h3>{{ t('login.forgotPassword') }}</h3>
          <button class="forgot-close" type="button" aria-label="关闭" @click="forgotOpen = false">×</button>
        </header>
        <div class="forgot-body">
          <p class="forgot-message">{{ t('login.forgotContact') }}</p>
          <p v-if="adminContact" class="forgot-contact">{{ adminContact }}</p>
        </div>
        <button class="forgot-ok" type="button" @click="forgotOpen = false">{{ t('common.confirm') }}</button>
      </section>
    </div>
  </Teleport>

    <footer v-if="isZhBuild" class="beian-footer">
      <img :src="footerGaIcon" alt="" class="beian-footer__icon" />
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
        苏ICP备2026022812号
      </a>
    </footer>
  </template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { BgColorsOutlined } from '@ant-design/icons-vue';
import footerGaIcon from '@/assets/image/footer_ga-1.png';
import type { LoginPayload } from '@/services/authApi';
const { t } = useI18n();

/** 是否为中文版构建（build:zh），英文版构建（build:en）不显示 ICP 备案 footer */
const isZhBuild = (import.meta.env.VITE_DEFAULT_LOCALE ?? 'zh-CN') === 'zh-CN';

/** 管理员联系方式，来自环境变量 VITE_ADMIN_CONTACT；未配置时隐藏弹窗中的联系方式 */
const adminContact = (import.meta.env.VITE_ADMIN_CONTACT ?? '').trim();

const props = defineProps<{
  loading: boolean;
  errorMessage: string;
  themeMode: 'dark' | 'light';
}>();

const emit = defineEmits<{
  login: [payload: LoginPayload];
  toggleTheme: [];
}>();

const forgotOpen = ref(false);

const loginForm = reactive({
  username: '',
  password: '',
  remember: true,
});

function submitLogin() {
  if (props.loading || !loginForm.username || !loginForm.password) return;
  emit('login', { ...loginForm });
}
</script>

<style scoped>
.login-page {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 24px;
  color: #edf4ff;
  background:
    linear-gradient(135deg, rgba(10, 12, 18, 0.94), rgba(5, 7, 12, 0.96)),
    radial-gradient(circle at 68% 28%, rgba(87, 78, 255, 0.28), transparent 30%),
    radial-gradient(circle at 28% 70%, rgba(28, 132, 255, 0.22), transparent 28%);
}

.login-page--light {
  color: #172033;
  background:
    linear-gradient(135deg, rgba(250, 252, 255, 0.96), rgba(238, 242, 248, 0.98)),
    radial-gradient(circle at 68% 28%, rgba(87, 78, 255, 0.14), transparent 30%),
    radial-gradient(circle at 28% 70%, rgba(28, 132, 255, 0.12), transparent 28%);
}

.login-theme-toggle {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(111, 141, 207, 0.24);
  border-radius: 6px;
  background: rgba(25, 30, 43, 0.82);
  color: rgba(201, 218, 255, 0.76);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
}

.login-theme-toggle:hover {
  border-color: rgba(116, 156, 255, 0.52);
  background: rgba(46, 70, 130, 0.42);
  color: #fff;
}

.login-page--light .login-theme-toggle {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(255, 255, 255, 0.72);
  color: rgba(34, 45, 66, 0.7);
}

.forgot-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 8, 14, 0.66);
}

.forgot-mask--light {
  background: rgba(38, 52, 82, 0.32);
}

.forgot-dialog {
  width: min(360px, 100%);
  padding: 22px 22px 18px;
  border: 1px solid rgba(111, 141, 207, 0.26);
  border-radius: 8px;
  background: rgba(18, 23, 34, 0.97);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
}

.forgot-mask--light .forgot-dialog {
  border-color: rgba(78, 101, 140, 0.18);
  background: #fff;
  box-shadow: 0 24px 70px rgba(38, 52, 82, 0.2);
}

.forgot-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.forgot-dialog h3 {
  margin: 0;
  color: #edf4ff;
  font-size: 16px;
}

.forgot-mask--light .forgot-dialog h3 {
  color: #172033;
}

.forgot-close {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(201, 218, 255, 0.7);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.forgot-mask--light .forgot-close {
  color: rgba(34, 45, 66, 0.7);
}

.forgot-body {
  display: grid;
  gap: 8px;
}

.forgot-message,
.forgot-contact {
  margin: 0;
  color: rgba(227, 237, 255, 0.82);
  font-size: 14px;
  line-height: 1.6;
}

.forgot-mask--light .forgot-message,
.forgot-mask--light .forgot-contact {
  color: rgba(23, 32, 51, 0.8);
}

.forgot-contact {
  color: #75a9ff;
}

.forgot-mask--light .forgot-contact {
  color: #2f6bff;
}

.forgot-ok {
  width: 100%;
  height: 38px;
  margin-top: 18px;
  border: 0;
  border-radius: 6px;
  background: linear-gradient(135deg, #2f82ff, #6d5cff);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.login-panel {
  width: min(920px, 100%);
  display: grid;
  grid-template-columns: minmax(300px, 420px) 1fr;
  gap: 34px;
  padding: 34px;
  border: 1px solid rgba(113, 136, 182, 0.24);
  border-radius: 8px;
  background: rgba(12, 15, 24, 0.88);
  box-shadow: 0 26px 90px rgba(0, 0, 0, 0.46);
}

.login-brand {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
}

.login-brand span {
  color: #fff;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  font-size: 44px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: lowercase;
}

.login-brand strong {
  color: rgba(227, 237, 255, 0.78);
  font-size: 16px;
  font-weight: 500;
}

.login-form {
  display: grid;
  gap: 16px;
}

.login-form label {
  display: grid;
  gap: 8px;
  color: rgba(227, 237, 255, 0.72);
  font-size: 13px;
}

.login-form input {
  height: 42px;
  border: 1px solid rgba(107, 142, 204, 0.34);
  border-radius: 6px;
  background: rgba(4, 8, 15, 0.72);
  color: #fff;
  outline: none;
  padding: 0 12px;
}

.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.login-options label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.login-options input {
  width: 15px;
  height: 15px;
  accent-color: #4d8dff;
}

.login-options button {
  border: 0;
  background: transparent;
  color: rgba(201, 218, 255, 0.76);
  cursor: pointer;
}

.login-submit {
  height: 44px;
  border: 0;
  border-radius: 6px;
  background: linear-gradient(135deg, #2f82ff, #6d5cff);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
}

.login-submit:disabled {
  cursor: wait;
  opacity: 0.68;
}

.login-error {
  margin: 0;
  color: #ff8f9c;
  font-size: 13px;
}

.login-metrics {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.login-metrics div {
  padding: 16px;
  border: 1px solid rgba(107, 142, 204, 0.24);
  border-radius: 8px;
  background: rgba(17, 22, 34, 0.78);
}

.login-metrics strong {
  display: block;
  color: #75a9ff;
  font-size: 24px;
}

.login-metrics span {
  color: rgba(228, 238, 255, 0.68);
  font-size: 13px;
}

.login-page--light .login-panel {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 26px 90px rgba(38, 52, 82, 0.14);
}

.login-page--light .login-brand span {
  color: #111827;
}

.login-page--light .login-brand strong {
  color: rgba(23, 32, 51, 0.7);
}

.login-page--light .login-form label {
  color: rgba(23, 32, 51, 0.72);
}

.login-page--light .login-form input {
  border-color: rgba(78, 101, 140, 0.3);
  background: #fff;
  color: #172033;
}

.login-page--light .login-options button {
  color: rgba(34, 45, 66, 0.72);
}

.login-page--light .login-metrics div {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(255, 255, 255, 0.8);
}

.login-page--light .login-metrics span {
  color: rgba(23, 32, 51, 0.66);
}

.login-page--light .beian-footer {
  border-top-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.85);
}

.login-page--light .beian-footer a {
  color: rgba(34, 45, 66, 0.72);
}

.login-page--light .beian-footer a:hover {
  color: #111827;
}

@media (max-width: 980px) {
  .login-panel {
    grid-template-columns: 1fr;
  }
}

.beian-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  border-top: 1px solid rgba(92, 151, 213, 0.16);
  background: rgba(5, 18, 31, 0.78);
  font-size: 12px;
  line-height: 1.4;
}

.beian-footer__icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.beian-footer a {
  color: rgba(226, 239, 252, 0.88);
  text-decoration: none;
}

.beian-footer a:hover {
  color: #fff;
}
</style>
