<template>
  <main class="login-page">
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
          <button type="button">{{ t('login.forgotPassword') }}</button>
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

    <footer class="beian-footer">
      <img :src="footerGaIcon" alt="" class="beian-footer__icon" />
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
        苏ICP备2026022812号
      </a>
    </footer>
  </template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import footerGaIcon from '@/assets/image/footer_ga-1.png';
import type { LoginPayload } from '@/services/authApi';
const { t } = useI18n();

const props = defineProps<{
  loading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  login: [payload: LoginPayload];
}>();

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
