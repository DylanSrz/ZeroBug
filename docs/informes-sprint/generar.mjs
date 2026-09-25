#!/usr/bin/env node
/**
 * Genera el informe de un sprint a partir de sus datos:
 *
 *   sprint-NN/metricas.json   ← recolectar.mjs (números; no se edita a mano)
 *   sprint-NN/contenido.json  ← se redacta cada semana (textos)
 *   equipo.json               ← integrantes, colores y destinatario
 *
 * Produce, dentro de sprint-NN/:
 *   presentacion.html                 presentación interactiva y autocontenida
 *   informe.html                      documento (fuente del PDF)
 *   Informe-Sprint-NN-ZeroBug.pdf     documento para el Team Leader
 *
 * Uso:
 *   node docs/informes-sprint/generar.mjs <sprint> [--sin-pdf] [--capturas]
 *
 * --capturas deja capturas de cada diapositiva y de cada página del PDF en
 * node_modules/.cache/informe-sprint/capturas/ para revisarlas antes de entregar.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const TMP = join(RAIZ, 'node_modules', '.cache', 'informe-sprint');

const args = process.argv.slice(2);
const numero = Number(args.find((a) => /^\d+$/.test(a)));
if (!numero) {
  console.error('Uso: node docs/informes-sprint/generar.mjs <sprint> [--sin-pdf] [--capturas]');
  process.exit(1);
}
const NN = String(numero).padStart(2, '0');
const carpeta = join(AQUI, `sprint-${NN}`);
const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
for (const f of ['metricas.json', 'contenido.json']) {
  if (!existsSync(join(carpeta, f))) {
    console.error(`Falta sprint-${NN}/${f}. ${f === 'metricas.json' ? 'Ejecuta primero recolectar.mjs.' : 'Redáctalo a partir del de un sprint anterior.'}`);
    process.exit(1);
  }
}
const equipo = leer(join(AQUI, 'equipo.json'));
const met = leer(join(carpeta, 'metricas.json'));
const con = leer(join(carpeta, 'contenido.json'));
if (met.sprint !== numero || con.sprint !== numero) throw new Error('El número de sprint no coincide entre archivos.');

// ── utilidades de texto y fechas ─────────────────────────────────────────
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Texto con **negrita** y `código`, escapado. */
const md = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const partes = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
const fecha = (ymd) => { const p = partes(ymd); return `${p.d} ${MESES[p.m - 1]} ${p.y}`; };
const fechaLarga = (ymd) => { const p = partes(ymd); return `${DIAS[p.dow]} ${p.d} de ${MESES_LARGOS[p.m - 1]} de ${p.y}`; };
const rango = (a, b) => {
  const x = partes(a), y = partes(b);
  if (x.y !== y.y) return `${fecha(a)} – ${fecha(b)}`;
  if (x.m !== y.m) return `${x.d} ${MESES[x.m - 1]} – ${y.d} ${MESES[y.m - 1]} ${y.y}`;
  return `${x.d} – ${y.d} ${MESES[y.m - 1]} ${y.y}`;
};
/** Fecha local (YYYY-MM-DD) y hora de un instante ISO en la zona del equipo. */
const local = (iso) => {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: equipo.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t) => f.find((x) => x.type === t).value;
  return { ymd: `${g('year')}-${g('month')}-${g('day')}`, hora: `${g('hour')}:${g('minute')}` };
};
const sumarDias = (ymd, n) => { const p = partes(ymd); return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10); };
const num = (n) => Number(n ?? 0).toLocaleString('es-CO');
const plural = (n, uno, varios) => `${num(n)} ${n === 1 ? uno : varios}`;

// ── modelo ───────────────────────────────────────────────────────────────
const miembros = equipo.integrantes;
const miembro = (login) =>
  miembros.find((m) => m.login === login) ?? { login, nombre: login, rol: '', iniciales: String(login).slice(0, 2).toUpperCase(), color: '#8b98ad' };
const primerNombre = (m) => m.nombre.split(' ')[0];
const TIPOS = { feat: 'función', fix: 'corrección', test: 'pruebas', docs: 'docs', chore: 'infra', refactor: 'refactor', style: 'estilo' };
const tipoPR = (titulo) => (titulo.match(/^(\w+)(\(.+?\))?!?:/)?.[1] ?? '').toLowerCase();
const NOMBRES_MODULO = {
  plataforma: 'Plataforma', tables: 'Mesas', categories: 'Categorías', products: 'Productos', menu: 'Menú público',
  reservations: 'Reservas', users: 'Usuarios', auth: 'Autenticación', employees: 'Empleados', roles: 'Roles',
  profile: 'Perfil', orders: 'Pedidos', health: 'Estado del servicio',
};
const nombreModulo = (m) => NOMBRES_MODULO[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

const prPorNumero = new Map(met.prs.map((p) => [p.numero, p]));
const sinPrefijo = (t) => { const x = t.replace(/^\w+(\(.+?\))?!?:\s*/, ''); return x.charAt(0).toUpperCase() + x.slice(1); };
// tareas con los ajustes manuales de contenido.json aplicados
const tareas = met.tareas.map((t) => {
  const ajuste = con.ajustesTareas?.[t.numero];
  if (!ajuste) return t;
  const pr = ajuste.pr ? prPorNumero.get(ajuste.pr) : null;
  return { ...t, resueltaPor: ajuste.login ?? pr?.autor ?? t.resueltaPor, pr: ajuste.pr ?? t.pr };
});
const tareasDePR = (n) => tareas.filter((t) => t.pr === n);
/** Nombre legible del cambio: la tarea del tablero que resolvió, o el título del PR sin prefijo. */
const nombrePR = (p) => tareasDePR(p.numero).map((t) => sinPrefijo(t.titulo)).join(' · ') || sinPrefijo(p.titulo);
const historias = met.historias.map((h) => {
  const extra = con.historias?.[h.numero] ?? {};
  return {
    ...h,
    clave: h.titulo.match(/HU-\d+/)?.[0] ?? `#${h.numero}`,
    corto: extra.corto ?? h.titulo.replace(/^HU-\d+\s*[—-]\s*/, ''),
    entrega: extra.entrega ?? '',
    modulo: extra.modulo ?? null,
    responsables: extra.responsables ?? h.asignados,
    tareas: tareas.filter((t) => t.historia === h.numero),
  };
});
const porMiembro = miembros.map((m) => {
  const base = met.porIntegrante[m.login] ?? { prs: [], revisiones: { total: 0, aprobadas: 0, cambios: 0, comentarios: 0 } };
  return {
    ...m,
    prs: base.prs.map((n) => prPorNumero.get(n)).filter(Boolean),
    tareas: tareas.filter((t) => t.resueltaPor === m.login),
    revisiones: base.revisiones,
    historias: historias.filter((h) => h.responsables.includes(m.login)),
    destacados: con.integrantes?.[m.login]?.destacados ?? [],
  };
});
const T = met.totales;
const tests = met.tests;
const release = met.ventana.release;
const repoUrl = `https://github.com/${equipo.repositorio}`;
const titulo = `Informe del Sprint ${numero}`;
const periodo = rango(con.periodo.inicio, con.periodo.fin);

// días de la línea de tiempo: los del sprint más cualquier día con merges fuera de él
const dias = new Set();
for (let d = con.periodo.inicio; d <= con.periodo.fin; d = sumarDias(d, 1)) dias.add(d);
met.prs.forEach((p) => dias.add(local(p.mergedAt).ymd));
const diasOrdenados = [...dias].sort();

let nKicker = 0;
const kick = () => String(++nKicker).padStart(2, '0');
let nSeccion = 0;
const sec = () => `<span class="n">${++nSeccion}.</span>`;

// ── piezas reutilizables ─────────────────────────────────────────────────
const avatar = (m, clase = '') =>
  `<span class="avatar ${clase}" style="--c:${esc(m.color)}" aria-hidden="true">${esc(m.iniciales)}</span>`;
const avatarDoc = (m) => `<span class="avatar" style="--c:${esc(m.color)}">${esc(m.iniciales)}</span>`;
const estadoHU = (h) =>
  h.estado === 'CLOSED'
    ? '<span class="estado ok">✓ Cerrada</span>'
    : '<span class="estado actual">En curso</span>';

// ── presentación ─────────────────────────────────────────────────────────
const diapositivas = [];
const agregar = (tituloSlide, seccion, cuerpo, clase = '') =>
  diapositivas.push({ tituloSlide, seccion, html: `<div class="inner">${cuerpo}</div>`, clase });

// 1. portada
agregar('Portada', '', `
  <div class="badge r"><span class="punto"></span> Sprint ${numero} · ${esc(con.nombre)} · ${esc(periodo)}${release ? ` · release <b>${esc(release)}</b>` : ''}</div>
  <p class="kicker r">Informe de sprint · Equipo ZeroBug</p>
  <h1 class="r"><span class="logo">Zero<span>Bug</span></span> — ${esc(titulo)}<br><span class="tenue" style="font-weight:600">${esc(con.nombre)}</span></h1>
  <p class="lead r">Qué entregó el equipo, cómo lo hicimos y qué hizo cada integrante durante el sprint.</p>
  <div class="meta r">
    <div><b>Para</b>${esc(equipo.destinatario.nombre)} · ${esc(equipo.destinatario.rol)}</div>
    <div><b>Presenta</b>${esc(con.presenta.nombre)} · ${esc(con.presenta.rol)}</div>
    <div><b>Fecha</b>${esc(fechaLarga(con.fechaInforme))}</div>
  </div>`, 'portada');

// 2. resultado
const kpis = [
  { v: T.puntosCompletados, de: T.puntosComprometidos, l: 'Puntos completados', s: `de ${num(T.puntosComprometidos)} comprometidos` },
  { v: T.historiasCerradas, de: T.historias, l: 'Historias entregadas', s: 'verificadas en la Sprint Review' },
  { v: T.prs, l: 'Pull requests integrados', s: `${plural(T.tareasCerradas, 'tarea cerrada', 'tareas cerradas')}` },
  { v: T.revisiones, l: 'Revisiones de código', s: 'hechas por el equipo' },
  { v: (tests.unit ?? 0) + (tests.e2e ?? 0), l: 'Pruebas automáticas', s: `${num(tests.unit)} unitarias · ${num(tests.e2e)} e2e` },
  { v: met.endpoints.total, l: 'Endpoints en la API', s: 'documentados en Swagger' },
];
agregar('Resultado del sprint', 'Resumen', `
  <p class="kicker r">${kick()} · Resultado del sprint</p>
  <div class="meta-sprint r" style="margin-bottom:22px">
    <span class="icono">✓</span>
    <div><h2 style="margin:0 0 8px">${md(con.titular ?? con.resultado.split('. ')[0])}</h2><p class="lead" style="margin-bottom:6px">${md(con.resultado)}</p><p class="lead" style="font-size:clamp(13px,1.2vw,16px)"><span class="tenue">Objetivo del sprint:</span> ${md(con.objetivo)}</p></div>
  </div>
  <div class="grid c3 r">
    ${kpis.map((k) => `
      <div class="panel kpi">
        <div class="num"><span data-contar="${k.v}">${num(k.v)}</span>${k.de !== undefined ? `<small>/ ${num(k.de)}</small>` : ''}</div>
        <div class="lbl">${esc(k.l)}</div><div class="sub">${esc(k.s)}</div>
      </div>`).join('')}
  </div>`);

// 3. resumen ejecutivo
agregar('Resumen ejecutivo', 'Resumen', `
  <p class="kicker r">${kick()} · Resumen ejecutivo</p>
  <h2 class="r">Lo más importante del sprint</h2>
  <div class="panel r"><ul style="display:grid;gap:10px">${con.resumen.map((r) => `<li style="font-size:clamp(14px,1.35vw,18px)">${md(r)}</li>`).join('')}</ul></div>`);

// 4. historias
agregar('Historias entregadas', 'Entregado', `
  <p class="kicker r">${kick()} · Historias entregadas</p>
  <h2 class="r">${plural(T.historiasCerradas, 'historia', 'historias')}, ${num(T.puntosCompletados)} puntos <span class="tenue" style="font-size:.55em;font-weight:500">· haz clic en una tarjeta para ver sus tareas</span></h2>
  <div class="grid c${Math.min(5, historias.length)} r">
    ${historias.map((h) => `
      <button class="hu" aria-expanded="false">
        <div class="cab"><span class="clave">${esc(h.clave)}</span><span class="pts"><b>${num(h.puntos)}</b> pts</span></div>
        <div class="nombre">${esc(h.corto)}</div>
        <div class="entrega">${md(h.entrega)}</div>
        <div class="detalle"><ul>${h.tareas.map((t) => {
          const m = t.resueltaPor ? miembro(t.resueltaPor) : null;
          return `<li>#${t.numero} ${esc(t.titulo)}${m ? ` — <span class="tenue">${esc(primerNombre(m))}${t.pr ? `, PR #${t.pr}` : ''}</span>` : ''}</li>`;
        }).join('') || '<li>Sin tareas registradas</li>'}</ul></div>
        <div class="pie">
          <span class="quienes">${h.responsables.map((l) => avatar(miembro(l), 'sm')).join('')}</span>
          ${estadoHU(h)}
        </div>
        <span class="mas">${plural(h.tareas.length, 'tarea', 'tareas')}</span>
      </button>`).join('')}
  </div>`);

// 5. equipo (vista general) y 6+. una diapositiva por integrante
const indiceEquipo = diapositivas.length + 1;
const primeraPersona = indiceEquipo + 1;
const grafico = (tituloG, serie, valor, detalle) => {
  const max = Math.max(1, ...porMiembro.map(valor));
  return `
    <div class="panel">
      <h3>${esc(tituloG)}</h3>
      <div class="barras" style="--serie:${serie}">
        ${porMiembro.map((m, k) => `
          <button class="fila-barra" data-ir="${primeraPersona + k}" data-tip="${esc(`${m.nombre}: ${detalle(m)}`)}">
            <span class="quien">${avatar(m, 'sm')}${esc(primerNombre(m))}</span>
            <span class="pista"><i data-w="${((valor(m) / max) * 100).toFixed(1)}"></i></span>
            <span class="valor">${num(valor(m))}</span>
          </button>`).join('')}
      </div>
    </div>`;
};
agregar('El equipo', 'Equipo', `
  <p class="kicker r">${kick()} · Aporte por integrante</p>
  <h2 class="r">Qué hizo cada uno <span class="tenue" style="font-size:.55em;font-weight:500">· clic en un nombre para ver su detalle</span></h2>
  <div class="grid c3 r">
    ${grafico('Pull requests integrados', 'var(--teal)', (m) => m.prs.length, (m) => `${plural(m.prs.length, 'PR integrado', 'PRs integrados')} en dev`)}
    ${grafico('Tareas resueltas', 'var(--info)', (m) => m.tareas.length, (m) => plural(m.tareas.length, 'tarea resuelta', 'tareas resueltas'))}
    ${grafico('Revisiones de código', 'var(--ambar)', (m) => m.revisiones.total, (m) => `${num(m.revisiones.total)} revisiones — ${num(m.revisiones.aprobadas)} aprobadas, ${num(m.revisiones.cambios)} con cambios, ${num(m.revisiones.comentarios)} comentarios`)}
  </div>
  <p class="tenue r" style="margin-top:14px;font-size:13px">PRs integrados en <code>dev</code> durante el sprint · tareas cerradas por un PR del integrante · revisiones hechas a PRs de otros compañeros.</p>`);

porMiembro.forEach((m) => {
  const hu = m.historias.map((h) => `<span class="chip">${esc(h.clave)} · ${esc(h.corto)} · ${num(h.puntos)} pts</span>`).join('');
  const r = m.revisiones;
  agregar(m.nombre, 'Equipo', `
    <div class="persona-cab r">
      ${avatar(m, 'xl')}
      <div><h2>${esc(m.nombre)}</h2><div class="rol">${esc(m.rol)}</div>${hu ? `<div class="chips" style="margin-top:8px">${hu}</div>` : ''}</div>
    </div>
    <div class="persona r">
      <div>
        <div class="stats">
          <div class="stat"><b data-contar="${m.prs.length}">${m.prs.length}</b><span>PRs integrados</span></div>
          <div class="stat"><b data-contar="${m.tareas.length}">${m.tareas.length}</b><span>tareas resueltas</span></div>
          <div class="stat" data-tip="${esc(`${num(r.aprobadas)} aprobadas · ${num(r.cambios)} con cambios solicitados · ${num(r.comentarios)} comentarios`)}" tabindex="0"><b data-contar="${r.total}">${r.total}</b><span>revisiones hechas</span></div>
        </div>
        <div class="panel"><h3>Aporte destacado</h3><ul>${m.destacados.map((d) => `<li>${md(d)}</li>`).join('') || '<li>Sin aportes registrados en este sprint.</li>'}</ul></div>
      </div>
      <div class="panel">
        <h3>Pull requests integrados <span class="tenue">(${m.prs.length})</span></h3>
        ${m.prs.length ? `<ul class="lista-prs">${m.prs.map((p) => {
          const l = local(p.mergedAt);
          return `<li><a href="${esc(p.url)}" target="_blank" rel="noopener" data-tip="${esc(`PR #${p.numero}: ${p.titulo} — ${fecha(l.ymd)} ${l.hora} · +${num(p.adiciones)} / −${num(p.eliminaciones)} líneas`)}"><span class="n">#${p.numero}</span><span class="tipo">${esc(TIPOS[tipoPR(p.titulo)] ?? 'cambio')}</span><span class="txt">${esc(nombrePR(p))}</span></a></li>`;
        }).join('')}</ul>` : '<p>Sin PRs integrados en este sprint.</p>'}
      </div>
    </div>`);
});

// línea de tiempo
agregar('Línea de tiempo', 'Equipo', `
  <p class="kicker r">${kick()} · Línea de tiempo</p>
  <h2 class="r">Qué entró en <code style="font-size:.85em">dev</code> cada día <span class="tenue" style="font-size:.55em;font-weight:500">· clic en un nombre para filtrar</span></h2>
  <div class="tl-leyenda r">${porMiembro.map((m) => `<button data-autor="${esc(m.login)}" aria-pressed="false">${avatar(m, 'sm')}${esc(primerNombre(m))} <span class="tenue">${m.prs.length}</span></button>`).join('')}</div>
  <div class="timeline r" style="--dias:${diasOrdenados.length}">
    ${diasOrdenados.map((d) => {
      const delDia = met.prs.filter((p) => local(p.mergedAt).ymd === d).sort((a, b) => Date.parse(a.mergedAt) - Date.parse(b.mergedAt));
      const p = partes(d);
      const fuera = d < con.periodo.inicio || d > con.periodo.fin;
      return `<div class="dia${delDia.length ? '' : ' vacio'}${fuera ? ' fuera' : ''}"${fuera ? ' data-tip="Antes del inicio del sprint"' : ''}>
        <div class="fecha">${DIAS_CORTOS[p.dow]}<b>${p.d}</b>${MESES[p.m - 1]}${fuera ? '<span class="fuera-lbl">previo</span>' : ''}</div>
        ${delDia.map((pr) => { const m = miembro(pr.autor); return `<a class="pr-pill" style="--c:${esc(m.color)}" data-autor="${esc(m.login)}" href="${esc(pr.url)}" target="_blank" rel="noopener" data-tip="${esc(`#${pr.numero} ${nombrePR(pr)} — ${m.nombre}, ${local(pr.mergedAt).hora}`)}"><span class="ini">${esc(m.iniciales)}</span><span class="num">#${pr.numero}</span></a>`; }).join('')}
        ${delDia.length ? '' : '<span class="tenue" style="font-size:11px;text-align:center">—</span>'}
      </div>`;
    }).join('')}
  </div>`);

// calidad
const modulosTest = Object.entries(tests.porModulo ?? {}).sort((a, b) => (b[1].unit + b[1].e2e) - (a[1].unit + a[1].e2e));
const maxTest = Math.max(1, ...modulosTest.map(([, v]) => v.unit + v.e2e));
agregar('Calidad', 'Calidad', `
  <p class="kicker r">${kick()} · Calidad</p>
  <h2 class="r">${num((tests.unit ?? 0) + (tests.e2e ?? 0))} pruebas automáticas y CI obligatorio</h2>
  <div class="grid c2 r">
    <div class="panel">
      <h3>Pruebas por módulo</h3>
      <div class="leyenda"><span><i style="background:var(--teal)"></i>Unitarias</span><span><i style="background:var(--ambar)"></i>End-to-end (PostgreSQL real)</span></div>
      <div class="barras">
        ${modulosTest.map(([mod, v]) => `
          <div class="fila-test" data-tip="${esc(`${nombreModulo(mod)}: ${v.unit} unitarias + ${v.e2e} e2e${met.endpoints.porModulo?.[mod] ? ` · ${met.endpoints.porModulo[mod]} endpoints` : ''}`)}">
            <span class="mod">${esc(nombreModulo(mod))}</span>
            <span class="apilada"><i style="background:var(--teal)" data-w="${((v.unit / maxTest) * 100).toFixed(1)}"></i><i style="background:var(--ambar)" data-w="${((v.e2e / maxTest) * 100).toFixed(1)}"></i></span>
            <span class="cifras"><b>${v.unit + v.e2e}</b> <span class="tenue">(${v.unit} + ${v.e2e})</span></span>
          </div>`).join('')}
      </div>
    </div>
    <div class="panel"><h3>Cómo aseguramos la calidad</h3><ul>${(con.calidad ?? []).map((c) => `<li>${md(c)}</li>`).join('')}</ul></div>
  </div>`);

// retrospectiva
agregar('Retrospectiva', 'Proceso', `
  <p class="kicker r">${kick()} · Retrospectiva</p>
  <h2 class="r">Qué aprendimos</h2>
  <div class="grid c3 retro r">
    <div class="panel"><h3><span class="marca m-ok">✓</span>Mantener</h3><ul>${con.retro.mantener.map((x) => `<li>${md(x)}</li>`).join('')}</ul></div>
    <div class="panel"><h3><span class="marca m-mejora">↻</span>Mejorar</h3><ul>${con.retro.mejorar.map((x) => `<li>${md(x)}</li>`).join('')}</ul></div>
    <div class="panel"><h3><span class="marca m-accion">→</span>Acciones</h3><ul>${con.retro.acciones.map((a) => `<li>${md(a.accion)} <span class="tenue">— ${esc(a.responsable)}</span></li>`).join('')}</ul></div>
  </div>`);

// decisiones y calendario
agregar('Decisiones y calendario', 'Proceso', `
  <p class="kicker r">${kick()} · Decisiones del sprint</p>
  <h2 class="r">Cambios de proceso y nuevo calendario</h2>
  <div class="grid c${Math.min(3, (con.decisiones ?? []).length || 1)} r" style="margin-bottom:18px">
    ${(con.decisiones ?? []).map((d) => `<div class="panel"><h3>${esc(d.titulo)}</h3><p>${md(d.detalle)}</p></div>`).join('')}
  </div>
  ${con.calendario?.length ? `<div class="calendario r">${con.calendario.map((c) => `
    <div class="sprint-caja ${c.estado === 'actual' ? 'actual' : ''}">
      <div class="t">Sprint ${c.sprint}</div><div class="f">${esc(c.fechas)}</div><p>${esc(c.meta)}</p>
      ${c.estado === 'hecho' ? '<span class="estado ok">✓ Hecho</span>' : c.estado === 'actual' ? '<span class="estado actual">● En curso</span>' : '<span class="estado pendiente">Planificado</span>'}
    </div>`).join('')}</div>` : ''}`);

// incidencias
if (con.incidencias?.length) {
  agregar('Incidencias', 'Proceso', `
    <p class="kicker r">${kick()} · Incidencias del sprint</p>
    <h2 class="r">Qué salió mal y cómo lo resolvimos</h2>
    ${con.incidencias.map((x) => `
      <div class="panel r" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px">
          <h3 style="margin:0">⚠ ${md(x.titulo)}</h3><span class="estado ok">✓ ${esc(x.estado ?? 'Resuelta')}</span>
        </div>
        <div class="grid c3">
          <div><p class="kicker" style="margin-bottom:4px">Qué pasó</p><p>${md(x.detalle)}</p></div>
          <div><p class="kicker" style="margin-bottom:4px">Impacto</p><p>${md(x.impacto ?? '')}</p></div>
          <div><p class="kicker" style="margin-bottom:4px">Solución</p><p>${md(x.solucion ?? '')}</p></div>
        </div>
      </div>`).join('')}`);
}

// siguiente sprint
const sig = con.siguiente;
if (sig) {
  const ptsSig = sig.historias.reduce((s, h) => s + (h.puntos ?? 0), 0);
  agregar(`Sprint ${sig.sprint}`, 'Próximo sprint', `
    <p class="kicker r">${kick()} · Próximo sprint</p>
    <h2 class="r">Sprint ${sig.sprint} · ${esc(rango(sig.periodo.inicio, sig.periodo.fin))}</h2>
    <p class="lead r" style="margin-bottom:18px"><span class="tenue">Objetivo:</span> ${md(sig.objetivo)}</p>
    <div class="grid c2 r">
      <div class="panel">
        <h3>Historias comprometidas</h3>
        <table class="t"><thead><tr><th>Historia</th><th style="text-align:right">Puntos</th></tr></thead>
          <tbody>${sig.historias.map((h) => `<tr><td><code>${esc(h.clave)}</code> ${esc(h.titulo)}</td><td class="num">${num(h.puntos)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total comprometido</td><td class="num">${num(ptsSig)}</td></tr></tfoot></table>
        ${sig.base ? `<p style="margin-top:12px">${md(sig.base)}</p>` : ''}
      </div>
      <div class="panel"><h3>Riesgos que vigilamos</h3><ul>${sig.riesgos.map((x) => `<li>${md(x)}</li>`).join('')}</ul></div>
    </div>`);
}

// cierre
agregar('Cierre', '', `
  <div style="text-align:center">
    <p class="kicker r">Gracias</p>
    <h1 class="r"><span class="logo">Zero<span>Bug</span></span></h1>
    <p class="lead r" style="margin:0 auto">Preguntas y comentarios bienvenidos.</p>
    <div class="meta r" style="justify-content:center">
      <div><b>Repositorio</b><a href="${esc(repoUrl)}" target="_blank" rel="noopener">github.com/${esc(equipo.repositorio)}</a></div>
      <div><b>Tablero</b><a href="${esc(equipo.tablero)}" target="_blank" rel="noopener">GitHub Projects</a></div>
      ${release ? `<div><b>Release</b><a href="${esc(`${repoUrl}/tree/${release}`)}" target="_blank" rel="noopener">${esc(release)}</a></div>` : ''}
    </div>
  </div>`, 'portada');

const css = readFileSync(join(AQUI, 'plantilla', 'presentacion.css'), 'utf8');
const js = readFileSync(join(AQUI, 'plantilla', 'presentacion.js'), 'utf8');
const presentacion = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sprint ${numero} — Informe · ZeroBug</title>
<meta name="description" content="${esc(`${titulo} (${periodo}) del equipo ZeroBug para ${equipo.destinatario.nombre}.`)}">
<style>
${css}
</style>
</head>
<body>
<div class="fondo"></div>
<main class="deck" id="deck">
${diapositivas.map((d, k) => `<section class="slide ${d.clase}" data-titulo="${esc(d.tituloSlide)}" data-seccion="${esc(d.seccion)}" aria-label="${esc(`${k + 1}. ${d.tituloSlide}`)}">${d.html}</section>`).join('\n')}
</main>
<button class="nav izq" id="anterior" aria-label="Diapositiva anterior">‹</button>
<button class="nav der" id="siguiente" aria-label="Diapositiva siguiente">›</button>
<div class="hud">
  <div class="progreso"><i id="progreso"></i></div>
  <div class="hud-barra">
    <div>ZeroBug · ${esc(titulo)} · ${esc(periodo)}</div>
    <div class="teclas"><kbd>←</kbd><kbd>→</kbd> navegar <button data-capa="vista-general"><kbd>O</kbd> vista general</button> <button data-capa="ayuda"><kbd>?</kbd> atajos</button> <kbd>F</kbd> pantalla completa <span id="contador"></span></div>
  </div>
</div>
<div class="capa" id="vista-general" role="dialog" aria-label="Vista general"><h2>Vista general <span class="tenue" style="font-size:14px;font-weight:500">· Esc para cerrar</span></h2><div class="miniaturas"></div></div>
<div class="capa" id="ayuda" role="dialog" aria-label="Atajos de teclado"><div class="ayuda"><h2>Atajos de teclado</h2><table>
  <tr><td><kbd>→</kbd> <kbd>↓</kbd> <kbd>Espacio</kbd></td><td>Siguiente diapositiva</td></tr>
  <tr><td><kbd>←</kbd> <kbd>↑</kbd></td><td>Diapositiva anterior</td></tr>
  <tr><td><kbd>Inicio</kbd> <kbd>Fin</kbd></td><td>Primera / última</td></tr>
  <tr><td><kbd>O</kbd></td><td>Vista general de todas las diapositivas</td></tr>
  <tr><td><kbd>F</kbd></td><td>Pantalla completa</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>Cerrar esta ventana</td></tr>
  <tr><td>Clic</td><td>En tarjetas, nombres y PRs para ver el detalle</td></tr>
</table><p class="tenue" style="margin-top:14px;font-size:13px"><button data-capa="ayuda" style="background:none;border:1px solid var(--borde);border-radius:8px;padding:6px 12px;cursor:pointer">Cerrar</button></p></div></div>
<div class="tip" id="tip" role="tooltip"></div>
<script>
${js}
</script>
</body>
</html>
`;

// ── documento (PDF) ──────────────────────────────────────────────────────
const destinatario = equipo.destinatario;
const filaPR = (p) => { const l = local(p.mergedAt); return `<tr><td class="mono">#${p.numero}</td><td>${esc(nombrePR(p))}</td><td class="num">${esc(fecha(l.ymd))}</td></tr>`; };
const historiaDe = (numeroTarea) => {
  const t = tareas.find((x) => x.numero === numeroTarea);
  const h = historias.find((x) => x.numero === t?.historia);
  return h ? h.clave : 'Proceso';
};
const informe = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(titulo)} — ZeroBug</title>
<meta name="author" content="${esc(con.presenta.nombre)}">
<style>
${readFileSync(join(AQUI, 'plantilla', 'informe.css'), 'utf8')}
@page {
  size: A4; margin: 16mm 15mm 18mm;
  @bottom-left { content: "ZeroBug · ${titulo.replace(/"/g, '')} · ${periodo}"; font-family: "Noto Sans", sans-serif; font-size: 8pt; color: #64748b; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font-family: "Noto Sans", sans-serif; font-size: 8pt; color: #64748b; }
}
</style>
</head>
<body><div class="hoja">

<div class="cabecera">
  <div><div class="marca">Zero<span>Bug</span> — Restaurant API</div><h1>${esc(titulo)}</h1><div style="color:var(--ink-2);font-size:11pt">${esc(con.nombre)}</div></div>
  <div class="sprint">Sprint<b>${NN}</b>${esc(periodo)}</div>
</div>

<table class="ficha">
  <tr><th>Para</th><td>${esc(destinatario.nombre)} — ${esc(destinatario.rol)}</td></tr>
  <tr><th>De</th><td>${esc(con.presenta.nombre)} — ${esc(con.presenta.rol)}, en nombre del equipo</td></tr>
  <tr><th>Fecha del informe</th><td>${esc(fechaLarga(con.fechaInforme))}</td></tr>
  <tr><th>Periodo del sprint</th><td>${esc(periodo)}</td></tr>
  ${release ? `<tr><th>Release</th><td><strong>${esc(release)}</strong> · <a href="${esc(`${repoUrl}/tree/${release}`)}">${esc(`github.com/${equipo.repositorio}`)}</a></td></tr>` : ''}
  <tr><th>Equipo</th><td>${porMiembro.map((m) => esc(m.nombre)).join(' · ')}</td></tr>
</table>

<div class="estado-sprint">
  <span class="icono">✓</span>
  <div><p><strong>${md(con.titular ?? '')}.</strong> ${md(con.resultado)}</p><p class="objetivo"><strong>Objetivo del sprint:</strong> ${md(con.objetivo)}</p></div>
</div>

<div class="kpis">
  <div><b>${num(T.puntosCompletados)}/${num(T.puntosComprometidos)}</b><span>puntos completados</span></div>
  <div><b>${num(T.historiasCerradas)}/${num(T.historias)}</b><span>historias entregadas</span></div>
  <div><b>${num(T.prs)}</b><span>pull requests integrados</span></div>
  <div><b>${num((tests.unit ?? 0) + (tests.e2e ?? 0))}</b><span>pruebas automáticas</span></div>
  <div><b>${num(met.endpoints.total)}</b><span>endpoints en la API</span></div>
</div>

<h2>${sec()}Resumen ejecutivo</h2>
<ul>${con.resumen.map((r) => `<li>${md(r)}</li>`).join('')}</ul>

<h2>${sec()}Historias entregadas</h2>
<table class="t junta">
  <thead><tr><th>Historia</th><th>Qué se entregó</th><th>Responsable</th><th class="num">Puntos</th><th>Estado</th></tr></thead>
  <tbody>${historias.map((h) => `<tr>
    <td><strong>${esc(h.clave)}</strong><br>${esc(h.corto)}</td>
    <td>${md(h.entrega)}</td>
    <td>${h.responsables.map((l) => esc(miembro(l).nombre)).join('<br>')}</td>
    <td class="num">${num(h.puntos)}</td>
    <td>${h.estado === 'CLOSED' ? '<span class="ok">✓ Cerrada</span>' : 'En curso'}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="3">Total</td><td class="num">${num(T.puntosCompletados)} / ${num(T.puntosComprometidos)}</td><td>${num(T.historiasCerradas)} de ${num(T.historias)}</td></tr></tfoot>
</table>
<p class="nota">Cada historia se cierra cuando todas sus tareas están integradas y alguien distinto a su autor verificó sus criterios de aceptación en la Sprint Review.</p>

<h2>${sec()}Trabajo por integrante</h2>
<p class="nota" style="margin-bottom:10px">PRs: pull requests integrados en <code>dev</code> durante el sprint. Tareas: tareas del tablero cerradas por un PR del integrante. Revisiones: revisiones de código hechas a PRs de otros compañeros.</p>
<table class="t junta" style="margin-bottom:14px">
  <thead><tr><th>Integrante</th><th>Rol</th><th>Historias a cargo</th><th class="num">PRs</th><th class="num">Tareas</th><th class="num">Revisiones</th></tr></thead>
  <tbody>${porMiembro.map((m) => `<tr><td><strong>${esc(m.nombre)}</strong></td><td>${esc(m.rol)}</td><td>${m.historias.map((h) => `${esc(h.clave)} (${num(h.puntos)} pts)`).join(', ') || '—'}</td><td class="num">${m.prs.length}</td><td class="num">${m.tareas.length}</td><td class="num">${m.revisiones.total}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="3">Total del equipo</td><td class="num">${num(T.prs)}</td><td class="num">${num(porMiembro.reduce((s, m) => s + m.tareas.length, 0))}</td><td class="num">${num(T.revisiones)}</td></tr></tfoot>
</table>
${porMiembro.map((m) => `
<div class="integrante${m.prs.length > 8 ? ' largo' : ''}">
  <div class="cab">
    ${avatarDoc(m)}
    <div><h3>${esc(m.nombre)}</h3><div class="rol">${esc(m.rol)}${m.historias.length ? ` · responsable de ${m.historias.map((h) => `${esc(h.clave)} ${esc(h.corto)}`).join(', ')}` : ''}</div></div>
    <div class="cifras">
      <div><b>${m.prs.length}</b><span>PRs</span></div>
      <div><b>${m.tareas.length}</b><span>tareas</span></div>
      <div><b>${m.revisiones.total}</b><span>revisiones</span></div>
    </div>
  </div>
  <ul>${m.destacados.map((d) => `<li>${md(d)}</li>`).join('') || '<li>Sin aportes registrados en este sprint.</li>'}</ul>
  ${m.prs.length ? `<table class="t"><thead><tr><th style="width:52px">PR</th><th>Cambio integrado</th><th class="num" style="width:90px">Fecha</th></tr></thead><tbody>${m.prs.map(filaPR).join('')}</tbody></table>` : ''}
  ${m.revisiones.total ? `<p class="nota" style="margin:6px 0 0">Revisiones: ${num(m.revisiones.aprobadas)} aprobadas · ${num(m.revisiones.cambios)} con cambios solicitados · ${num(m.revisiones.comentarios)} comentarios.</p>` : ''}
</div>`).join('')}

<h2>${sec()}Calidad</h2>
<table class="t junta">
  <thead><tr><th>Módulo</th><th class="num">Pruebas unitarias</th><th class="num">Pruebas e2e</th><th class="num">Total</th><th class="num">Endpoints</th></tr></thead>
  <tbody>${modulosTest.map(([mod, v]) => `<tr><td>${esc(nombreModulo(mod))}</td><td class="num">${v.unit}</td><td class="num">${v.e2e}</td><td class="num">${v.unit + v.e2e}</td><td class="num">${met.endpoints.porModulo?.[mod] ?? (mod === 'plataforma' ? met.endpoints.porModulo?.health ?? '—' : '—')}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td>Total</td><td class="num">${num(tests.unit)}</td><td class="num">${num(tests.e2e)}</td><td class="num">${num((tests.unit ?? 0) + (tests.e2e ?? 0))}</td><td class="num">${num(met.endpoints.total)}</td></tr></tfoot>
</table>
<ul>${(con.calidad ?? []).map((c) => `<li>${md(c)}</li>`).join('')}</ul>

<h2>${sec()}Retrospectiva</h2>
<div class="dos">
  <div class="caja"><h3>Mantener</h3><ul>${con.retro.mantener.map((x) => `<li>${md(x)}</li>`).join('')}</ul></div>
  <div class="caja"><h3>Mejorar</h3><ul>${con.retro.mejorar.map((x) => `<li>${md(x)}</li>`).join('')}</ul></div>
</div>
<table class="t junta" style="margin-top:10px"><thead><tr><th>Acción acordada</th><th>Responsable</th></tr></thead>
  <tbody>${con.retro.acciones.map((a) => `<tr><td>${md(a.accion)}</td><td>${esc(a.responsable)}</td></tr>`).join('')}</tbody></table>

<h2>${sec()}Decisiones del sprint</h2>
<ul>${(con.decisiones ?? []).map((d) => `<li><strong>${esc(d.titulo)}.</strong> ${md(d.detalle)}</li>`).join('')}</ul>
${con.calendario?.length ? `<table class="t junta"><thead><tr><th>Sprint</th><th>Fechas</th><th>Meta</th><th>Estado</th></tr></thead>
  <tbody>${con.calendario.map((c) => `<tr><td>Sprint ${c.sprint}</td><td style="white-space:nowrap">${esc(c.fechas)}</td><td>${esc(c.meta)}</td><td>${c.estado === 'hecho' ? '<span class="ok">✓ Hecho</span>' : c.estado === 'actual' ? '<strong>En curso</strong>' : 'Planificado'}</td></tr>`).join('')}</tbody></table>` : ''}

${con.incidencias?.length ? `<h2>${sec()}Incidencias</h2>
${con.incidencias.map((x) => `<div class="caja" style="margin-bottom:10px"><h3>${md(x.titulo)} — <span class="ok">${esc(x.estado ?? 'Resuelta')}</span></h3>
  <p><strong>Qué pasó:</strong> ${md(x.detalle)}</p>
  ${x.impacto ? `<p><strong>Impacto:</strong> ${md(x.impacto)}</p>` : ''}
  ${x.solucion ? `<p style="margin:0"><strong>Solución:</strong> ${md(x.solucion)}</p>` : ''}</div>`).join('')}` : ''}

${sig ? `<h2>${sec()}Plan del Sprint ${sig.sprint} (${esc(rango(sig.periodo.inicio, sig.periodo.fin))})</h2>
<p><strong>Objetivo:</strong> ${md(sig.objetivo)}</p>
<table class="t junta"><thead><tr><th>Historia</th><th class="num">Puntos</th></tr></thead>
  <tbody>${sig.historias.map((h) => `<tr><td><strong>${esc(h.clave)}</strong> ${esc(h.titulo)}</td><td class="num">${num(h.puntos)}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td>Total comprometido</td><td class="num">${num(sig.historias.reduce((s, h) => s + (h.puntos ?? 0), 0))}</td></tr></tfoot></table>
${sig.base ? `<p>${md(sig.base)}</p>` : ''}
<p><strong>Riesgos que vigilamos:</strong></p>
<ul>${sig.riesgos.map((x) => `<li>${md(x)}</li>`).join('')}</ul>` : ''}

<h2 class="salto"><span class="n">Anexo.</span>Tareas del sprint</h2>
<table class="t">
  <thead><tr><th style="width:44px">#</th><th>Tarea</th><th style="width:70px">Historia</th><th>Resuelta por</th><th style="width:52px">PR</th></tr></thead>
  <tbody>${tareas.map((t) => `<tr><td class="mono">#${t.numero}</td><td>${esc(t.titulo)}</td><td>${esc(historiaDe(t.numero))}</td><td>${t.resueltaPor ? esc(miembro(t.resueltaPor).nombre) : '—'}</td><td class="mono">${t.pr ? `#${t.pr}` : '—'}</td></tr>`).join('')}</tbody>
</table>

<div class="firma">
  Informe preparado por ${esc(con.presenta.nombre)} (${esc(con.presenta.rol)}) con datos obtenidos de GitHub el ${esc(fechaLarga(local(met.generado).ymd))}: pull requests, revisiones y tablero del proyecto.
  Las cifras de pruebas y endpoints se midieron sobre el código ${release ? `del release <strong>${esc(release)}</strong>` : 'de <code>dev</code>'}.
</div>

</div></body></html>
`;

// ── escritura ────────────────────────────────────────────────────────────
const rutaPres = join(carpeta, 'presentacion.html');
const rutaInf = join(carpeta, 'informe.html');
const rutaPdf = join(carpeta, `Informe-Sprint-${NN}-ZeroBug.pdf`);
writeFileSync(rutaPres, presentacion);
writeFileSync(rutaInf, informe);
console.log(`OK → sprint-${NN}/presentacion.html (${diapositivas.length} diapositivas)`);
console.log(`OK → sprint-${NN}/informe.html`);

const navegador = ['chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome'].find((b) => {
  try { execFileSync('which', [b], { stdio: 'ignore' }); return true; } catch { return false; }
});
const chrome = (a) => execFileSync(navegador, ['--headless=new', '--disable-gpu', '--hide-scrollbars', ...a], { stdio: 'ignore', timeout: 90_000 });

if (!args.includes('--sin-pdf')) {
  if (!navegador) {
    console.warn('Aviso: no se encontró Chromium/Chrome; no se generó el PDF. Ábrelo y usa Imprimir → Guardar como PDF.');
  } else {
    rmSync(rutaPdf, { force: true });
    chrome(['--no-pdf-header-footer', '--virtual-time-budget=4000', `--print-to-pdf=${rutaPdf}`, pathToFileURL(rutaInf).href]);
    console.log(`OK → sprint-${NN}/Informe-Sprint-${NN}-ZeroBug.pdf`);
  }
}

if (args.includes('--capturas') && navegador) {
  const dir = join(TMP, 'capturas', `sprint-${NN}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  diapositivas.forEach((_, k) => {
    chrome(['--window-size=1440,900', '--virtual-time-budget=3000', `--screenshot=${join(dir, `slide-${String(k + 1).padStart(2, '0')}.png`)}`, `${pathToFileURL(rutaPres).href}?static#${k + 1}`]);
  });
  if (existsSync(rutaPdf)) execFileSync('pdftoppm', ['-png', '-r', '70', rutaPdf, join(dir, 'pdf')]);
  console.log(`Capturas → node_modules/.cache/informe-sprint/capturas/sprint-${NN}/`);
}
