<template>
  <section :class="['map-import-view', `map-import-view--${themeMode}`]">
    <header class="map-import-heading">
      <div>
        <span>OpenStreetMap</span>
        <h2>{{ t('mapImport.title') }}</h2>
        <p>{{ t('mapImport.description') }}</p>
      </div>
      <button type="button" class="map-import-back" @click="goToModelList">
        <ArrowLeftOutlined />
        <span>{{ t('mapImport.backToModels') }}</span>
      </button>
    </header>

    <div class="map-import-stage">
      <div ref="mapContainer" class="map-import-canvas" aria-label="OpenStreetMap 建筑地图" />

      <div ref="searchPanel" class="map-import-search">
        <form @submit.prevent="submitSearch">
          <SearchOutlined />
          <input
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            :placeholder="t('mapImport.searchPlaceholder')"
            @input="onSearchInput"
            @keydown.esc="searchResults = []"
          />
          <button type="submit" :aria-label="t('common.search')"><SearchOutlined /></button>
        </form>
        <ul v-if="searchResults.length || searchLoading || searchError" class="map-import-results">
          <li v-if="searchLoading" class="map-import-result-note">{{ t('mapImport.searching') }}</li>
          <li v-else-if="searchError" class="map-import-result-note">{{ searchError }}</li>
          <li v-else-if="searchResults.length === 0" class="map-import-result-note">{{ t('mapImport.searchEmpty') }}</li>
          <li v-for="result in searchResults" v-else :key="result.place_id">
            <button type="button" @click="selectSearchResult(result)">
              <strong>{{ result.name || result.display_name }}</strong>
              <small>{{ result.display_name }}</small>
            </button>
          </li>
        </ul>
      </div>

      <aside v-if="selectedFeature" class="map-import-selection">
        <div class="map-import-selection-heading">
          <div>
            <span>{{ t('mapImport.selectedBuilding') }}</span>
            <h3>{{ selectedName }}</h3>
          </div>
          <button type="button" :title="t('common.close')" @click="clearSelection">×</button>
        </div>
        <dl>
          <div><dt>{{ t('mapImport.source') }}</dt><dd>OpenStreetMap</dd></div>
          <div v-if="selectedHeight"><dt>{{ t('mapImport.height') }}</dt><dd>{{ selectedHeight }} m</dd></div>
          <div v-if="selectedLevels"><dt>{{ t('mapImport.levels') }}</dt><dd>{{ selectedLevels }}</dd></div>
          <div><dt>{{ t('mapImport.vertices') }}</dt><dd>{{ selectedVertexCount }}</dd></div>
        </dl>
        <p class="map-import-hint">{{ t('mapImport.createHint') }}</p>
        <button class="map-import-create" type="button" :disabled="creating" @click="createEditableMap">
          <PlusOutlined v-if="!creating" />
          <span>{{ creating ? t('mapImport.creating') : t('mapImport.createModel') }}</span>
        </button>
      </aside>

      <div class="map-import-status" role="status" aria-live="polite">
        <EnvironmentOutlined />
        <span>{{ status }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftOutlined, EnvironmentOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { authFetch } from '@/services/http';
import { createBlankSceneConfig, createLocalDraftMap, getMapLibrary, saveMapLibrary } from '@/services/mapLibrary';

type BuildingFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;
type SearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  osm_type?: string;
  osm_id?: number;
  type?: string;
};

const props = defineProps<{ themeMode: 'light' | 'dark' }>();
const { t, locale } = useI18n();
const mapContainer = ref<HTMLDivElement | null>(null);
const searchPanel = ref<HTMLDivElement | null>(null);
const searchQuery = ref('');
const searchResults = ref<SearchResult[]>([]);
const searchLoading = ref(false);
const searchError = ref('');
const selectedFeature = ref<BuildingFeature | null>(null);
const creating = ref(false);
const status = ref(t('mapImport.clickBuilding'));
const selectedName = computed(() => String(selectedFeature.value?.properties?.name || t('mapImport.unnamed')));
const selectedHeight = computed(() => Number(selectedFeature.value?.properties?.model_height) || 0);
const selectedLevels = computed(() => String(selectedFeature.value?.properties?.['building:levels'] || ''));
const selectedVertexCount = computed(() => {
  const feature = selectedFeature.value;
  if (!feature) return 0;
  return exteriorRings(feature).reduce((count, ring) => count + ring.length, 0);
});

let mapInstance: MapLibreMap | null = null;
let searchTimer = 0;
let searchAbort: AbortController | null = null;
let buildingAbort: AbortController | null = null;

onMounted(() => {
  if (!mapContainer.value) return;
  mapInstance = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [120.73, 31.27],
    zoom: 16,
    pitch: 55,
    bearing: -20,
  });
  mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
  mapInstance.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserLocation: true,
    showAccuracyCircle: false,
  }), 'top-right');
  mapInstance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  mapInstance.on('load', () => {
    if (!mapInstance) return;
    mapInstance.addSource('building-highlight', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    mapInstance.addLayer({
      id: 'building-highlight-extrusion',
      type: 'fill-extrusion',
      source: 'building-highlight',
      paint: {
        'fill-extrusion-color': '#f06445',
        'fill-extrusion-height': 10,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.62,
      },
    });
    mapInstance.addLayer({
      id: 'building-highlight-line',
      type: 'line',
      source: 'building-highlight',
      paint: { 'line-color': '#db452d', 'line-width': 3, 'line-opacity': 0.95 },
    });
    mapInstance.on('click', onMapClick);
  });
});

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
  searchAbort?.abort();
  buildingAbort?.abort();
  mapInstance?.remove();
  mapInstance = null;
});

function goToModelList() {
  const preview = new URLSearchParams(window.location.search).get('preview') === '1' ? '?preview=1' : '';
  window.location.assign(`/config/map-editor${preview}`);
}

function onSearchInput() {
  window.clearTimeout(searchTimer);
  searchError.value = '';
  const query = searchQuery.value.trim();
  if (query.length < 2) {
    searchResults.value = [];
    return;
  }
  searchTimer = window.setTimeout(() => void searchPlaces(query), 350);
}

async function submitSearch() {
  window.clearTimeout(searchTimer);
  const query = searchQuery.value.trim();
  if (query.length >= 2) await searchPlaces(query);
}

async function searchPlaces(query: string) {
  searchAbort?.abort();
  searchAbort = new AbortController();
  searchLoading.value = true;
  searchError.value = '';
  try {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', 'accept-language': locale.value });
    const response = await authFetch(`/api/map-import/search?${params}`, { signal: searchAbort.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    searchResults.value = await response.json() as SearchResult[];
    if (!searchResults.value.length) searchError.value = t('mapImport.searchEmpty');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    searchError.value = t('mapImport.searchFailed');
  } finally {
    searchLoading.value = false;
  }
}

function selectSearchResult(result: SearchResult) {
  const lng = Number(result.lon);
  const lat = Number(result.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  searchQuery.value = result.name || result.display_name;
  searchResults.value = [];
  mapInstance?.flyTo({ center: [lng, lat], zoom: result.type === 'city' ? 16 : 18, pitch: 55, bearing: -20, duration: 1100 });
  status.value = t('mapImport.clickBuilding');
}

async function onMapClick(event: MapMouseEvent) {
  if (!mapInstance) return;
  if (mapInstance.getZoom() < 15) {
    status.value = t('mapImport.zoomHint');
    return;
  }
  buildingAbort?.abort();
  buildingAbort = new AbortController();
  status.value = t('mapImport.fetchingBuilding');
  try {
    const feature = await fetchBuildingAt(event.lngLat.lng, event.lngLat.lat, buildingAbort.signal);
    if (!feature) {
      clearSelection();
      status.value = t('mapImport.buildingNotFound');
      return;
    }
    selectedFeature.value = feature;
    updateHighlight(feature);
    status.value = t('mapImport.buildingSelected');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    status.value = error instanceof Error ? error.message : t('mapImport.fetchFailed');
  }
}

async function fetchBuildingAt(lng: number, lat: number, signal: AbortSignal): Promise<BuildingFeature | null> {
  const delta = 0.001;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');
  const response = await authFetch(`/api/map-import/osm?bbox=${encodeURIComponent(bbox)}`, {
    headers: { Accept: 'application/xml' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error(t('mapImport.rateLimited'));
    if (response.status === 400) throw new Error(t('mapImport.areaTooLarge'));
    throw new Error(t('mapImport.fetchFailed'));
  }
  const document = new DOMParser().parseFromString(await response.text(), 'text/xml');
  if (document.querySelector('parsererror')) throw new Error(t('mapImport.invalidOsmResponse'));
  const nodes = new Map<string, [number, number]>();
  document.querySelectorAll('node').forEach((node) => {
    const id = node.getAttribute('id');
    const point: [number, number] = [Number(node.getAttribute('lon')), Number(node.getAttribute('lat'))];
    if (id && point.every(Number.isFinite)) nodes.set(id, point);
  });

  let closest: BuildingFeature | null = null;
  let closestScore = Infinity;
  document.querySelectorAll('way').forEach((way) => {
    const properties: Record<string, unknown> = {};
    way.querySelectorAll('tag').forEach((tag) => {
      const key = tag.getAttribute('k');
      if (key) properties[key] = tag.getAttribute('v') || '';
    });
    if (!properties.building) return;
    const ring = Array.from(way.querySelectorAll('nd'))
      .map((node) => nodes.get(node.getAttribute('ref') || ''))
      .filter((point): point is [number, number] => Boolean(point));
    if (ring.length < 3) return;
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push([...ring[0]]);
    const containsClick = pointInRing([lng, lat], ring);
    const vertexDistance = Math.min(...ring.map((point) => (point[0] - lng) ** 2 + (point[1] - lat) ** 2));
    const score = containsClick ? 0 : vertexDistance;
    if (score >= closestScore) return;
    const rawHeight = parseMeters(properties.height);
    const levels = Number.parseFloat(String(properties['building:levels'] || ''));
    properties.model_height = rawHeight || (Number.isFinite(levels) ? levels * 3 : 10);
    properties.model_base = parseMeters(properties.min_height) || 0;
    closestScore = score;
    closest = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties,
    };
  });
  return closest;
}

function pointInRing(point: [number, number], ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / ((b[1] - a[1]) || 1) + a[0]) inside = !inside;
  }
  return inside;
}

function parseMeters(value: unknown): number | null {
  if (value == null) return null;
  const match = String(value).trim().toLowerCase().match(/^([\d.]+)\s*m?$/);
  return match ? Number.parseFloat(match[1]) : null;
}

function updateHighlight(feature: BuildingFeature) {
  const source = mapInstance?.getSource('building-highlight') as GeoJSONSource | undefined;
  source?.setData({ type: 'FeatureCollection', features: [feature] });
  if (mapInstance?.getLayer('building-highlight-extrusion')) {
    mapInstance.setPaintProperty('building-highlight-extrusion', 'fill-extrusion-height', Number(feature.properties.model_height) || 10);
    mapInstance.setPaintProperty('building-highlight-extrusion', 'fill-extrusion-base', Number(feature.properties.model_base) || 0);
  }
}

function clearSelection() {
  selectedFeature.value = null;
  const source = mapInstance?.getSource('building-highlight') as GeoJSONSource | undefined;
  source?.setData({ type: 'FeatureCollection', features: [] });
}

function exteriorRings(feature: BuildingFeature): Position[][] {
  if (feature.geometry.type === 'Polygon') return feature.geometry.coordinates.slice(0, 1);
  return feature.geometry.coordinates.map((polygon) => polygon[0]).filter((ring): ring is Position[] => Boolean(ring));
}

function samePosition(a: Position, b: Position) {
  return a[0] === b[0] && a[1] === b[1];
}

async function createEditableMap() {
  if (!selectedFeature.value || creating.value) return;
  creating.value = true;
  try {
    const feature = selectedFeature.value;
    const rings = exteriorRings(feature).map((ring) => ring.map((point) => [Number(point[0]), Number(point[1])] as [number, number]));
    const coordinates = rings.flat().filter((point) => point.every(Number.isFinite));
    if (!coordinates.length) throw new Error(t('mapImport.invalidGeometry'));
    const minLng = Math.min(...coordinates.map((point) => point[0]));
    const maxLng = Math.max(...coordinates.map((point) => point[0]));
    const minLat = Math.min(...coordinates.map((point) => point[1]));
    const maxLat = Math.max(...coordinates.map((point) => point[1]));
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const metersPerLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
    const metersPerLat = 110540;
    const padding = 8;
    const project = (point: [number, number]): [number, number] => [
      (point[0] - minLng) * metersPerLon + padding,
      (maxLat - point[1]) * metersPerLat + padding,
    ];
    const name = selectedName.value;
    const config = createBlankSceneConfig(name);
    config.floor.width = Math.max(20, (maxLng - minLng) * metersPerLon + padding * 2);
    config.floor.height = Math.max(20, (maxLat - minLat) * metersPerLat + padding * 2);
    const modelHeight = Number(feature.properties.model_height) || 3;
    config.areas = rings.flatMap((sourceRing, index) => {
      const openRing = sourceRing.length > 3 && samePosition(sourceRing[0], sourceRing[sourceRing.length - 1])
        ? sourceRing.slice(0, -1)
        : sourceRing;
      const points = openRing.map(project);
      if (points.length < 3) return [];
      const groupId = crypto.randomUUID();
      const areaId = crypto.randomUUID();
      config.walls.push(...points.map((start, pointIndex) => ({
        id: crypto.randomUUID(),
        groupId,
        start,
        end: points[(pointIndex + 1) % points.length],
        thickness: 0.2,
        height: modelHeight,
        color: '#d8e0ea',
      })));
      return [{
        id: areaId,
        groupId,
        name: rings.length > 1 ? `${name} ${index + 1}` : name,
        type: 'floor',
        height: 0.12,
        color: '#d5e1ed',
        opacity: 1,
        points,
      }];
    });
    const map = createLocalDraftMap(name, 'OpenStreetMap 建筑导入', config, {
      mapOrigin: [centerLng, centerLat, 0],
      positioningOrigin: [0, 0, 0],
      mapSource: {
        type: 'osm',
        center: [centerLng, centerLat],
        geoJson: { type: 'FeatureCollection', features: [feature] },
      },
    });
    saveMapLibrary([map, ...getMapLibrary().filter((existing) => existing.id !== map.id)]);
    status.value = t('mapImport.createdLocal');
    const preview = new URLSearchParams(window.location.search).get('preview') === '1' ? '?preview=1' : '';
    window.location.assign(`/config/modeling-workbench/${encodeURIComponent(map.id)}${preview}`);
  } catch (error) {
    status.value = error instanceof Error ? error.message : t('mapImport.createFailed');
    creating.value = false;
  }
}
</script>

<style scoped>
.map-import-view { display: grid; gap: 12px; }
.map-import-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.map-import-heading > div { min-width: 0; }
.map-import-heading > div > span { color: #50718a; font-size: 12px; }
.map-import-heading h2 { margin: 3px 0; color: #18243a; font-size: 22px; }
.map-import-heading p { margin: 0; color: #6d7a8b; font-size: 13px; }
.map-import-back { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 12px; border: 1px solid #d6deea; border-radius: 6px; background: #fff; color: #334a60; font: inherit; white-space: nowrap; cursor: pointer; }
.map-import-stage { position: relative; min-height: min(74vh, 820px); height: 74vh; overflow: hidden; border: 1px solid #d6deea; border-radius: 8px; background: #dbe5ed; }
.map-import-canvas { position: absolute; inset: 0; }
.map-import-search { position: absolute; z-index: 3; top: 14px; left: 14px; width: min(380px, calc(100% - 28px)); border-radius: 8px; box-shadow: 0 8px 26px rgba(21, 34, 53, .2); }
.map-import-search form { display: grid; grid-template-columns: 20px minmax(0, 1fr) 36px; align-items: center; gap: 8px; padding: 5px 6px 5px 12px; border: 1px solid #dce3eb; border-radius: 8px; background: #fff; color: #53647a; }
.map-import-search input { width: 100%; min-width: 0; height: 38px; border: 0; outline: 0; color: #1e2b3b; font: inherit; }
.map-import-search form button { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 6px; background: #255f8c; color: #fff; cursor: pointer; }
.map-import-results { display: grid; gap: 1px; max-height: 300px; overflow: auto; margin: 5px 0 0; padding: 4px; border: 1px solid #dce3eb; border-radius: 8px; background: #fff; list-style: none; }
.map-import-results li button { display: grid; width: 100%; gap: 3px; padding: 9px 10px; border: 0; border-radius: 5px; background: transparent; color: #1e2b3b; text-align: left; cursor: pointer; }
.map-import-results li button:hover { background: #edf4f8; }
.map-import-results small { overflow: hidden; color: #758297; text-overflow: ellipsis; white-space: nowrap; }
.map-import-result-note { padding: 10px; color: #6d7a8b; font-size: 13px; }
.map-import-selection { position: absolute; z-index: 2; top: 14px; right: 14px; width: min(340px, calc(100% - 28px)); padding: 16px; border: 1px solid rgba(210, 220, 231, .9); border-radius: 8px; background: rgba(255, 255, 255, .96); box-shadow: 0 10px 30px rgba(21, 34, 53, .2); }
.map-import-selection-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.map-import-selection-heading span { color: #718096; font-size: 12px; }
.map-import-selection h3 { margin: 4px 0 0; color: #17253a; font-size: 17px; overflow-wrap: anywhere; }
.map-import-selection-heading button { flex: 0 0 auto; width: 30px; height: 30px; border: 0; border-radius: 6px; background: #eef2f6; color: #53647a; font-size: 21px; cursor: pointer; }
.map-import-selection dl { display: grid; gap: 7px; margin: 14px 0 0; }
.map-import-selection dl div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.map-import-selection dt { color: #6d7a8b; }
.map-import-selection dd { margin: 0; color: #26384d; font-weight: 650; text-align: right; overflow-wrap: anywhere; }
.map-import-hint { margin: 14px 0; color: #6d7a8b; font-size: 12px; line-height: 1.5; }
.map-import-create { display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; min-height: 40px; border: 0; border-radius: 6px; background: #255f8c; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
.map-import-create:disabled { opacity: .6; cursor: wait; }
.map-import-status { position: absolute; z-index: 2; bottom: 14px; left: 14px; display: flex; align-items: center; gap: 8px; max-width: min(560px, calc(100% - 28px)); padding: 9px 12px; border: 1px solid rgba(220, 227, 235, .85); border-radius: 6px; background: rgba(255, 255, 255, .95); color: #344b60; font-size: 13px; box-shadow: 0 5px 18px rgba(21, 34, 53, .16); }
.map-import-status span { overflow-wrap: anywhere; }
.map-import-view--dark .map-import-heading h2 { color: #f0f4fa; }
.map-import-view--dark .map-import-heading > div > span,
.map-import-view--dark .map-import-heading p { color: #aab8c8; }
.map-import-view--dark .map-import-back { border-color: #39465a; background: #172234; color: #d7e2ef; }
@media (max-width: 760px) {
  .map-import-stage { height: 70vh; min-height: 560px; }
  .map-import-selection { top: auto; right: 10px; bottom: 62px; width: min(300px, calc(100% - 20px)); padding: 12px; }
  .map-import-search { top: 10px; left: 10px; width: min(340px, calc(100% - 20px)); }
  .map-import-status { bottom: 10px; left: 10px; max-width: calc(100% - 20px); }
}
</style>
