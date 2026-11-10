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
  const chapterStatus = $('#chapter-status')

  const phone = matchMedia('(max-width: 759px)')
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const wait = ms => new Promise(r => setTimeout(r, ms))

  const state = { view: 'desktop', guide: false, chapter: 0, full: false, guideBeforeFull: false }
  let chapterJump = 0

  const finder = () => {
    const page = frame.contentDocument
    return page?.querySelector('#root') ? frame.contentWindow : null
  }

  const targets = chapters.map(({ dataset }) => `[aria-labelledby="${dataset.target}-heading"]`)

  function sectionAtReadingLine() {
    const page = finder()?.document
    if (!page) return null
    const chapter = targets.findIndex(selector => $(selector, page))
    const el = $(targets[chapter] || '.intro', page)
    return el ? { el, chapter: Math.max(0, chapter), r: el.getBoundingClientRect() } : null
  }

  // Remember where the visitor is, as a position within a section, so it survives a reflow.
  function captureAnchor() {
    const w = finder(); if (!w) return null
    if (w.scrollY < 4) return { top: true }
    const s = sectionAtReadingLine(); if (!s) return { y: w.scrollY }
    return { el: s.el, ratio: (0 - s.r.top) / Math.max(1, s.r.height) }
  }
  function restoreAnchor(a) {
    const w = finder(); if (!w || !a) return
    if (a.top) return w.scrollTo(0, 0)
    if (a.el && a.el.isConnected) {
      const r = a.el.getBoundingClientRect()
      return w.scrollTo(0, w.scrollY + r.top + a.ratio * r.height)
    }
    if (typeof a.y === 'number') w.scrollTo(0, a.y)
  }

  function waitFor(page, selector) {
    const existing = $(selector, page)
    if (existing) return Promise.resolve(existing)
    return new Promise(resolve => {
      const finish = element => {
        observer.disconnect()
        clearTimeout(timer)
        resolve(element)
      }
      const observer = new MutationObserver(() => {
        const element = $(selector, page)
        if (element) finish(element)
      })
      const timer = setTimeout(() => finish(null), 1800)
      observer.observe(page.body, { childList: true, subtree: true })
    })
  }

  async function scrollToChapter(chapter) {
    const jump = ++chapterJump
    const browser = finder()
    if (!browser) return
    const page = browser.document
    const target = targets[chapter]
    const stepList = '.rail__steps'
    if (!await waitFor(page, `${stepList}, .intro__actions .btn`) || jump !== chapterJump) return
    if (!$(target, page)) {
      if ($('dialog[open]', page)) {
        chapterStatus.textContent = 'Close the results dialog to jump to another chapter.'
        return
      }
      const begin = $('.intro__actions .btn', page)
      if (begin) {
        begin.click()
        if (!await waitFor(page, stepList) || jump !== chapterJump) return
      }
      const step = $$('.rail__step', page)[chapter]
      if (!step || step.disabled) {
        chapterStatus.textContent = 'Continue through the earlier questions to reach this part of the finder.'
        return
      }
      if (step.getAttribute('aria-current') !== 'step') step.click()
    }
    const section = await waitFor(page, target)
    if (!section || jump !== chapterJump) return
    await nextFrame()
    if (jump === chapterJump) browser.scrollTo({ top: 0, behavior: reduced() ? 'instant' : 'smooth' })
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
    chapterStatus.textContent = ''
    if (scroll) scrollToChapter(i)
    if (focus) $('h3', chapters[i]).focus({ preventScroll: true })
    writeUrl()
  }

  async function setGuide(on, { chapter, scroll = false, focus = true } = {}) {
    if (on === state.guide) { if (on && chapter != null) showChapter(chapter, { scroll }); return }
    const anchor = captureAnchor()
    state.guide = on
    if (!on) {
      chapterJump++
      chapterStatus.textContent = ''
    }
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

  function hookPageKeys() {
    const w = finder(); if (!w) return
    w.document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !state.full || canFull) return
      if (w.document.querySelector('dialog[open]')) return
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
