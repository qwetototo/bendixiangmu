<template>
  <section :class="['management-page', `management-page--${themeMode}`, { 'beacon-deployment-page': deploymentOpen }]">
    <template v-if="deploymentOpen && deploymentBeacon && deploymentMap && deploymentFloor">
      <header class="management-toolbar">
        <div>
          <button type="button" class="back-button" @click="closeDeployment">← {{ t('common.back') }}</button>
          <h2>{{ t('management.deployBeaconTitle', { id: deploymentBeacon.beaconId }) }}</h2>
          <p>{{ deploymentMap.name }} / {{ deploymentFloor.name }}</p>
        </div>
      </header>
      <section class="deployment-workspace">
        <BeaconDeploymentScene :config="deploymentFloor.config" :beacons="floorBeacons" :beacon-id="deploymentBeacon.beaconId" :position="deploymentPosition" @position-change="setDeploymentPosition" />
        <div class="coordinate-hud">
          <strong>{{ deploymentBeacon.beaconId }}</strong>
          <div v-for="axis in axes" :key="axis" class="coordinate-control">
            <span>{{ axis.toUpperCase() }}</span>
            <button type="button" :aria-label="`${axis} -`" @pointerdown.prevent="startNudge(axis, -1)">−</button>
            <input :value="deploymentPosition[axis]" type="number" step="any" @input="setAxis(axis, $event)" />
            <button type="button" :aria-label="`${axis} +`" @pointerdown.prevent="startNudge(axis, 1)">+</button>
          </div>
        </div>
        <button class="primary deployment-complete" type="button" :disabled="saving" @click="completeDeployment">{{ saving ? t('common.saving') : t('management.completeDeployment') }}</button>
      </section>
      <div v-if="feedback" class="management-feedback">{{ feedback }}</div>
    </template>

    <template v-else>
      <header class="management-toolbar">
        <div><h2>{{ t('nav.beaconMgmt') }}</h2><p>{{ t('nav.beaconMgmtDesc') }}</p></div>
        <div class="management-actions"><button class="primary" type="button" @click="openEditor()">{{ t('common.add') }}</button><button type="button" @click="openImport">{{ t('common.import') }}</button><button type="button" @click="exportOpen = true">{{ t('common.batchExport') }}</button></div>
      </header>
      <section class="management-panel">
        <div class="management-panel-title"><div><h3>{{ t('management.beaconList') }}</h3><p>{{ t('management.records', { count: total }) }}</p></div></div>
        <div class="management-filters">
          <input v-model="keyword" class="search-input" :placeholder="t('management.searchBeacon')" @keyup.enter="load" />
          <select v-model="statusFilter" @change="load"><option value="">{{ t('management.allDeploymentStatuses') }}</option><option value="undeployed">{{ t('management.undeployed') }}</option><option value="deployed">{{ t('management.deployed') }}</option></select>
          <button type="button" @click="load">{{ t('common.search') }}</button><button type="button" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>
        <div class="management-table-wrap">
          <table class="management-table">
            <thead><tr><th>{{ t('management.beaconId') }}</th><th>{{ t('management.deploymentStatus') }}</th><th>{{ t('management.deploymentLocation') }}</th><th>{{ t('management.coordinate') }}</th><th>{{ t('management.battery') }}</th><th>{{ t('management.action') }}</th></tr></thead>
            <tbody>
              <tr v-for="beacon in beacons" :key="beacon.beaconId">
                <td>{{ beacon.beaconId }}</td><td><span :class="['status-chip', beacon.deploymentStatus]">{{ deploymentStatusLabel(beacon) }}</span></td><td>{{ formatLocation(beacon) }}</td><td>{{ beacon.deploymentStatus === 'deployed' ? formatCoordinate(beacon) : '—' }}</td>
                <td><div class="battery-value"><span>{{ beacon.battery }}%</span><div class="battery-bar"><i :style="{ width: `${beacon.battery}%` }"></i></div></div></td>
                <td><div class="row-actions"><button type="button" @click="openEditor(beacon)">{{ t('common.edit') }}</button><button class="danger" type="button" @click="deleteTarget = beacon">{{ t('common.delete') }}</button></div></td>
              </tr>
              <tr v-if="!loading && beacons.length === 0"><td class="empty-row" colspan="6">{{ t('management.noBeacons') }}</td></tr><tr v-if="loading"><td class="empty-row" colspan="6">{{ t('management.loading') }}</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="feedback" class="management-feedback">{{ feedback }}</div>
      </section>
    </template>

    <BaseModal :open="editorOpen" :title="editingId ? t('management.editBeacon') : t('management.addBeacon')" :eyebrow="t('management.beaconInfo')" :theme-mode="themeMode" @close="closeEditor">
      <div class="form-grid">
        <label>{{ t('management.beaconId') }}<input v-model.trim="form.beaconId" maxlength="64" :placeholder="t('management.beaconIdExample')" /></label>
        <label>{{ t('management.status') }}<input v-model.trim="form.status" maxlength="10" :placeholder="t('management.max10Chars')" /></label>
        <label>{{ t('management.batteryPercent') }}<input v-model.number="form.battery" type="number" min="0" max="100" /></label>
        <label v-if="editingId">{{ t('management.deploymentStatus') }}<input :value="editingBeacon ? deploymentStatusLabel(editingBeacon) : ''" disabled /></label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer><button type="button" :disabled="saving" @click="closeEditor">{{ t('common.cancel') }}</button><button v-if="editingBeacon" type="button" :disabled="saving" @click="beginDeployment(editingBeacon)">{{ t('management.deploy') }}</button><button class="primary" type="button" :disabled="saving" @click="save">{{ saving ? t('common.saving') : t('common.save') }}</button></template>
    </BaseModal>

    <BaseModal :open="wizardOpen" :title="t('management.selectDeploymentLocation')" :eyebrow="t('management.stepOf', { step: wizardStep, total: 2 })" :theme-mode="themeMode" @close="closeWizard">
      <template v-if="wizardStep === 1">
        <p class="import-hint">{{ t('management.selectBuildingHint') }}</p>
        <div class="picker-list"><button v-for="map in availableMaps" :key="map.id" type="button" :class="{ selected: selectedMapId === map.id }" @click="selectedMapId = map.id"><span><strong>{{ map.name }}</strong><small>{{ map.description || t('config.floorsCount', { n: map.metadata.floors.length }) }}</small></span><span>›</span></button><p v-if="!mapsLoading && !availableMaps.length" class="empty-row">{{ t('management.noDeployableMaps') }}</p></div>
      </template>
      <template v-else><p class="import-hint">{{ t('management.selectFloorHint') }}</p><div class="picker-list"><button v-for="floor in selectedMapDetail?.metadata.floors ?? []" :key="floor.id" type="button" :class="{ selected: selectedFloorId === floor.id }" @click="selectedFloorId = floor.id"><span><strong>{{ floor.name }}</strong><small>{{ floor.description || floor.id }}</small></span><span>›</span></button></div></template>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer><button v-if="wizardStep === 2" type="button" @click="wizardStep = 1">{{ t('common.previous') }}</button><button type="button" @click="closeWizard">{{ t('common.cancel') }}</button><button class="primary" type="button" :disabled="mapsLoading" @click="nextWizardStep">{{ mapsLoading ? t('management.loading') : t('common.next') }}</button></template>
    </BaseModal>

    <BaseModal :open="deleteTarget !== null" :title="t('management.confirmDelete')" :eyebrow="t('management.dangerousAction')" :theme-mode="themeMode" @close="deleteTarget = null"><p>{{ t('management.confirmDeleteBeacon', { id: deleteTarget?.beaconId }) }}</p><template #footer><button type="button" @click="deleteTarget = null">{{ t('common.cancel') }}</button><button class="danger" type="button" :disabled="saving" @click="remove">{{ t('management.confirmDeleteAction') }}</button></template></BaseModal>
    <BaseModal :open="importOpen" :title="t('management.importBeacons')" :eyebrow="t('management.csvFile')" :theme-mode="themeMode" @close="importOpen = false"><p class="import-hint">{{ t('management.beaconImportHint') }}</p><input ref="fileInput" type="file" accept=".csv,text/csv" @change="importCsv" /><p v-if="formError" class="form-error">{{ formError }}</p></BaseModal>
    <BaseModal :open="exportOpen" :title="t('management.exportBeacons')" :eyebrow="t('management.csvFile')" :theme-mode="themeMode" @close="exportOpen = false"><div class="export-options"><label><input v-model="exportAll" type="radio" :value="true" /> {{ t('management.exportAll') }}</label><label><input v-model="exportAll" type="radio" :value="false" /> {{ t('management.exportFirst') }} <input v-model.number="exportCount" type="number" min="1" :max="total || 1" /> {{ t('management.recordsUnit') }}</label></div><template #footer><button type="button" @click="exportOpen = false">{{ t('common.cancel') }}</button><button class="primary" type="button" @click="exportCsv">{{ t('common.batchExport') }}</button></template></BaseModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/BaseModal.vue';
import BeaconDeploymentScene from '@/components/BeaconDeploymentScene.vue';
import { createBeacon, deleteBeacon, deployBeacon, fetchBeacons, updateBeacon, type BeaconVO } from '@/services/adminApi';
import { fetchModelDetail, fetchModelList, mapDetailToSavedMap, type MapModelDetail } from '@/services/mapApi';
import type { MapFloorItem, SavedMap } from '@/services/mapLibrary';
import { assertBattery, downloadCsv, parseCsv, readCsvValue } from '@/services/csvTransfer';
import '@/styles/management.css';

defineProps<{ themeMode: 'dark' | 'light' }>();
const { t } = useI18n(); const axes = ['x', 'y', 'z'] as const; type Axis = typeof axes[number];
const beacons = ref<BeaconVO[]>([]); const total = ref(0); const loading = ref(false); const saving = ref(false); const feedback = ref('');
const keyword = ref(''); const statusFilter = ref(''); const editorOpen = ref(false); const editingId = ref(''); const deleteTarget = ref<BeaconVO | null>(null);
const importOpen = ref(false); const exportOpen = ref(false); const exportAll = ref(true); const exportCount = ref(10); const fileInput = ref<HTMLInputElement>(); const formError = ref('');
const form = reactive({ beaconId: '', battery: 80, status: 'offline' });
const wizardOpen = ref(false); const wizardStep = ref(1); const availableMaps = ref<SavedMap[]>([]); const mapsLoading = ref(false); const selectedMapId = ref(''); const selectedFloorId = ref(''); const selectedMapDetail = ref<SavedMap | null>(null);
const deploymentOpen = ref(false); const deploymentBeacon = ref<BeaconVO | null>(null); const deploymentMap = ref<SavedMap | null>(null); const deploymentFloor = ref<MapFloorItem | null>(null); const deploymentPosition = reactive({ x: 0, y: 0, z: 0 });
let nudgeDelay = 0; let nudgeInterval = 0;
const editingBeacon = computed(() => beacons.value.find((item) => item.beaconId === editingId.value) ?? null);
const floorBeacons = computed(() => beacons.value.filter((item) => item.buildingId === deploymentMap.value?.id && item.floorId === deploymentFloor.value?.id));
function deploymentStatusLabel(beacon: BeaconVO) { return beacon.deploymentStatus === 'deployed' ? t('management.deployed') : t('management.undeployed'); }
function formatCoordinate(beacon: BeaconVO) { return `(${beacon.x}, ${beacon.y}, ${beacon.z})`; }
function formatLocation(beacon: BeaconVO) { return beacon.deploymentStatus === 'deployed' ? `${beacon.buildingName || beacon.buildingId} / ${beacon.floorName || beacon.floorId}` : '—'; }
async function load() { loading.value = true; try { const page = await fetchBeacons({ page: 1, pageSize: 10000, keyword: keyword.value || undefined, status: statusFilter.value || undefined }); beacons.value = page.records; total.value = page.total; } catch (error) { feedback.value = error instanceof Error ? error.message : t('management.loadBeaconsFailed'); } finally { loading.value = false; } }
function resetFilters() { keyword.value = ''; statusFilter.value = ''; void load(); }
function openEditor(beacon?: BeaconVO) { editingId.value = beacon?.beaconId ?? ''; form.beaconId = beacon?.beaconId ?? ''; form.battery = beacon?.battery ?? 80; form.status = beacon?.status ?? 'offline'; formError.value = ''; editorOpen.value = true; }
function closeEditor() { if (!saving.value) editorOpen.value = false; }
function getPayload() { if (!form.beaconId) throw new Error(t('management.beaconIdRequired')); if (form.status.length > 10) throw new Error(t('management.statusTooLong')); return { beaconId: form.beaconId, x: editingBeacon.value?.x ?? 0, y: editingBeacon.value?.y ?? 0, z: editingBeacon.value?.z ?? 0, battery: assertBattery(form.battery, t('management.batteryInvalid')), status: form.status || 'offline' }; }
async function save() { formError.value = ''; try { const payload = getPayload(); if (!editingId.value && beacons.value.some((item) => item.beaconId.toLowerCase() === payload.beaconId.toLowerCase())) throw new Error(t('management.beaconIdExists')); saving.value = true; if (editingId.value) await updateBeacon(editingId.value, payload); else await createBeacon(payload); editorOpen.value = false; feedback.value = editingId.value ? t('management.beaconUpdated') : t('management.beaconAdded'); if (!editingId.value) { keyword.value = ''; statusFilter.value = ''; } await load(); } catch (error) { formError.value = error instanceof Error ? error.message : t('management.saveFailed'); } finally { saving.value = false; } }

async function beginDeployment(beacon: BeaconVO) { editorOpen.value = false; deploymentBeacon.value = beacon; formError.value = ''; if (beacon.deploymentStatus === 'deployed' && beacon.buildingId && beacon.floorId) { await openDeployment(beacon.buildingId, beacon.floorId); return; } wizardStep.value = 1; selectedMapId.value = ''; selectedFloorId.value = ''; selectedMapDetail.value = null; wizardOpen.value = true; mapsLoading.value = true; try { const models = await fetchModelList(); const details = await Promise.all(models.map((model) => fetchModelDetail(model.id).catch(() => null))); const buildings = details.filter((detail): detail is MapModelDetail => detail !== null && Array.isArray(detail.metadata?.floors) && detail.metadata.floors.length > 0).map(mapDetailToSavedMap).filter((map): map is SavedMap => map !== null); availableMaps.value = Array.from(new Map(buildings.map((map) => [map.metadata.buildingId || map.id, map])).values()); } catch (error) { formError.value = error instanceof Error ? error.message : t('management.loadMapsFailed'); } finally { mapsLoading.value = false; } }
function closeWizard() { if (!mapsLoading.value) wizardOpen.value = false; }
async function nextWizardStep() { formError.value = ''; if (wizardStep.value === 1) { if (!selectedMapId.value) { formError.value = t('management.selectBuildingRequired'); return; } const saved = availableMaps.value.find((map) => map.id === selectedMapId.value); if (!saved) { formError.value = t('management.invalidMapConfig'); return; } selectedMapDetail.value = saved; selectedFloorId.value = saved.metadata.activeFloorId || saved.metadata.floors[0]?.id || ''; wizardStep.value = 2; return; } if (!selectedFloorId.value) { formError.value = t('management.selectFloorRequired'); return; } wizardOpen.value = false; if (deploymentBeacon.value) await enterDeployment(deploymentBeacon.value, selectedMapDetail.value!, selectedFloorId.value); }
async function openDeployment(buildingId: string, floorId: string) { mapsLoading.value = true; try { const saved = mapDetailToSavedMap(await fetchModelDetail(buildingId)); if (!saved) throw new Error(t('management.invalidMapConfig')); await enterDeployment(deploymentBeacon.value!, saved, floorId); } catch (error) { feedback.value = error instanceof Error ? error.message : t('management.loadMapFailed'); } finally { mapsLoading.value = false; } }
async function enterDeployment(beacon: BeaconVO, map: SavedMap, floorId: string) { const floor = map.metadata.floors.find((item) => item.id === floorId); if (!floor) { feedback.value = t('management.boundFloorMissing'); return; } const all = await fetchBeacons({ page: 1, pageSize: 10000 }); beacons.value = all.records; total.value = all.total; deploymentMap.value = map; deploymentFloor.value = floor; deploymentBeacon.value = all.records.find((item) => item.beaconId === beacon.beaconId) ?? beacon; deploymentPosition.x = beacon.x || 0; deploymentPosition.y = beacon.y || 0; deploymentPosition.z = beacon.z || 0; deploymentOpen.value = true; feedback.value = ''; }
function closeDeployment() { stopNudge(); deploymentOpen.value = false; deploymentMap.value = null; deploymentFloor.value = null; void load(); }
function setDeploymentPosition(position: { x: number; y: number; z: number }) { deploymentPosition.x = roundCoordinate(position.x); deploymentPosition.y = roundCoordinate(position.y); deploymentPosition.z = roundCoordinate(position.z); }
function setAxis(axis: Axis, event: Event) { const value = Number((event.target as HTMLInputElement).value); if (Number.isFinite(value)) deploymentPosition[axis] = value; }
function roundCoordinate(value: number) { return Math.round(value * 1000) / 1000; }
function nudge(axis: Axis, direction: number) { deploymentPosition[axis] = roundCoordinate(deploymentPosition[axis] + direction * 0.1); }
function startNudge(axis: Axis, direction: number) { stopNudge(); nudge(axis, direction); nudgeDelay = window.setTimeout(() => { nudgeInterval = window.setInterval(() => nudge(axis, direction), 80); }, 350); }
function stopNudge() { window.clearTimeout(nudgeDelay); window.clearInterval(nudgeInterval); nudgeDelay = 0; nudgeInterval = 0; }
async function completeDeployment() { if (!deploymentBeacon.value || !deploymentMap.value || !deploymentFloor.value) return; saving.value = true; try { await deployBeacon(deploymentBeacon.value.beaconId, { buildingId: deploymentMap.value.metadata.buildingId || deploymentMap.value.id, floorId: deploymentFloor.value.id, ...deploymentPosition }); feedback.value = t('management.deploymentSaved'); deploymentOpen.value = false; deploymentMap.value = null; deploymentFloor.value = null; await load(); } catch (error) { feedback.value = error instanceof Error ? error.message : t('management.deploymentSaveFailed'); } finally { saving.value = false; } }

async function remove() { if (!deleteTarget.value) return; saving.value = true; try { await deleteBeacon(deleteTarget.value.beaconId); deleteTarget.value = null; feedback.value = t('management.beaconDeleted'); await load(); } catch (error) { feedback.value = error instanceof Error ? error.message : t('management.deleteFailed'); } finally { saving.value = false; } }
function openImport() { formError.value = ''; importOpen.value = true; if (fileInput.value) fileInput.value.value = ''; }
async function importCsv(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; formError.value = ''; try { const rows = parseCsv(await file.text()); if (!rows.length) throw new Error(t('management.emptyCsv')); const seen = new Set<string>(); const payloads = rows.map((row, index) => { const beaconId = readCsvValue(row, '信标编号', '设备编号', 'Beacon ID', 'Device ID', 'beaconId', 'MAC地址', 'MAC Address', 'mac'); if (!beaconId) throw new Error(t('management.rowBeaconIdRequired', { row: index + 2 })); if (seen.has(beaconId.toLowerCase())) throw new Error(t('management.rowBeaconDuplicate', { row: index + 2 })); seen.add(beaconId.toLowerCase()); const status = readCsvValue(row, '状态', 'Status', 'status') || 'offline'; if (status.length > 10) throw new Error(t('management.rowStatusTooLong', { row: index + 2 })); return { beaconId, x: 0, y: 0, z: 0, battery: assertBattery(readCsvValue(row, '电量', 'Battery', 'battery') || 80, t('management.batteryInvalid')), status }; }); await Promise.all(payloads.map(createBeacon)); importOpen.value = false; feedback.value = t('management.importedBeacons', { count: payloads.length }); keyword.value = ''; statusFilter.value = ''; await load(); } catch (error) { formError.value = error instanceof Error ? error.message : t('management.importFailed'); } }
async function exportCsv() { try { const limit = exportAll.value ? Math.max(total.value, 1) : Math.max(1, exportCount.value); const rows = (await fetchBeacons({ page: 1, pageSize: limit })).records.slice(0, limit); downloadCsv(t('management.beaconCsvFilename'), [t('management.beaconId'), t('management.xCoordinate'), t('management.yCoordinate'), t('management.zCoordinate'), t('management.battery'), t('management.status'), t('management.deploymentStatus'), t('management.building'), t('management.floor')], rows.map((item) => [item.beaconId, item.x, item.y, item.z, item.battery, item.status, deploymentStatusLabel(item), item.buildingName || '', item.floorName || ''])); exportOpen.value = false; } catch (error) { feedback.value = error instanceof Error ? error.message : t('management.exportFailed'); } }
onMounted(() => { window.addEventListener('pointerup', stopNudge); void load(); }); onBeforeUnmount(() => { window.removeEventListener('pointerup', stopNudge); stopNudge(); });
</script>

<style scoped>
.beacon-deployment-page { width: min(1680px, calc(100% - 24px)); }
.back-button { margin-bottom: 10px; }
.deployment-workspace { position: relative; width: 100%; height: clamp(420px, calc(100vh - 330px), 760px); min-height: 0; overflow: hidden; border: 1px solid rgba(78, 101, 140, .18); border-radius: 10px; }
.coordinate-hud { position: absolute; z-index: 5; left: 16px; bottom: 16px; display: grid; width: 285px; gap: 8px; padding: 13px; border: 1px solid rgba(148, 163, 184, .28); border-radius: 9px; background: rgba(15, 23, 42, .88); color: #fff; backdrop-filter: blur(8px); }
.coordinate-control { display: grid; grid-template-columns: 22px 32px 1fr 32px; align-items: center; gap: 6px; }.coordinate-control input { width: 100%; min-width: 0; height: 32px; box-sizing: border-box; }.coordinate-control button { min-height: 32px; padding: 0; }
.deployment-complete { position: absolute; z-index: 5; right: 16px; bottom: 16px; min-height: 42px !important; padding: 0 22px !important; }
.picker-list button.selected { border-color: #2f6fff; background: rgba(47, 111, 255, .12); }.picker-list button span:first-child { display: grid; gap: 4px; }.picker-list button small { color: #718096; }
.status-chip.deployed { background: rgba(16, 185, 129, .12); color: #059669; }.status-chip.undeployed { background: rgba(100, 116, 139, .12); color: #64748b; }
</style>
