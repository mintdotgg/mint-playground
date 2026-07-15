import type { PosterDef } from './posters'

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

/** Stretch the masthead so it always runs edge to edge, magazine style. */
export function fitMegaTitle() {
  const el = $('.mega-title')
  if (!el || !el.textContent) return
  el.style.transform = 'scaleX(1)'
  const w = el.scrollWidth
  const target = (window.innerWidth || document.documentElement.clientWidth || 1280) * 1.002
  if (w > 0) el.style.transform = `scaleX(${target / w})`
}

/** Rewrites the poster chrome overlay content + theme variables. */
export function skinChrome(p: PosterDef) {
  const root = document.documentElement
  root.style.setProperty('--accent', p.ui.accent)
  root.style.setProperty('--ink', p.ui.ink)
  root.style.setProperty('--paper', p.ui.paper)

  $('.mega-title').textContent = p.megaTitle
  fitMegaTitle()

  const sub = $('.mega-sub')
  sub.innerHTML = ''
  for (const frag of p.megaSub.split('|')) {
    const s = document.createElement('span')
    s.textContent = frag
    sub.appendChild(s)
  }

  $('.code-tl').textContent = p.codeTL
  $('.code-tr').textContent = p.codeTR
  $('.code-bl').textContent = p.codeBL
  $('.code-br').textContent = p.codeBR
  $('.brand-lines').textContent = p.brandLines
  $('.name-tag').textContent = p.nameTag
  $('.info-code').textContent = p.infoCode
  $('.info-tagline').textContent = p.tagline
  $('.info-serial').textContent = p.serial
  $('.big-index').textContent = p.bigIndex
  $('.ticker-inner').textContent = p.ticker.repeat(6)

  $('.edge-left').textContent = p.edgeLeft
  $('.edge-right').textContent = p.edgeRight
  $('.ghost-index').textContent = p.index
  $('.para-head').textContent = p.paragraphHead
  $('.para-body').textContent = p.paragraph
  p.strands.forEach((t, i) => {
    $(`.strand-${i + 1}`).textContent = t
  })

  const stats = $('.info-stats')
  stats.innerHTML = ''
  for (const line of p.stats) {
    const [label, value] = line.split(' — ')
    const row = document.createElement('div')
    row.className = 'stat'
    const l = document.createElement('span')
    l.textContent = label
    const d = document.createElement('span')
    d.className = 'dots'
    const v = document.createElement('span')
    v.textContent = value ?? ''
    row.append(l, d, v)
    stats.appendChild(row)
  }

  const chips = $('.chips')
  chips.innerHTML = ''
  for (const label of p.chips) {
    const el = document.createElement('div')
    el.className = 'chip'
    el.textContent = label
    chips.appendChild(el)
  }
}

export function chromeExit() {
  const chrome = $('#chrome')
  chrome.classList.remove('enter')
  chrome.classList.add('exit')
}

export function chromeEnter() {
  const chrome = $('#chrome')
  chrome.classList.remove('exit')
  chrome.classList.add('enter')
}

export interface ThumbHandles {
  setActive(i: number): void
  canvases: HTMLCanvasElement[]
}

export function buildRail(
  posters: PosterDef[],
  onPick: (i: number) => void,
  onHover: () => void
): ThumbHandles {
  const wrap = $('#thumbs')
  const canvases: HTMLCanvasElement[] = []
  const buttons: HTMLButtonElement[] = []

  posters.forEach((p, i) => {
    const btn = document.createElement('button')
    btn.className = 'thumb'
    btn.setAttribute('aria-label', `Poster ${p.index} ${p.megaTitle}`)

    const cv = document.createElement('canvas')
    cv.width = 168
    cv.height = 216
    btn.appendChild(cv)
    canvases.push(cv)

    const scan = document.createElement('div')
    scan.className = 't-scan'
    btn.appendChild(scan)

    const idx = document.createElement('div')
    idx.className = 't-index'
    idx.textContent = p.index
    btn.appendChild(idx)

    const label = document.createElement('div')
    label.className = 't-label'
    label.textContent = p.megaTitle
    btn.appendChild(label)

    btn.addEventListener('click', () => onPick(i))
    btn.addEventListener('mouseenter', onHover)
    wrap.appendChild(btn)
    buttons.push(btn)
  })

  return {
    canvases,
    setActive(i: number) {
      buttons.forEach((b, j) => b.classList.toggle('active', i === j))
    },
  }
}

export function setLoaderProgress(frac: number, log: string) {
  $('#loader-fill').style.width = `${Math.round(frac * 100)}%`
  $('#loader-log').textContent = log
}

export function hideLoader() {
  $('#loader').classList.add('done')
}

export function setAutoFill(frac: number) {
  $('#auto-fill').style.height = `${Math.round(frac * 100)}%`
}

export function bindSoundToggle(onToggle: () => boolean) {
  const btn = $('#sound-toggle')
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const on = onToggle()
    $('.snd-state').textContent = on ? 'ON' : 'OFF'
  })
}

export function reflectSoundState(on: boolean) {
  $('.snd-state').textContent = on ? 'ON' : 'OFF'
}
