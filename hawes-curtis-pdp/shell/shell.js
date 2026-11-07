/* Presentation shell for the Hawes & Curtis product page.
   The product page runs untouched in a same-origin window (pdp/). The shell only resizes
   that window, scrolls it to a chapter, and sits beside it. It never edits the page. */
(() => {
  const root = document.documentElement
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]

  const frame = $('#pdp-frame')
  const wrap = $('#frame-wrap')
  const guide = $('#guide')
  const guideBtn = $('#guide-btn')
  const guideLabel = $('.guide-btn-label', guideBtn)
  const fullBtn = $('#full-btn')
  const exitBtn = $('#exit-full')
  const chapters = $$('.chapter')
  const indexBtns = $$('[data-go]')
  const pips = $$('.g-pips i')
  const prevBtn = $('#g-prev')
  const nextBtn = $('#g-next')
  const viewBtns = $$('[data-view-btn]')

  const phone = matchMedia('(max-width: 759px)')
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const wait = ms => new Promise(r => setTimeout(r, ms))

  const state = { view: 'desktop', guide: false, chapter: 0, full: false, guideBeforeFull: false }

  /* ---------- Reading the product page (same origin, read-only) ---------- */
  const pdp = () => { try { return frame.contentWindow && frame.contentWindow.document.body ? frame.contentWindow : null } catch (e) { return null } }

  // Page sections in document order, and the chapter each one belongs to.
  const SECTIONS = [['.pdp', 0], ['#builder', 2], ['#fit', 1], ['#detail', 3], ['#ymal', 3]]
  const TARGETS = {
    buy: w => (w.innerWidth > 760 ? w.document.querySelector('.pdp') : w.document.querySelector('.buy')),
    fit: w => w.document.querySelector('#fit'),
    builder: w => w.document.querySelector('#builder'),
    detail: w => w.document.querySelector('#detail'),
  }

  function sectionAtReadingLine() {
    const w = pdp(); if (!w) return null
    const line = w.innerHeight * 0.35
    let found = null
    for (const [sel, chapter] of SECTIONS) {
      const el = w.document.querySelector(sel); if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.top <= line) found = { el, chapter, r }
    }
    return found
  }

  // Remember where the visitor is, as a position within a section, so it survives a reflow.
  function captureAnchor() {
    const w = pdp(); if (!w) return null
    if (w.scrollY < 4) return { top: true }
    const s = sectionAtReadingLine(); if (!s) return { y: w.scrollY }
    return { el: s.el, ratio: (0 - s.r.top) / Math.max(1, s.r.height) }
  }
  function restoreAnchor(a) {
    const w = pdp(); if (!w || !a) return
    if (a.top) return w.scrollTo(0, 0)
    if (a.el && a.el.isConnected) {
      const r = a.el.getBoundingClientRect()
      return w.scrollTo(0, w.scrollY + r.top + a.ratio * r.height)
    }
    if (typeof a.y === 'number') w.scrollTo(0, a.y)
  }

  function scrollToChapter(i) {
    const w = pdp(); if (!w) return
    const el = TARGETS[chapters[i].dataset.target](w); if (!el) return
    const top = el.getBoundingClientRect().top + w.scrollY - (w.innerWidth > 760 ? 8 : 4)
    w.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' })
  }

  /* ---------- URL state: ?view=mobile and #thinking-2 ---------- */
  function writeUrl() {
    const u = new URL(location.href)
    if (state.view === 'mobile' && !phone.matches) u.searchParams.set('view', 'mobile'); else u.searchParams.delete('view')
    u.hash = state.guide ? (state.chapter ? `thinking-${state.chapter + 1}` : 'thinking') : ''
    history.replaceState(null, '', u.pathname + u.search + u.hash)
  }

  /* ---------- Desktop / mobile width ---------- */
  async function setView(view, { instant = false } = {}) {
    if (phone.matches) view = 'desktop'
    if (view === state.view && root.dataset.view === view) return
    const anchor = captureAnchor()
    const animate = !instant && !reduced() && root.classList.contains('is-loaded')
    if (animate) { wrap.classList.add('is-switching'); await wait(170) }
    state.view = view
    root.dataset.view = view
    viewBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.viewBtn === view)))
    await nextFrame()
    restoreAnchor(anchor)
    if (animate) wrap.classList.remove('is-switching')
    writeUrl()
  }

  /* ---------- The thinking ---------- */
  function showChapter(i, { scroll = true, focus = false } = {}) {
    i = Math.max(0, Math.min(chapters.length - 1, i))
    state.chapter = i
    chapters.forEach((c, n) => { c.hidden = n !== i })
    indexBtns.forEach((b, n) => n === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'))
    pips.forEach((p, n) => p.classList.toggle('on', n === i))
    prevBtn.disabled = i === 0
    nextBtn.disabled = i === chapters.length - 1
    $('span', nextBtn).textContent = i === chapters.length - 1 ? 'End' : 'Next'
    if (scroll) scrollToChapter(i)
    if (focus) $('h3', chapters[i]).focus({ preventScroll: true })
    writeUrl()
  }

  async function setGuide(on, { chapter, scroll = false, focus = true } = {}) {
    if (on === state.guide) { if (on && chapter != null) showChapter(chapter, { scroll }); return }
    const anchor = captureAnchor()
    state.guide = on
    root.dataset.guide = on ? 'on' : 'off'
    guide.inert = !on
    guideBtn.setAttribute('aria-pressed', String(on))
    guideLabel.textContent = on ? 'Hide the thinking' : 'Show the thinking'
    if (on) {
      const start = chapter != null ? chapter : (sectionAtReadingLine()?.chapter ?? 0)
      showChapter(start, { scroll })
    }
    await nextFrame()
    if (!scroll) restoreAnchor(anchor)
    if (focus) (on ? $('#guide-title') : guideBtn).focus({ preventScroll: true })
    writeUrl()
  }

  /* ---------- Full screen ---------- */
  const canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen)
  async function enterFull() {
    if (state.full) return
    const anchor = captureAnchor()
    state.full = true
    state.guideBeforeFull = state.guide
    if (state.guide) await setGuide(false, { focus: false })
    root.classList.add('is-full')
    try {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' })
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen()
    } catch (e) { /* stays in the in-page full view */ }
    await nextFrame(); restoreAnchor(anchor)
    exitBtn.focus({ preventScroll: true })
  }
  async function leaveFull() {
    if (!state.full) return
    const anchor = captureAnchor()
    state.full = false
    root.classList.remove('is-full')
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try { await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen()) } catch (e) {}
    }
    await nextFrame(); restoreAnchor(anchor)
    if (state.guideBeforeFull) await setGuide(true, { focus: false })
    fullBtn.focus({ preventScroll: true })
  }
  const onFsChange = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement) && state.full) leaveFull() }
  document.addEventListener('fullscreenchange', onFsChange)
  document.addEventListener('webkitfullscreenchange', onFsChange)

  /* ---------- Wiring ---------- */
  viewBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.viewBtn)))
  guideBtn.addEventListener('click', () => setGuide(!state.guide))
  $('#guide-close').addEventListener('click', () => setGuide(false))
  indexBtns.forEach(b => b.addEventListener('click', () => showChapter(+b.dataset.go, { focus: true })))
  prevBtn.addEventListener('click', () => showChapter(state.chapter - 1))
  nextBtn.addEventListener('click', () => showChapter(state.chapter + 1))
  fullBtn.addEventListener('click', enterFull)
  exitBtn.addEventListener('click', leaveFull)

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.full) { e.preventDefault(); leaveFull() }
      else if (state.guide) { e.preventDefault(); setGuide(false) }
    }
    if (state.guide && guide.contains(document.activeElement) && !e.altKey && !e.metaKey && !e.ctrlKey) {
      if (e.key === 'ArrowRight') { e.preventDefault(); showChapter(state.chapter + 1, { focus: true }) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); showChapter(state.chapter - 1, { focus: true }) }
    }
  })

  phone.addEventListener('change', () => { if (phone.matches && state.view === 'mobile') setView('desktop', { instant: true }) })

  // In the in-page full view (no Fullscreen API, e.g. iPhone), Esc inside the product page also leaves it,
  // unless one of the page's own panels or dialogs is open and should take the Esc first.
  function hookPageKeys() {
    const w = pdp(); if (!w) return
    w.document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !state.full || canFull) return
      if (w.document.querySelector('dialog[open], .panel.open, .panel[aria-hidden="false"]')) return
      leaveFull()
    })
  }

  /* ---------- Start ---------- */
  const params = new URLSearchParams(location.search)
  const hash = location.hash.replace('#', '')
  setView(params.get('view') === 'mobile' ? 'mobile' : 'desktop', { instant: true })

  frame.addEventListener('load', () => {
    root.classList.add('is-loaded')
    hookPageKeys()
    const m = /^thinking(?:-(\d))?$/.exec(hash)
    if (m) setGuide(true, { chapter: m[1] ? +m[1] - 1 : 0, scroll: !!m[1], focus: false })
  })
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete' && frame.contentWindow.location.href !== 'about:blank') {
    frame.dispatchEvent(new Event('load'))
  }
})()
