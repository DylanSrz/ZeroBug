#!/usr/bin/env node
/**
 * Recolecta las métricas de un sprint desde GitHub, git y Vitest, y las deja en
 * docs/informes-sprint/sprint-NN/metricas.json. Ese archivo es la única fuente de
 * los números del informe: no se edita a mano.
 *
 * Uso:
 *   node docs/informes-sprint/recolectar.mjs <sprint> [--desde=ISO] [--hasta=ISO]
 *
 * Ventana del sprint (lo que "entró" en el sprint):
 *   - desde: fecha del commit etiquetado con el release anterior (v0.<N-1>.0).
 *            Para el Sprint 1, desde el inicio del repositorio.
 *   - hasta: fecha del commit etiquetado con el release del sprint (v0.<N>.0).
 *            Si el release aún no existe, hasta ahora.
 * Se cuentan los PRs mergeados a `dev` dentro de esa ventana y las revisiones
 * hechas en ella. Los tests y endpoints se miden en el código del release (o en
 * `dev` si todavía no hay release).
 *
 * Requiere: gh autenticado, y el árbol de trabajo sin cambios en archivos
 * versionados (para poder medir los tests en el commit del release).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const TMP = join(RAIZ, 'node_modules', '.cache', 'informe-sprint');
const equipo = JSON.parse(readFileSync(join(AQUI, 'equipo.json'), 'utf8'));
const [OWNER, NAME] = equipo.repositorio.split('/');

// ── argumentos ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const numero = Number(args.find((a) => /^\d+$/.test(a)));
if (!numero) {
  console.error('Uso: node docs/informes-sprint/recolectar.mjs <sprint> [--desde=ISO] [--hasta=ISO]');
  process.exit(1);
}
const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split('=')[1];
const carpeta = join(AQUI, `sprint-${String(numero).padStart(2, '0')}`);

// ── utilidades ───────────────────────────────────────────────────────────────
const sh = (cmd, a) =>
  execFileSync(cmd, a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const git = (...a) => sh('git', a).trim();
const graphql = (query, variables = {}) => {
  const vars = Object.entries(variables).flatMap(([k, v]) =>
    v === null || v === undefined ? [] : [typeof v === 'number' ? '-F' : '-f', `${k}=${v}`],
  );
  const res = JSON.parse(sh('gh', ['api', 'graphql', '-f', `query=${query}`, ...vars]));
  if (res.errors) throw new Error(JSON.stringify(res.errors));
  return res.data;
};
const fechaDeRef = (ref) => {
  try {
    return git('log', '-1', '--format=%cI', ref);
  } catch {
    return null;
  }
};
const loginDe = (autor) => {
  if (!autor) return null;
  const miembro = equipo.integrantes.find((m) => m.login === autor || (m.alias ?? []).includes(autor));
  return miembro ? miembro.login : autor;
};
const enVentana = (fecha, desde, hasta) => {
  const t = Date.parse(fecha);
  return (!desde || t > Date.parse(desde)) && t <= Date.parse(hasta);
};

// ── ventana del sprint ───────────────────────────────────────────────────────
try {
  git('fetch', '-q', '--tags', 'origin');
} catch {
  console.warn('Aviso: no se pudo hacer fetch de tags; se usan los locales.');
}
const tagAnterior = numero > 1 ? `v0.${numero - 1}.0` : null;
const tagSprint = `v0.${numero}.0`;
const fechaTagAnterior = tagAnterior ? fechaDeRef(tagAnterior) : null;
const fechaTagSprint = fechaDeRef(tagSprint);
if (tagAnterior && !fechaTagAnterior && !opcion('desde')) {
  console.warn(`Aviso: no existe ${tagAnterior}; sin --desde la ventana empieza en el inicio del repo.`);
}
const desde = opcion('desde') ?? fechaTagAnterior;
const hasta = opcion('hasta') ?? fechaTagSprint ?? new Date().toISOString();
const refCodigo = fechaTagSprint
  ? tagSprint
  : ['origin/dev', 'dev', 'HEAD'].find((r) => fechaDeRef(r)) ?? 'HEAD';
console.log(`Sprint ${numero}: desde ${desde ?? 'el inicio'} hasta ${hasta} · código medido en ${refCodigo}`);

// ── pull requests con revisiones ─────────────────────────────────────────────
const QUERY_PRS = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url state baseRefName headRefName mergedAt additions deletions body
        author { login }
        reviews(first: 50) { nodes { id author { login } state submittedAt } }
        timelineItems(first: 30, itemTypes: [REVIEW_DISMISSED_EVENT]) {
          nodes { ... on ReviewDismissedEvent { previousReviewState review { id } } }
        }
      }
    }
  }
}`;
const prs = [];
for (let cursor = null; ; ) {
  const page = graphql(QUERY_PRS, { owner: OWNER, name: NAME, cursor }).repository.pullRequests;
  prs.push(...page.nodes);
  if (!page.pageInfo.hasNextPage) break;
  cursor = page.pageInfo.endCursor;
}

const REF_TAREA = /\b(?:closes|close|closed|fixes|fix|fixed|resolves|resolve|resolved)\s+#(\d+)/gi;
const prsSprint = prs
  .filter((p) => p.state === 'MERGED' && p.baseRefName === 'dev' && enVentana(p.mergedAt, desde, hasta))
  .sort((a, b) => Date.parse(a.mergedAt) - Date.parse(b.mergedAt))
  .map((p) => ({
    numero: p.number,
    titulo: p.title,
    url: p.url,
    autor: loginDe(p.author?.login),
    mergedAt: p.mergedAt,
    adiciones: p.additions,
    eliminaciones: p.deletions,
    tareas: [...new Set([...(p.body ?? '').matchAll(REF_TAREA)].map((m) => Number(m[1])))],
  }));

// Revisiones hechas dentro de la ventana, en cualquier PR, sin contar las del
// propio autor. Una revisión descartada se clasifica por su estado original.
const revisiones = {};
for (const p of prs) {
  const estadoOriginal = new Map(
    p.timelineItems.nodes.filter((e) => e.review).map((e) => [e.review.id, e.previousReviewState]),
  );
  for (const r of p.reviews.nodes) {
    const quien = loginDe(r.author?.login);
    if (!quien || !r.submittedAt || quien === loginDe(p.author?.login)) continue;
    if (!enVentana(r.submittedAt, desde, hasta)) continue;
    const estado = r.state === 'DISMISSED' ? estadoOriginal.get(r.id) ?? 'DISMISSED' : r.state;
    const c = (revisiones[quien] ??= { total: 0, aprobadas: 0, cambios: 0, comentarios: 0, prs: [] });
    c.total += 1;
    if (estado === 'APPROVED') c.aprobadas += 1;
    else if (estado === 'CHANGES_REQUESTED') c.cambios += 1;
    else c.comentarios += 1;
    if (!c.prs.includes(p.number)) c.prs.push(p.number);
  }
}

// ── milestone del sprint: historias y tareas ─────────────────────────────────
const milestones = JSON.parse(sh('gh', ['api', `repos/${OWNER}/${NAME}/milestones?state=all&per_page=100`]));
const milestone = milestones.find((m) => new RegExp(`^Sprint ${numero}\\b`).test(m.title));
if (!milestone) throw new Error(`No hay milestone "Sprint ${numero} …"`);

const QUERY_MILESTONE = `
query($owner: String!, $name: String!, $numero: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    milestone(number: $numero) {
      issues(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title state closedAt
          parent { number }
          labels(first: 10) { nodes { name } }
          assignees(first: 5) { nodes { login } }
          projectItems(first: 3) {
            nodes { fieldValueByName(name: "Story Points") { ... on ProjectV2ItemFieldNumberValue { number } } }
          }
        }
      }
    }
  }
}`;
const issuesMilestone = [];
for (let cursor = null; ; ) {
  const page = graphql(QUERY_MILESTONE, { owner: OWNER, name: NAME, numero: milestone.number, cursor }).repository
    .milestone.issues;
  issuesMilestone.push(...page.nodes);
  if (!page.pageInfo.hasNextPage) break;
  cursor = page.pageInfo.endCursor;
}
const etiquetas = (i) => i.labels.nodes.map((l) => l.name);
const puntos = (i) => i.projectItems.nodes.map((n) => n.fieldValueByName?.number).find((x) => x != null) ?? null;

const historias = issuesMilestone
  .filter((i) => etiquetas(i).includes('historia'))
  .sort((a, b) => a.number - b.number)
  .map((i) => ({
    numero: i.number,
    titulo: i.title,
    estado: i.state,
    cerrada: i.closedAt,
    puntos: puntos(i),
    asignados: i.assignees.nodes.map((a) => loginDe(a.login)),
  }));

// Quién resolvió cada tarea: el autor del PR que la referencia con Closes/Fixes.
// Si ningún PR la referencia, queda sin autor (no se adivina por el asignado).
const resueltaPor = new Map();
for (const p of prsSprint) for (const t of p.tareas) if (!resueltaPor.has(t)) resueltaPor.set(t, p);
const tareas = issuesMilestone
  .filter((i) => !etiquetas(i).includes('historia'))
  .sort((a, b) => a.number - b.number)
  .map((i) => ({
    numero: i.number,
    titulo: i.title,
    estado: i.state,
    etiquetas: etiquetas(i),
    historia: i.parent?.number ?? null,
    asignados: i.assignees.nodes.map((a) => loginDe(a.login)),
    resueltaPor: resueltaPor.get(i.number)?.autor ?? null,
    pr: resueltaPor.get(i.number)?.numero ?? null,
  }));

// ── tests y endpoints en el código del sprint ────────────────────────────────
function medirCodigo(ref) {
  const modulos = git('ls-tree', '--name-only', `${ref}:src/modules`).split('\n').filter(Boolean);
  const moduloDe = (archivo) => {
    const m = archivo.match(/src\/modules\/([^/]+)\//) ?? archivo.match(/test\/([a-z-]+)\.e2e-spec\.ts$/);
    return m && modulos.includes(m[1]) ? m[1] : 'plataforma';
  };

  const endpoints = { total: 0, porModulo: {} };
  const archivos = git('ls-tree', '-r', '--name-only', ref, 'src').split('\n');
  for (const f of archivos.filter((a) => /\.controller\.ts$/.test(a) && a.includes('src/modules/'))) {
    const n = (git('show', `${ref}:${f}`).match(/^\s*@(Get|Post|Patch|Put|Delete)\(/gm) ?? []).length;
    endpoints.total += n;
    endpoints.porModulo[moduloDe(f)] = (endpoints.porModulo[moduloDe(f)] ?? 0) + n;
  }

  // Vitest necesita los archivos en disco: se hace checkout temporal del commit
  // si hace falta, y siempre se vuelve a donde estaba.
  const tests = { unit: null, e2e: null, porModulo: {} };
  const actual = git('rev-parse', 'HEAD');
  const objetivo = git('rev-parse', `${ref}^{commit}`);
  const rama = git('rev-parse', '--abbrev-ref', 'HEAD');
  const sucio = git('status', '--porcelain', '--untracked-files=no').length > 0;
  if (actual !== objetivo && sucio) {
    console.warn('Aviso: hay cambios sin commitear en archivos versionados; no se cuentan los tests.');
    return { endpoints, tests };
  }
  mkdirSync(TMP, { recursive: true });
  try {
    if (actual !== objetivo) git('checkout', '-q', '--detach', objetivo);
    for (const [tipo, extra] of [['unit', []], ['e2e', ['--config', './vitest.config.e2e.ts']]]) {
      const salida = join(TMP, `vitest-${tipo}.json`);
      rmSync(salida, { force: true });
      try {
        sh('npx', ['vitest', 'list', ...extra, `--json=${salida}`]);
      } catch {
        // vitest list sale con código ≠ 0 si algún archivo no carga; el JSON sigue siendo útil
      }
      const lista = JSON.parse(readFileSync(salida, 'utf8'));
      tests[tipo] = lista.length;
      for (const t of lista) {
        const m = moduloDe(t.file);
        tests.porModulo[m] ??= { unit: 0, e2e: 0 };
        tests.porModulo[m][tipo] += 1;
      }
    }
  } finally {
    if (git('rev-parse', 'HEAD') !== actual) git('checkout', '-q', rama === 'HEAD' ? actual : rama);
  }
  return { endpoints, tests };
}
const { endpoints, tests } = medirCodigo(refCodigo);

// ── resumen por integrante ───────────────────────────────────────────────────
const porIntegrante = {};
for (const m of equipo.integrantes) {
  porIntegrante[m.login] = {
    prs: prsSprint.filter((p) => p.autor === m.login).map((p) => p.numero),
    tareas: tareas.filter((t) => t.resueltaPor === m.login).map((t) => t.numero),
    revisiones: revisiones[m.login] ?? { total: 0, aprobadas: 0, cambios: 0, comentarios: 0, prs: [] },
    historias: historias.filter((h) => h.asignados.includes(m.login)).map((h) => h.numero),
  };
}

const metricas = {
  generado: new Date().toISOString(),
  sprint: numero,
  ventana: { desde, hasta, tagAnterior: fechaTagAnterior ? tagAnterior : null, release: fechaTagSprint ? tagSprint : null, codigoMedidoEn: refCodigo },
  milestone: { numero: milestone.number, titulo: milestone.title, vence: milestone.due_on },
  totales: {
    prs: prsSprint.length,
    revisiones: Object.values(revisiones).reduce((s, r) => s + r.total, 0),
    historias: historias.length,
    historiasCerradas: historias.filter((h) => h.estado === 'CLOSED').length,
    puntosComprometidos: historias.reduce((s, h) => s + (h.puntos ?? 0), 0),
    puntosCompletados: historias.filter((h) => h.estado === 'CLOSED').reduce((s, h) => s + (h.puntos ?? 0), 0),
    tareas: tareas.length,
    tareasCerradas: tareas.filter((t) => t.estado === 'CLOSED').length,
    adiciones: prsSprint.reduce((s, p) => s + p.adiciones, 0),
    eliminaciones: prsSprint.reduce((s, p) => s + p.eliminaciones, 0),
  },
  historias,
  tareas,
  prs: prsSprint,
  revisiones,
  porIntegrante,
  tests,
  endpoints,
};

mkdirSync(carpeta, { recursive: true });
writeFileSync(join(carpeta, 'metricas.json'), JSON.stringify(metricas, null, 2) + '\n');
const t = metricas.totales;
console.log(
  `OK → ${join('docs/informes-sprint', `sprint-${String(numero).padStart(2, '0')}`, 'metricas.json')}\n` +
    `   ${t.prs} PRs · ${t.revisiones} revisiones · ${t.historiasCerradas}/${t.historias} HU · ` +
    `${t.puntosCompletados}/${t.puntosComprometidos} pts · ${t.tareasCerradas}/${t.tareas} tareas · ` +
    `tests ${tests.unit ?? '?'} unit + ${tests.e2e ?? '?'} e2e · ${endpoints.total} endpoints`,
);
