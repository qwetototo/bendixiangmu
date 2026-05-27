<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-brand">
        <span>deepfusion</span>
        <strong>人员轨迹数字孪生平台</strong>
      </div>
      <form class="login-form" @submit.prevent="$emit('login', { remember: loginForm.remember })">
        <label>
          <span>账号</span>
          <input v-model="loginForm.account" autocomplete="username" placeholder="admin@deepfusion" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="loginForm.password" autocomplete="current-password" placeholder="请输入密码" type="password" />
        </label>
        <div class="login-options">
          <label>
            <input v-model="loginForm.remember" type="checkbox" />
            <span>保持登录</span>
          </label>
          <button type="button">忘记密码</button>
        </div>
        <button class="login-submit" type="submit">登录控制台</button>
      </form>
      <div class="login-metrics">
        <div>
          <strong>3D</strong>
          <span>实时轨迹展示</span>
        </div>
        <div>
          <strong>24h</strong>
          <span>轨迹保存回放</span>
        </div>
        <div>
          <strong>IoT</strong>
          <span>用户设备联动</span>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

defineEmits<{
  login: [{ remember: boolean }];
}>();

const loginForm = reactive({
  account: 'admin@deepfusion',
  password: '',
  remember: true,
});
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
</style>
