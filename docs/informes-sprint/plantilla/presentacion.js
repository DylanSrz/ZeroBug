/* Navegación e interacción de la presentación del informe de sprint.
   Sin dependencias: el HTML generado es autocontenido y funciona sin internet. */
(() => {
  const html = document.documentElement;
  const estatico = new URLSearchParams(location.search).has('static');
  if (estatico) html.classList.add('estatico');

  const slides = [...document.querySelectorAll('.slide')];
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const barra = $('#progreso');
  const contador = $('#contador');
  const btnPrev = $('#anterior');
  const btnSig = $('#siguiente');
  const capaVista = $('#vista-general');
  const capaAyuda = $('#ayuda');
  const tip = $('#tip');

  const desdeHash = () => Math.min(slides.length - 1, Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  let actual = desdeHash();

  // ── animaciones al entrar en una diapositiva ───────────────────────────
  function animarBarras(slide) {
    $$('[data-w]', slide).forEach((el) => {
      if (estatico) { el.style.width = el.dataset.w + '%'; return; }
      el.style.width = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = el.dataset.w + '%'; }));
    });
  }
  function contar(slide) {
    $$('[data-contar]', slide).forEach((el) => {
      const fin = Number(el.dataset.contar);
      if (estatico || !Number.isFinite(fin)) { el.textContent = fin.toLocaleString('es-CO'); return; }
      const t0 = performance.now();
      const dur = 900 + Math.min(fin, 200) * 2;
      const paso = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3))).toLocaleString('es-CO');
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  }

  function mostrar(n) {
    actual = Math.min(slides.length - 1, Math.max(0, n));
    slides.forEach((s, k) => {
      s.classList.toggle('activa', k === actual);
      s.classList.toggle('previa', k < actual);
      s.setAttribute('aria-hidden', k === actual ? 'false' : 'true');
    });
    const s = slides[actual];
    animarBarras(s);
    contar(s);
    barra.style.width = ((actual + 1) / slides.length) * 100 + '%';
    contador.textContent = `${actual + 1} / ${slides.length}`;
    btnPrev.disabled = actual === 0;
    btnSig.disabled = actual === slides.length - 1;
    history.replaceState(null, '', location.pathname + location.search + '#' + (actual + 1));
    $$('.miniaturas button').forEach((b, k) => b.classList.toggle('actual', k === actual));
    ocultarTip();
  }
  const ir = (n) => { if (n !== actual && n >= 0 && n < slides.length) mostrar(n); };

  // ── capas: vista general (O) y ayuda (?) ───────────────────────────────
  const miniaturas = $('.miniaturas', capaVista);
  slides.forEach((s, k) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="n">${String(k + 1).padStart(2, '0')}</span><span class="t"></span><span class="tenue"></span>`;
    b.querySelector('.t').textContent = s.dataset.titulo || `Diapositiva ${k + 1}`;
    b.querySelector('.tenue').textContent = s.dataset.seccion || '';
    b.addEventListener('click', () => { cerrarCapas(); ir(k); });
    miniaturas.appendChild(b);
  });
  const abierta = () => capaVista.classList.contains('abierta') || capaAyuda.classList.contains('abierta');
  function alternar(capa) {
    const abrir = !capa.classList.contains('abierta');
    cerrarCapas();
    if (abrir) {
      capa.classList.add('abierta');
      (capa === capaVista ? $$('.miniaturas button')[actual] : capa.querySelector('button'))?.focus();
    }
  }
  function cerrarCapas() { capaVista.classList.remove('abierta'); capaAyuda.classList.remove('abierta'); }
  $$('[data-capa]').forEach((b) => b.addEventListener('click', () => alternar($('#' + b.dataset.capa))));
  $$('.capa').forEach((c) => c.addEventListener('click', (e) => { if (e.target === c) cerrarCapas(); }));

  // ── teclado ────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') { if (abierta()) { cerrarCapas(); e.preventDefault(); } return; }
    if (k === 'o' || k === 'O' || k === 'g' || k === 'G') { alternar(capaVista); e.preventDefault(); return; }
    if (k === '?' || k === 'h' || k === 'H') { alternar(capaAyuda); e.preventDefault(); return; }
    if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen(); else html.requestFullscreen?.();
      return;
    }
    if (abierta()) return;
    // Enter/espacio sobre un control interactivo lo activan, no avanzan
    const enControl = e.target.closest?.('button, a, [role="button"]');
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': ir(actual + 1); e.preventDefault(); break;
      case ' ': if (!enControl) { ir(actual + 1); e.preventDefault(); } break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': ir(actual - 1); e.preventDefault(); break;
      case 'Home': ir(0); e.preventDefault(); break;
      case 'End': ir(slides.length - 1); e.preventDefault(); break;
    }
  });
  btnPrev.addEventListener('click', () => ir(actual - 1));
  btnSig.addEventListener('click', () => ir(actual + 1));
  window.addEventListener('hashchange', () => { const n = desdeHash(); if (n !== actual) mostrar(n); });

  // clic en el fondo vacío de la diapositiva: mitad derecha avanza, izquierda retrocede
  $('#deck').addEventListener('click', (e) => {
    if (e.target.closest('button, a, .hu, .panel, table, .timeline, .barras, .lista-prs')) return;
    ir(e.clientX > innerWidth / 2 ? actual + 1 : actual - 1);
  });

  // deslizar en pantallas táctiles
  let x0 = null;
  document.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) ir(dx < 0 ? actual + 1 : actual - 1);
  });

  // ── elementos interactivos ─────────────────────────────────────────────
  // historias: la tarjeta se despliega para ver sus tareas
  $$('.hu').forEach((card) => card.addEventListener('click', () => {
    card.setAttribute('aria-expanded', card.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  }));
  // saltos a otra diapositiva (fila de un integrante → su diapositiva)
  $$('[data-ir]').forEach((el) => el.addEventListener('click', () => ir(Number(el.dataset.ir) - 1)));

  // línea de tiempo: filtrar por integrante desde la leyenda
  $$('.tl-leyenda').forEach((ley) => {
    const tl = ley.nextElementSibling;
    $$('button', ley).forEach((b) => b.addEventListener('click', () => {
      const activo = b.getAttribute('aria-pressed') === 'true';
      $$('button', ley).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      tl.classList.toggle('filtrada', !activo);
      $$('.pr-pill', tl).forEach((p) => p.classList.toggle('visible', !activo && p.dataset.autor === b.dataset.autor));
      if (!activo) b.setAttribute('aria-pressed', 'true');
    }));
  });

  // tooltips: cualquier elemento con data-tip
  function ocultarTip() { tip.classList.remove('visible'); }
  function mostrarTip(el) {
    tip.textContent = el.dataset.tip;
    tip.classList.add('visible');
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.width / 2;
    let y = r.top - t.height - 10;
    if (y < 8) y = r.bottom + 10;
    x = Math.max(8, Math.min(innerWidth - t.width - 8, x));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  $$('[data-tip]').forEach((el) => {
    el.addEventListener('mouseenter', () => mostrarTip(el));
    el.addEventListener('focus', () => mostrarTip(el));
    el.addEventListener('mouseleave', ocultarTip);
    el.addEventListener('blur', ocultarTip);
  });

  mostrar(actual);
})();
