/* Casa Juanito · ping de entrada, nieve marina, profundímetro ligado al scroll y sonar que descubre especies */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  const D = window.I18N;
  let LANG = 'es';
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

  /* ---------- idioma (el HTML está en español) ---------- */
  function applyLang(l) {
    LANG = l;
    document.documentElement.lang = l;
    $$('[data-i18n]').forEach((el) => {
      if (el.dataset.es === undefined) el.dataset.es = el.innerHTML;
      el.innerHTML = l === 'es' ? el.dataset.es : (D.dom[l] && D.dom[l][el.dataset.i18n]) || el.dataset.es;
    });
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    store.set('cj-lang', l);
    renderReviews();
    renderFound();
  }
  $$('.lang button').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));
  function renderReviews() {
    $('#reviews').innerHTML = D.reviews[LANG].map(([t, w]) => `<figure class="rv"><p>${LANG === 'fr' ? '« ' + t + ' »' : '«' + t + '»'}</p><cite>${w}</cite></figure>`).join('');
  }

  /* ---------- nieve marina ---------- */
  const snow = $('#snow'), sx = snow.getContext('2d');
  let SW = 0, SH = 0, vel = 0, snowOn = !REDUCE;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const flakes = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.6, s: 0.15 + Math.random() * 0.5, a: 0.15 + Math.random() * 0.45 }));
  function sizeSnow() { SW = innerWidth; SH = innerHeight; snow.width = SW * dpr; snow.height = SH * dpr; sx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function snowFrame() {
    sx.clearRect(0, 0, SW, SH);
    const depth = Math.min(1, scrollY / (document.documentElement.scrollHeight - innerHeight || 1));
    for (const f of flakes) {
      f.y += (f.s + vel * 0.02) / SH * 1.2; f.x += Math.sin(f.y * 20) * 0.0002;
      if (f.y > 1) { f.y = 0; f.x = Math.random(); }
      if (f.y < 0) { f.y = 1; }
      sx.globalAlpha = f.a * (0.4 + depth * 0.8);
      sx.fillStyle = '#d9ecf7';
      sx.beginPath(); sx.arc(f.x * SW, f.y * SH, f.r, 0, Math.PI * 2); sx.fill();
    }
    vel *= 0.92;
    if (snowOn) requestAnimationFrame(snowFrame);
  }
  if (!REDUCE) { sizeSnow(); addEventListener('resize', sizeSnow); requestAnimationFrame(snowFrame); } else snow.remove();

  /* ---------- profundímetro ---------- */
  const mark = $('#gaugeMark'), val = $('#gaugeVal');
  let lastY = scrollY;
  function updateGauge() {
    const max = document.documentElement.scrollHeight - innerHeight || 1;
    const p = Math.min(1, Math.max(0, scrollY / max));
    // la carta baja hasta el sonar (~240 m) y vuelve a la superficie al final
    const depth = Math.round(Math.sin(Math.min(1, p / 0.62) * Math.PI / 2) * 240 * (p > 0.62 ? 1 - (p - 0.62) / 0.38 : 1));
    mark.style.top = `${p * 100}%`;
    val.textContent = `${depth} m`;
    vel = scrollY - lastY; lastY = scrollY;
  }
  if (hasGsap) ScrollTrigger.create({ start: 0, end: 'max', onUpdate: updateGauge });
  else addEventListener('scroll', () => requestAnimationFrame(updateGauge), { passive: true });
  updateGauge();

  /* ---------- sonar ---------- */
  const field = $('#field');
  const found = new Set();
  const spots = [];
  function placeSpots() {
    $$('.blip', field).forEach((b) => b.remove());
    spots.length = 0;
    const cols = 4, rows = 3;
    D.species.forEach((sp, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = (c + 0.25 + Math.random() * 0.5) / cols, y = (r + 0.25 + Math.random() * 0.5) / rows;
      const el = document.createElement('div');
      el.className = 'blip';
      el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`;
      el.innerHTML = `<span class="blip__img"><img src="assets/img/${sp[0]}.jpg" alt="" loading="lazy"></span><span class="js-name"></span>`;
      field.appendChild(el);
      spots.push({ x, y, el, sp, timer: 0 });
    });
    paintNames();
  }
  function paintNames() { spots.forEach((s) => ($('.js-name', s.el).textContent = LANG === 'fr' ? s.sp[2] : s.sp[1])); }
  function renderFound() {
    paintNames();
    $('#found').innerHTML = [...found].map((i) => `<li>${LANG === 'fr' ? D.species[i][2] : D.species[i][1]}</li>`).join('');
  }
  function ping(px, py) {
    field.classList.add('is-used');
    const r = field.getBoundingClientRect();
    const ring = document.createElement('span');
    ring.className = 'sring';
    ring.style.left = `${px}px`; ring.style.top = `${py}px`;
    field.appendChild(ring);
    const reach = Math.max(r.width, r.height) * 0.32;
    if (hasGsap && !REDUCE) gsap.to(ring, { scale: (reach * 2) / 20, opacity: 0, duration: 1.6, ease: 'expo.out', onComplete: () => ring.remove() });
    else setTimeout(() => ring.remove(), 300);
    spots.forEach((s) => {
      const dx = s.x * r.width - px, dy = s.y * r.height - py;
      const d = Math.hypot(dx, dy);
      if (d > reach) return;
      const delay = (d / reach) * 0.9;
      found.add(D.species.indexOf(s.sp));
      clearTimeout(s.timer);
      if (hasGsap && !REDUCE) {
        gsap.killTweensOf(s.el);
        gsap.fromTo(s.el, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, delay, ease: 'back.out(1.8)' });
        s.timer = setTimeout(() => gsap.to(s.el, { opacity: 0, scale: 0.85, duration: 0.8, ease: 'power2.in' }), 4200 + delay * 1000);
      } else { s.el.style.opacity = '1'; s.timer = setTimeout(() => (s.el.style.opacity = '0'), 4000); }
    });
    renderFound();
  }
  field.addEventListener('pointerdown', (e) => { const r = field.getBoundingClientRect(); ping(e.clientX - r.left, e.clientY - r.top); });
  field.tabIndex = 0;
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const r = field.getBoundingClientRect(); ping(Math.random() * r.width, Math.random() * r.height); } });

  /* ---------- entrada: ping ---------- */
  function heroIn() {
    if (!hasGsap || REDUCE) return;
    gsap.timeline()
      .from('.hero__title', { yPercent: 25, opacity: 0, filter: 'blur(10px)', duration: 1.4, ease: 'expo.out' })
      .from('.hero__sub, .hero__cta', { y: 20, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, '-=1')
      .from('.hero__fig', { scale: 0.8, opacity: 0, duration: 1.4, ease: 'expo.out' }, 0.1)
      .from('.hero__fig img', { scale: 1.3, duration: 2, ease: 'expo.out' }, 0.1);
  }
  const pingEl = $('#ping');
  let seen = false;
  try { seen = sessionStorage.getItem('cj-intro') === '1'; sessionStorage.setItem('cj-intro', '1'); } catch (e) { }
  if (!hasGsap || REDUCE || seen) { pingEl.remove(); heroIn(); }
  else {
    document.body.classList.add('is-locked');
    const tl = gsap.timeline({ onComplete: () => { pingEl.remove(); document.body.classList.remove('is-locked'); } });
    tl.fromTo('.ping__ring', { scale: 1, opacity: 0.9 }, { scale: 14, opacity: 0, duration: 1.6, ease: 'expo.out', stagger: 0.28 })
      .fromTo('.ping__name', { opacity: 0, letterSpacing: '.3em' }, { opacity: 1, letterSpacing: '0em', duration: 1.2, ease: 'expo.out' }, 0.2)
      .fromTo(pingEl, { clipPath: 'circle(150% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)', duration: 1, ease: 'expo.inOut' }, '+=0.1')
      .add(heroIn, '-=0.6');
    pingEl.addEventListener('click', () => tl.progress(1));
  }

  /* ---------- scroll ---------- */
  function scrollFx() {
    if (!hasGsap || REDUCE) return;
    const nav = $('#nav');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { const y = s.scroll(); nav.classList.toggle('is-solid', y > 60); nav.classList.toggle('is-hidden', s.direction === 1 && y > 700); } });
    $$('.zone').forEach((z) => {
      gsap.from($$('.card', z), { y: 90, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: 0.15, scrollTrigger: { trigger: z, start: 'top 70%' } });
      gsap.from($('.zone__depth', z), { clipPath: 'inset(0 100% 0 0)', duration: 1.2, ease: 'expo.inOut', scrollTrigger: { trigger: z, start: 'top 80%' } });
      // los peces suben un poco más lento que el scroll: sensación de profundidad
      $$('.card img', z).forEach((img, i) => gsap.to(img, { yPercent: i % 2 ? -6 : 6, ease: 'none', scrollTrigger: { trigger: z, start: 'top bottom', end: 'bottom top', scrub: true } }));
    });
    gsap.from('.sonar__field', { clipPath: 'circle(0% at 50% 50%)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: '.sonar', start: 'top 70%', onEnter: () => setTimeout(() => { const r = field.getBoundingClientRect(); ping(r.width / 2, r.height / 2); }, 1500) } });
    gsap.from('.rice__row figure', { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.rice__row', start: 'top 80%' } });
    gsap.from('.fact', { y: 30, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.facts', start: 'top 80%' } });
    ScrollTrigger.batch('.rv', { start: 'top 92%', once: true, onEnter: (els) => gsap.from(els, { y: 30, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }) });
    gsap.from('.visit__fig', { clipPath: 'inset(100% 0 0 0 round 18px)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: '.visit', start: 'top 75%' } });
  }

  placeSpots();
  const initial = [new URLSearchParams(location.search).get('lang'), store.get('cj-lang'), (navigator.language || '').slice(0, 2)].find((l) => l === 'es' || l === 'fr') || 'es';
  applyLang(initial);
  scrollFx();
  addEventListener('load', () => hasGsap && ScrollTrigger.refresh());
})();
