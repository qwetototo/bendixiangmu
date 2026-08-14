<template>
  <section :class="['user-management-page', `user-management-page--${themeMode}`]">
    <header class="user-management-header">
      <div>
        <h2>{{ t('users.title') }}</h2>
        <p>{{ t('users.description') }}</p>
      </div>
      <button class="primary-action" type="button" @click="openCreate">{{ t('users.add') }}</button>
    </header>

    <p v-if="message" :class="['user-message', { error: messageIsError }]">{{ message }}</p>

    <section class="user-table-panel">
      <div class="user-table-head">
        <span>ID</span>
        <span>{{ t('users.username') }}</span>
        <span>{{ t('users.level') }}</span>
        <span>{{ t('users.actions') }}</span>
      </div>
      <div v-if="loading" class="user-empty">{{ t('users.loading') }}</div>
      <div v-else-if="users.length === 0" class="user-empty">{{ t('users.empty') }}</div>
      <article v-for="user in users" v-else :key="user.id" class="user-table-row">
        <span>{{ user.id }}</span>
        <strong>{{ user.username }}</strong>
        <span :class="['level-badge', user.userLevel === 0 ? 'admin' : 'normal']">
          {{ user.userLevel === 0 ? t('users.admin') : t('users.normal') }}
        </span>
        <div class="row-actions">
          <button type="button" :disabled="user.id === authStore.user?.id" @click="openEdit(user)">{{ t('common.edit') }}</button>
          <button type="button" @click="openPasswordDialog(user)">{{ t('users.changePassword') }}</button>
          <button type="button" class="danger" :disabled="user.id === authStore.user?.id || user.userLevel === 0" @click="removeUser(user)">
            {{ t('common.delete') }}
          </button>
        </div>
      </article>
    </section>

    <BaseModal
      :open="dialogOpen"
      :title="editingUser ? t('users.editTitle') : t('users.addTitle')"
      :eyebrow="t('users.securityNote')"
      :theme-mode="themeMode"
      @close="closeDialog"
    >
      <div class="user-form">
        <label>
          <span>{{ t('users.username') }}</span>
          <input v-model.trim="form.username" maxlength="64" autocomplete="off" />
        </label>
        <label>
          <span>{{ t('users.level') }}</span>
          <select v-model.number="form.userLevel" :disabled="editingUser?.userLevel === 0">
            <option :value="1">{{ t('users.normal') }}</option>
            <option v-if="editingUser" :value="0" disabled>{{ t('users.admin') }}</option>
          </select>
        </label>
        <small v-if="editingUser?.userLevel === 0">{{ t('users.levelLockedAdmin') }}</small>
        <small v-else-if="editingUser">{{ t('users.levelNoPromote') }}</small>
        <small v-if="!editingUser">{{ t('users.defaultPasswordHint') }}</small>
      </div>
      <template #footer>
        <button type="button" :disabled="saving" @click="closeDialog">{{ t('common.cancel') }}</button>
        <button class="primary" type="button" :disabled="saving || !form.username" @click="saveUser">
          {{ saving ? t('users.saving') : t('common.save') }}
        </button>
      </template>
    </BaseModal>

    <BaseModal
      :open="passwordDialogOpen"
      :title="t('users.changePasswordTitle', { username: passwordUser?.username ?? '' })"
      :eyebrow="t('users.securityNote')"
      :theme-mode="themeMode"
      @close="closePasswordDialog"
    >
      <div class="user-form">
        <label>
          <span>{{ t('users.newPassword') }}</span>
          <input v-model="passwordForm.password" type="password" minlength="8" maxlength="128" autocomplete="new-password" />
        </label>
        <label>
          <span>{{ t('users.confirmPassword') }}</span>
          <input v-model="passwordForm.confirmPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" />
        </label>
        <small :class="{ 'password-error': passwordForm.confirmPassword && !passwordsMatch }">
          {{ passwordForm.confirmPassword && !passwordsMatch ? t('users.passwordMismatch') : t('users.passwordHint') }}
        </small>
      </div>
      <template #footer>
        <button type="button" :disabled="passwordSaving" @click="closePasswordDialog">{{ t('common.cancel') }}</button>
        <button class="primary" type="button" :disabled="!canSavePassword" @click="savePassword">
          {{ passwordSaving ? t('users.saving') : t('users.changePassword') }}
        </button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/BaseModal.vue';
import { useAuthStore } from '@/stores/auth';
import { changeUserPassword, createUser, deleteUser, fetchUsers, updateUser, type UserVO } from '@/services/userApi';

const { themeMode } = defineProps<{ themeMode: 'dark' | 'light' }>();

const { t } = useI18n();
const authStore = useAuthStore();
const users = ref<UserVO[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogOpen = ref(false);
const editingUser = ref<UserVO | null>(null);
const passwordDialogOpen = ref(false);
const passwordUser = ref<UserVO | null>(null);
const passwordSaving = ref(false);
const message = ref('');
const messageIsError = ref(false);
const form = reactive<{ username: string; userLevel: 0 | 1 }>({ username: '', userLevel: 1 });
const passwordForm = reactive({ password: '', confirmPassword: '' });
const passwordsMatch = computed(() => passwordForm.password === passwordForm.confirmPassword);
const canSavePassword = computed(
  () => !passwordSaving.value && passwordForm.password.length >= 8 && passwordForm.password.length <= 128 && passwordsMatch.value,
);

function showMessage(content: string, error = false) {
  message.value = content;
  messageIsError.value = error;
}

async function loadUsers() {
  loading.value = true;
  try {
    users.value = await fetchUsers();
  } catch (error) {
    showMessage(error instanceof Error ? error.message : t('users.loadFailed'), true);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingUser.value = null;
  form.username = '';
  form.userLevel = 1;
  dialogOpen.value = true;
}

function openEdit(user: UserVO) {
  editingUser.value = user;
  form.username = user.username;
  form.userLevel = user.userLevel;
  dialogOpen.value = true;
}

function closeDialog() {
  if (!saving.value) dialogOpen.value = false;
}

async function saveUser() {
  if (!form.username) return;
  const editing = editingUser.value;
  // 安全校验：管理员不能创建/提升其他管理员，也不能调整其他管理员的等级
  if (!editing && form.userLevel === 0) return;
  if (editing) {
    if (editing.userLevel === 0 && form.userLevel !== 0) return;
    if (editing.userLevel === 1 && form.userLevel === 0) return;
  }
  saving.value = true;
  try {
    if (editing) await updateUser(editing.id, { ...form });
    else await createUser({ ...form });
    dialogOpen.value = false;
    showMessage(t('users.saved'));
    await loadUsers();
  } catch (error) {
    showMessage(error instanceof Error ? error.message : t('users.saveFailed'), true);
  } finally {
    saving.value = false;
  }
}

function openPasswordDialog(user: UserVO) {
  passwordUser.value = user;
  passwordForm.password = '';
  passwordForm.confirmPassword = '';
  passwordDialogOpen.value = true;
}

function closePasswordDialog() {
  if (!passwordSaving.value) passwordDialogOpen.value = false;
}

async function savePassword() {
  if (!passwordUser.value || !canSavePassword.value) return;
  passwordSaving.value = true;
  try {
    await changeUserPassword(passwordUser.value.id, passwordForm.password);
    const username = passwordUser.value.username;
    passwordDialogOpen.value = false;
    showMessage(t('users.passwordChanged', { username }));
  } catch (error) {
    showMessage(error instanceof Error ? error.message : t('users.passwordChangeFailed'), true);
  } finally {
    passwordSaving.value = false;
  }
}

async function removeUser(user: UserVO) {
  if (!window.confirm(t('users.confirmDelete', { username: user.username }))) return;
  try {
    await deleteUser(user.id);
    showMessage(t('users.deleted'));
    await loadUsers();
  } catch (error) {
    showMessage(error instanceof Error ? error.message : t('users.deleteFailed'), true);
  }
}

onMounted(loadUsers);
</script>

<style scoped>
.user-management-page { display: grid; gap: 16px; width: min(1200px, 100%); margin: 0 auto; }
.user-management-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.user-management-header h2 { margin: 0 0 6px; }
.user-management-header p { margin: 0; color: #71809b; }
.primary-action { padding: 10px 18px; border: 0; border-radius: 6px; background: #397df5; color: #fff; cursor: pointer; }
.user-table-panel { overflow: hidden; border: 1px solid rgba(89, 113, 156, .2); border-radius: 8px; background: rgba(255, 255, 255, .82); }
.user-table-head, .user-table-row { display: grid; grid-template-columns: 100px minmax(220px, 1fr) 180px minmax(300px, auto); align-items: center; gap: 16px; padding: 14px 18px; }
.user-table-head { color: #71809b; font-size: 13px; background: rgba(54, 79, 124, .07); }
.user-table-row { border-top: 1px solid rgba(89, 113, 156, .14); }
.level-badge { width: fit-content; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
.level-badge.admin { color: #7c3aed; background: #ede9fe; }
.level-badge.normal { color: #2563eb; background: #dbeafe; }
.row-actions { display: flex; justify-content: flex-end; gap: 8px; }
.row-actions button { padding: 6px 10px; border: 1px solid rgba(72, 101, 153, .22); border-radius: 5px; background: transparent; cursor: pointer; }
.row-actions .danger { color: #dc3545; }
.row-actions button:disabled { opacity: .45; cursor: not-allowed; }
.user-empty { padding: 36px; text-align: center; color: #71809b; }
.user-message { margin: 0; color: #168654; }
.user-message.error { color: #d83d4d; }
.user-form { display: grid; gap: 16px; }
.user-form label { display: grid; gap: 7px; }
.user-form input, .user-form select { min-height: 40px; padding: 0 10px; border: 1px solid rgba(82, 108, 154, .3); border-radius: 6px; }
.user-form small { color: #71809b; }
.user-form small.password-error { color: #d83d4d; }
.user-management-page--dark { color: #edf4ff; }
.user-management-page--dark .user-table-panel { background: rgba(17, 22, 34, .9); }
.user-management-page--dark .user-table-head { background: rgba(74, 102, 157, .12); }
.user-management-page--dark .row-actions button { color: #dbe7ff; }
.user-management-page--dark .row-actions .danger { color: #ff8f9c; }
.user-management-page--dark .user-form input,
.user-management-page--dark .user-form select { border-color: rgba(107, 142, 204, .34); background: #0b101a; color: #edf4ff; }
@media (max-width: 820px) { .user-table-head { display: none; } .user-table-row { grid-template-columns: 60px 1fr; } .row-actions { grid-column: 1 / -1; justify-content: flex-start; } }
</style>
