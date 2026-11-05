<template>
  <section class="view active map-full">
    <article class="panel map-panel real-map-panel">
      <div ref="mapEl" class="real-map"></div>
    </article>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useModelingStore } from '../stores/modelingStore'
import { authFetch } from '@/services/http'

const emit = defineEmits(['created'])
const store = useModelingStore()
const mapEl = ref(null)

const EMPTY_FC = { type: 'FeatureCollection', features: [] }
const MAP_IMPORT_API = '/api/map-import'
const OSM_API_DIRECT = 'https://api.openstreetmap.org'
const NOMINATIM_DIRECT_URL = 'https://nominatim.openstreetmap.org/search'
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const BBOX_DELTA = 0.001

let map
let popup
let lastFeature = null

class SearchControl {
  onAdd(targetMap) {
    this._map = targetMap
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl search-ctrl'
    this._container.innerHTML = `
      <div class="search-wrap">
        <input class="search-input" type="text" placeholder="Search buildings, addresses" autocomplete="off" />
        <div class="search-spinner"></div>
        <ul class="search-results"></ul>
      </div>
    `
    this._input = this._container.querySelector('.search-input')
    this._spinner = this._container.querySelector('.search-spinner')
    this._results = this._container.querySelector('.search-results')
    this._debounceTimer = null
    this._lastQuery = ''
    this._abort = null
    this._input.addEventListener('input', () => this._onInput())
    this._input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this._closeResults()
      if (event.key === 'Enter') this._results.querySelector('li')?.click()
    })
    document.addEventListener('click', (event) => {
      if (!this._container.contains(event.target)) this._closeResults()
    })
    return this._container
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container)
    this._map = undefined
  }

  _onInput() {
    const query = this._input.value.trim()
    clearTimeout(this._debounceTimer)
    if (query.length < 2) {
      this._closeResults()
      return
    }
    this._debounceTimer = setTimeout(() => this._search(query), 350)
  }

  async _search(query) {
    if (query === this._lastQuery) return
    this._lastQuery = query
    if (this._abort) this._abort.abort()
    this._abort = new AbortController()
    this._spinner.classList.add('active')
    this._results.innerHTML = ''
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '6',
        'accept-language': 'zh-CN',
        addressdetails: '1'
      })
      const res = await fetchWithFallback(
        `${MAP_IMPORT_API}/search?${params}`,
        `${NOMINATIM_DIRECT_URL}?${params}`,
        {
        signal: this._abort.signal,
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (this._lastQuery !== query) return
      this._renderResults(data)
    } catch (error) {
      if (error.name !== 'AbortError') this._results.innerHTML = '<li class="search-empty">搜索失败</li>'
    } finally {
      this._spinner.classList.remove('active')
    }
  }

  _renderResults(data) {
    this._results.innerHTML = ''
    if (!data?.length) {
      this._results.innerHTML = '<li class="search-empty">未找到结果</li>'
      this._results.classList.add('open')
      return
    }
    data.forEach((item) => {
      const li = document.createElement('li')
      const type = item.type || '-'
      const name = item.display_name?.split(',')[0] || item.display_name || '-'
      const region = item.display_name?.split(',').slice(1, 3).join(',') || ''
      li.innerHTML = `
        <span class="result-icon ${type}"></span>
        <span class="result-name">${escHTML(name)}</span>
        <span class="result-type">${escHTML(type)}</span>
        <span class="result-region">${escHTML(region)}</span>
      `
      li.addEventListener('click', () => this._goTo(item))
      li.addEventListener('mousedown', (event) => event.preventDefault())
      this._results.appendChild(li)
    })
    this._results.classList.add('open')
  }

  _goTo(item) {
    const lng = Number.parseFloat(item.lon)
    const lat = Number.parseFloat(item.lat)
    this._closeResults()
    this._input.value = item.display_name?.split(',')[0] || item.display_name || ''
    this._input.blur()
    const zoom = ['building', 'house', 'amenity', 'shop'].includes(item.type) ? 18 : 16
    this._map.flyTo({ center: [lng, lat], zoom, pitch: 55, bearing: 0, duration: 1200 })
    if (item.osm_type === 'way' && item.osm_id && item.type === 'building') fetchAndShowBuilding({ lng, lat })
  }

  _closeResults() {
    this._results.classList.remove('open')
    this._results.innerHTML = ''
  }
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapEl.value,
    style: STYLE_URL,
    center: [120.73, 31.27],
    zoom: 16,
    pitch: 60,
    bearing: -20,
    antialias: true,
    attributionControl: true
  })
  popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '380px', offset: 16 })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
  map.addControl(new SearchControl(), 'top-left')
  map.on('load', setupMapLayers)
})

onBeforeUnmount(() => {
  popup?.remove()
  map?.remove()
})

function setupMapLayers() {
  map.addSource('building-highlight', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'building-highlight-extrusion',
    type: 'fill-extrusion',
    source: 'building-highlight',
    paint: {
      'fill-extrusion-color': '#ff4444',
      'fill-extrusion-height': ['coalesce', ['get', 'model_height'], 10],
      'fill-extrusion-base': ['coalesce', ['get', 'model_base'], 0],
      'fill-extrusion-opacity': 0.55
    }
  })
  map.addLayer({
    id: 'building-highlight-line',
    type: 'line',
    source: 'building-highlight',
    paint: { 'line-color': '#ff4444', 'line-width': 3, 'line-opacity': 0.85 }
  })
  map.on('click', async (event) => {
    if (map.getZoom() < 15) {
      showMessage(event.lngLat, '请放大地图后再选择建筑')
      return
    }
    await fetchAndShowBuilding(event.lngLat)
  })
  map.on('contextmenu', () => {
    clearHighlight()
    popup.remove()
  })
}

async function fetchAndShowBuilding(lngLat) {
  showMessage(lngLat, '正在查询 OSM 建筑...')
  try {
    const feature = await fetchOSMBuilding(lngLat.lng, lngLat.lat)
    if (!feature) {
      showMessage(lngLat, '未找到建筑')
      return
    }
    lastFeature = feature
    highlightBuilding(feature)
    showBuildingPopup(feature, lngLat)
  } catch (error) {
    showMessage(lngLat, `查询失败：${error.message}`)
  }
}

async function fetchOSMBuilding(lng, lat) {
  const bbox = `${lng - BBOX_DELTA},${lat - BBOX_DELTA},${lng + BBOX_DELTA},${lat + BBOX_DELTA}`
  const path = `/api/0.6/map?bbox=${encodeURIComponent(bbox)}`
  const res = await fetchWithFallback(
    `${MAP_IMPORT_API}/osm?bbox=${encodeURIComponent(bbox)}`,
    `${OSM_API_DIRECT}${path}`,
    {
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(20000),
    }
  )
  if (!res.ok) throw new Error(`OSM HTTP ${res.status}`)
  const xml = await res.text()
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const building = findClosestBuilding(doc, lng, lat)
  return building ? normalizeFeature(building) : null
}

async function fetchWithFallback(primaryUrl, directUrl, options = {}) {
  const primaryController = new AbortController()
  const primaryTimer = setTimeout(() => primaryController.abort(), 5000)
  const primarySignal = options.signal
    ? AbortSignal.any([options.signal, primaryController.signal])
    : primaryController.signal

  try {
    const response = await authFetch(primaryUrl, { ...options, signal: primarySignal })
    if (response.ok) return response
    if (response.status === 401 || response.status === 403) return response
  } catch (error) {
    if (options.signal?.aborted) throw error
  } finally {
    clearTimeout(primaryTimer)
  }

  return fetch(directUrl, options)
}

function findClosestBuilding(doc, lng, lat) {
  const ways = doc.querySelectorAll('way')
  let best = null
  let bestDist = Infinity
  ways.forEach((way) => {
    const tags = way.querySelectorAll('tag')
    const isBuilding = Array.from(tags).some((tag) => tag.getAttribute('k') === 'building')
    if (!isBuilding) return
    let minDist = Infinity
    way.querySelectorAll('nd').forEach((nd) => {
      const node = doc.querySelector(`node[id="${nd.getAttribute('ref')}"]`)
      if (!node) return
      const nl = Number.parseFloat(node.getAttribute('lon'))
      const na = Number.parseFloat(node.getAttribute('lat'))
      minDist = Math.min(minDist, (nl - lng) ** 2 + (na - lat) ** 2)
    })
    if (minDist < bestDist) {
      const props = {}
      tags.forEach((tag) => { props[tag.getAttribute('k')] = tag.getAttribute('v') || '' })
      best = { way, props }
      bestDist = minDist
    }
  })
  if (!best) return null
  const coords = []
  best.way.querySelectorAll('nd').forEach((nd) => {
    const node = doc.querySelector(`node[id="${nd.getAttribute('ref')}"]`)
    if (node) coords.push([Number.parseFloat(node.getAttribute('lon')), Number.parseFloat(node.getAttribute('lat'))])
  })
  if (coords.length > 2) {
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first])
  }
  if (coords.length < 3) return null
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { ...best.props } }
}

function showMessage(lngLat, text) {
  popup.setHTML(`<div class="popup-message">${escHTML(text)}</div>`).setLngLat(lngLat).addTo(map)
}

function showBuildingPopup(feature, lngLat) {
  const props = feature.properties || {}
  const vertices = feature.geometry.coordinates[0]?.length || 0
  popup.setHTML(`
    <div class="popup-content">
      <h3>${escHTML(props.name || '(Unnamed building)')}</h3>
      <table class="tag-table">
        ${props.name ? `<tr><th>Name</th><td>${escHTML(props.name)}</td></tr>` : ''}
        ${props.model_height ? `<tr><th>Height</th><td>${props.model_height} m</td></tr>` : ''}
        ${props['building:levels'] ? `<tr><th>Levels</th><td>${escHTML(props['building:levels'])}</td></tr>` : ''}
        <tr><th>Vertices</th><td>${vertices} vertices</td></tr>
        <tr><th>Source</th><td>OpenStreetMap API</td></tr>
      </table>
      <div class="popup-buttons">
        <button class="copy-btn" data-action="copy">Copy GeoJSON</button>
        <button class="copy-btn model-btn" data-action="create">Create map model</button>
      </div>
    </div>
  `).setLngLat(lngLat).addTo(map)
  setTimeout(() => {
    document.querySelector('[data-action="copy"]')?.addEventListener('click', copyGeoJSON)
    document.querySelector('[data-action="create"]')?.addEventListener('click', createMapModel)
  })
}

function copyGeoJSON(event) {
  if (!lastFeature) return
  navigator.clipboard?.writeText(JSON.stringify(lastFeature, null, 2))
  event.target.textContent = 'Copied'
  setTimeout(() => { event.target.textContent = 'Copy GeoJSON' }, 1600)
}

function createMapModel() {
  if (!lastFeature) return
  store.setActivePlan(geoJsonToPlan(lastFeature))
  emit('created')
}

function geoJsonToPlan(feature) {
  const coords = feature.geometry.coordinates[0] || []
  const clean = coords.slice(0, -1)
  const minLng = Math.min(...clean.map(([lng]) => lng))
  const maxLng = Math.max(...clean.map(([lng]) => lng))
  const minLat = Math.min(...clean.map(([, lat]) => lat))
  const maxLat = Math.max(...clean.map(([, lat]) => lat))
  const width = Math.max(maxLng - minLng, 0.000001)
  const height = Math.max(maxLat - minLat, 0.000001)
  const scale = Math.min(760 / width, 460 / height)
  return {
    buildings: [{
      id: `map-building-${Date.now()}`,
      name: feature.properties?.name || '(Unnamed building)',
      closed: true,
      outer: clean.map(([lng, lat]) => ({ x: 180 + (lng - minLng) * scale, y: 120 + (maxLat - lat) * scale }))
    }],
    walls: [],
    doors: [],
    assets: [],
    sourceGeoJson: feature
  }
}

function highlightBuilding(feature) {
  map.getSource('building-highlight')?.setData({ type: 'FeatureCollection', features: [feature] })
}

function clearHighlight() {
  map.getSource('building-highlight')?.setData(EMPTY_FC)
}

function normalizeFeature(feature) {
  const props = feature.properties || {}
  feature.properties = { ...props, model_height: getHeight(props), model_base: parseMeters(props.min_height) || 0 }
  return feature
}

function getHeight(props) {
  const height = parseMeters(props.height)
  if (height) return height
  const levels = Number.parseFloat(props['building:levels'])
  return Number.isNaN(levels) ? null : levels * 3
}

function parseMeters(value) {
  if (value == null) return null
  if (typeof value === 'number') return value
  const match = String(value).trim().toLowerCase().match(/^([\d.]+)\s*m?$/)
  return match ? Number.parseFloat(match[1]) : null
}

function escHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
</script>
