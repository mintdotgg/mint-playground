import '../styles.css'
import directory from '../shared/generated/directory.json' with { type: 'json' }
import type { AtlasFacility, DirectoryManifest } from '../shared/types.js'
import { CourtScene } from './scene.js'

type Filters = {
  query: string
  neighborhood: string
  reservable: boolean
  lights: boolean
  restrooms: boolean
  walkup: boolean
}

const manifest = directory as DirectoryManifest
const facilities: AtlasFacility[] = manifest.facilities.map((facility) => ({
  ...facility,
  accessStatus: facility.reservableCourts > 0 ? 'reservable' : 'walk-up-only',
}))

const state: {
  selectedId: string | null
  view: 'map' | 'list'
  filters: Filters
} = {
  selectedId: facilities[0]?.id ?? null,
  view: 'map',
  filters: { query: '', neighborhood: '', reservable: false, lights: false, restrooms: false, walkup: false },
}

const $ = <T extends Element>(selector: string) => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing ${selector}`)
  return element
}

const app = $('#app')
const canvas = $('#world') as HTMLCanvasElement
const results = $('#court-results')
const detail = $('#detail-content')
const resultCount = $('#result-count')
const mapCaption = $('#map-caption')
const mapButton = $('#map-view') as HTMLButtonElement
const listButton = $('#list-view') as HTMLButtonElement
const searchInput = $('#court-search') as HTMLInputElement
const neighborhoodSelect = $('#neighborhood-filter') as HTMLSelectElement

let scene: CourtScene | null = null

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function formatDate(iso: string | null) {
  if (!iso) return 'Not published'
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }).format(new Date(iso))
}

function accessLabel(facility: AtlasFacility) {
  if (facility.reservableCourts > 0 && facility.walkUpCourts > 0) {
    return `${facility.reservableCourts} reservable · ${facility.walkUpCourts} walk-up`
  }
  if (facility.reservableCourts > 0) {
    return `${facility.reservableCourts} reservable court${facility.reservableCourts === 1 ? '' : 's'}`
  }
  return `${facility.walkUpCourts} walk-up court${facility.walkUpCourts === 1 ? '' : 's'}`
}

function filteredFacilities() {
  const query = state.filters.query.trim().toLowerCase()
  return facilities.filter((facility) => {
    const matchesQuery = !query || facility.name.toLowerCase().includes(query) || facility.neighborhood.toLowerCase().includes(query) || facility.zipCode.includes(query)
    return matchesQuery &&
      (!state.filters.neighborhood || facility.neighborhood === state.filters.neighborhood) &&
      (!state.filters.reservable || facility.reservableCourts > 0) &&
      (!state.filters.lights || facility.lights) &&
      (!state.filters.restrooms || facility.restrooms) &&
      (!state.filters.walkup || facility.walkUpCourts > 0)
  })
}

function renderResults() {
  const visible = filteredFacilities()
  const visibleIds = new Set(visible.map((facility) => facility.id))
  if (state.selectedId && !visibleIds.has(state.selectedId)) {
    state.selectedId = visible[0]?.id ?? null
    scene?.select(state.selectedId, false)
  }
  resultCount.textContent = `${visible.length} of ${facilities.length} facilities`
  results.innerHTML = visible.length
    ? visible.map((facility, index) => `
      <button class="court-card ${facility.id === state.selectedId ? 'selected' : ''}" type="button" data-facility-id="${facility.id}" aria-pressed="${facility.id === state.selectedId}">
        <span class="court-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="court-card-main"><strong>${escapeHtml(facility.name)}</strong><span>${escapeHtml(facility.neighborhood)} · ${facility.totalCourts} court${facility.totalCourts === 1 ? '' : 's'}</span></span>
        <span class="court-card-status ${facility.accessStatus}"><i aria-hidden="true"></i>${escapeHtml(accessLabel(facility))}</span>
      </button>`).join('')
    : '<div class="empty-results"><span>00</span><strong>No matching courts</strong><p>Clear a filter or try a different search.</p></div>'
  results.querySelectorAll<HTMLButtonElement>('[data-facility-id]').forEach((button) => {
    button.addEventListener('click', () => selectFacility(button.dataset.facilityId ?? null))
  })
  scene?.setVisible(visibleIds)
}

function renderDetails() {
  const facility = facilities.find((item) => item.id === state.selectedId)
  if (!facility) {
    detail.innerHTML = '<p class="eyebrow">COURT DIRECTORY</p><h1>Select a court</h1><p>Choose a map signal or court in the list to inspect amenities and official sources.</p>'
    mapCaption.innerHTML = '<span class="eyebrow">SELECTED SIGNAL</span><strong>San Francisco</strong>'
    return
  }
  const coordinateLabel = facility.coordinate.accuracyLevel === 'official-court-geometry' ? 'Official DataSF court geometry' : 'Official facility-page point'
  const accuracyLabel = facility.coordinate.horizontalAccuracyMeters === null ? 'No numeric accuracy published' : `±${facility.coordinate.horizontalAccuracyMeters} m`
  const childCourts = facility.childCourts.length
    ? `<div class="child-courts"><p class="eyebrow">OFFICIAL COURT RECORDS</p><ul>${facility.childCourts.map((court) => `<li><span>${escapeHtml(court.label)}</span><small>${escapeHtml(court.provider.toUpperCase())}</small></li>`).join('')}</ul></div>`
    : '<div class="availability-note quiet"><strong>Individual court records are not published</strong><p>Use the official facility or booking page for the latest court-level information.</p></div>'

  detail.innerHTML = `
    <div class="detail-kicker"><span class="status-line ${facility.accessStatus}"><i></i>${escapeHtml(accessLabel(facility))}</span><span>${facility.zipCode}</span></div>
    <p class="eyebrow">${escapeHtml(facility.neighborhood)} / DIRECTORY SNAPSHOT</p>
    <h1>${escapeHtml(facility.name)}</h1>
    <div class="court-stat-grid">
      <span><small>Total</small><strong>${facility.totalCourts}</strong></span>
      <span><small>Reservable</small><strong>${facility.reservableCourts}</strong></span>
      <span><small>Walk-up</small><strong>${facility.walkUpCourts}</strong></span>
    </div>
    <div class="amenities" aria-label="Amenities">
      <span class="${facility.lights ? 'yes' : 'no'}">${facility.lights ? '✓' : '—'} Lights</span>
      <span class="${facility.restrooms ? 'yes' : 'no'}">${facility.restrooms ? '✓' : '—'} Restrooms</span>
    </div>
    <div class="availability-note quiet"><strong>Availability is not tracked here</strong><p>Check the official reservation page before traveling.</p></div>
    ${childCourts}
    <dl class="coordinate-audit">
      <div><dt>Position</dt><dd>${facility.latitude.toFixed(6)}, ${facility.longitude.toFixed(6)}</dd></div>
      <div><dt>Source</dt><dd><a href="${escapeHtml(facility.coordinate.sourceUrl)}" target="_blank" rel="noreferrer">${coordinateLabel} ↗</a></dd></div>
      <div><dt>Accuracy</dt><dd>${accuracyLabel}</dd></div>
      <div><dt>Verified</dt><dd>${formatDate(facility.coordinate.verifiedAt)}</dd></div>
    </dl>
    <div class="official-links">
      <a href="${escapeHtml(facility.facilityPageUrl)}" target="_blank" rel="noreferrer">Facility details ↗</a>
      ${facility.bookingUrl ? `<a href="${escapeHtml(facility.bookingUrl)}" target="_blank" rel="noreferrer">Official booking page ↗</a>` : ''}
    </div>`
  mapCaption.innerHTML = `<span class="eyebrow">SELECTED SIGNAL</span><strong>${escapeHtml(facility.name)}</strong>`
}

function selectFacility(facilityId: string | null) {
  state.selectedId = facilityId
  scene?.select(facilityId)
  renderResults()
  renderDetails()
}

function setView(view: 'map' | 'list') {
  state.view = view
  app.setAttribute('data-view', view)
  mapButton.setAttribute('aria-pressed', String(view === 'map'))
  listButton.setAttribute('aria-pressed', String(view === 'list'))
  if (view === 'map') requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
}

function bindControls() {
  $('.skip-link').addEventListener('click', () => setView('list'))
  searchInput.addEventListener('input', () => { state.filters.query = searchInput.value; renderResults() })
  neighborhoodSelect.addEventListener('change', () => { state.filters.neighborhood = neighborhoodSelect.value; renderResults() })
  const checks: Array<[string, keyof Filters]> = [
    ['#reservable-filter', 'reservable'], ['#lights-filter', 'lights'], ['#restrooms-filter', 'restrooms'], ['#walkup-filter', 'walkup'],
  ]
  checks.forEach(([selector, key]) => {
    const input = $(selector) as HTMLInputElement
    input.addEventListener('change', () => { state.filters[key] = input.checked as never; renderResults() })
  })
  mapButton.addEventListener('click', () => setView('map'))
  listButton.addEventListener('click', () => setView('list'))
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.focus() }
  })
}

function boot() {
  bindControls()
  const neighborhoods = [...new Set(facilities.map((item) => item.neighborhood))].sort()
  neighborhoodSelect.insertAdjacentHTML('beforeend', neighborhoods.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join(''))
  scene = new CourtScene(canvas, manifest)
  scene.setFacilities(facilities)
  scene.onSelect(selectFacility)
  scene.select(state.selectedId, false)
  $('#today-label').textContent = `Snapshot ${formatDate(manifest.generatedAt)} · ${manifest.totals.courts} courts`
  renderResults()
  renderDetails()
}

try {
  boot()
} catch (error) {
  const status = $('#global-status')
  status.className = 'global-status error'
  status.textContent = error instanceof Error ? error.message : 'SF Tennis Atlas could not start.'
}
