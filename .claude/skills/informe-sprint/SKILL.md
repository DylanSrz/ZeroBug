---
name: informe-sprint
description: Prepara el informe semanal de sprint de ZeroBug para el Team Leader (Abrahan Villa) — presentación HTML interactiva navegable con flechas y documento PDF, con el trabajo de cada integrante — en docs/informes-sprint/sprint-NN/. Usar cuando se pida el informe del viernes, el informe del sprint, la presentación semanal o el PDF para el Team Leader.
---

# Informe semanal de sprint

Cada viernes, al cierre del sprint (lunes a viernes), Dylan entrega a **Abrahan Villa** (Team Leader) un informe de lo que el equipo trabajó en el sprint: una **presentación HTML interactiva** para exponer y un **documento PDF** para entregar. Todo vive en `docs/informes-sprint/sprint-NN/` y se genera con las herramientas de esa carpeta. Lee `docs/informes-sprint/README.md` para el detalle de cada archivo.

## Procedimiento

1. **Identifica el sprint.** Es el que cierra esa semana (milestone `Sprint N — …`). Si hay duda, pregúntalo antes de empezar.

2. **Números.** `node docs/informes-sprint/recolectar.mjs N`
   - Necesita el árbol sin cambios en archivos versionados (hace checkout temporal del release para contar pruebas y vuelve a la rama). Si hay cambios, avisa en lugar de descartarlos.
   - Si todavía no existe el tag `v0.N.0`, la ventana llega hasta ahora y el código se mide en `dev`: dilo en el borrador, y vuelve a generarlo tras el release si Dylan lo pide.
   - Revisa `metricas.json`: tareas con `resueltaPor: null` se atribuyen en `contenido.json → ajustesTareas` con el PR que realmente las resolvió (compruébalo en GitHub; no adivines por el asignado).

3. **Textos.** Crea `sprint-NN/contenido.json` partiendo del sprint anterior. Fuentes: la issue de ceremonias del sprint, el acta `docs/retros/sprint-N.md`, las historias del milestone, los PRs de cada integrante y el milestone del siguiente sprint.
   - `titular` corto (una línea); `resultado` sin repetir el titular.
   - Aporte de cada integrante: hechos verificables (qué historia, qué entregó, cuántas pruebas), tono neutral. Nada de adjetivos ni comparaciones entre personas.
   - "Qué mejorar" se redacta a nivel de equipo, sin nombres.
   - Las incidencias del sprint (algo que se rompió, un bloqueo) se incluyen siempre en `incidencias`: qué pasó, impacto y solución, sin culpar a nadie.
   - Muestra el reparto real del trabajo tal cual, y atribuye cada tarea a quien hizo el PR aunque estuviera asignada a otra persona (criterios aprobados por Dylan en el Sprint 1).
   - Ningún número escrito a mano que pueda salir de `metricas.json`.

4. **Genera.** `node docs/informes-sprint/generar.mjs N --capturas`

5. **Verifica antes de entregar** — no des el informe por bueno sin esto:
   - Mira las capturas de **todas** las diapositivas y páginas del PDF (`node_modules/.cache/informe-sprint/capturas/sprint-NN/`) buscando texto cortado, solapes, cajas vacías o tablas partidas.
   - `pdfinfo` y `pdftotext` sobre el PDF: número de páginas, pie "Página X de Y", sin texto perdido.
   - Si cambió `plantilla/presentacion.js`, ejecuta la prueba de interacción descrita en `plantilla/prueba-interaccion.html`: todas las líneas deben salir en OK.

6. **Entrega un borrador y espera la aprobación de Dylan.** Resume qué contiene, qué decisiones de redacción tomaste y qué datos conviene que él confirme. No sigas hasta que apruebe o pida cambios.

7. **Tras la aprobación**, dale los comandos para commitear en una rama `docs/informe-sprint-NN` y abrir el PR hacia `dev`. **Tú no haces commit ni push.**

## Reglas

- **No rediseñes cada semana.** El diseño lo dan `plantilla/presentacion.css`, `plantilla/presentacion.js` e `plantilla/informe.css` (tema oscuro ámbar/teal aprobado por Dylan). Una mejora se hace en la plantilla y se aplica a los sprints siguientes; no regeneres informes ya entregados.
- La presentación debe seguir siendo **un solo archivo sin dependencias externas** (se abre sin internet) y navegable con flechas, `O` (vista general), `?` (atajos) y `F` (pantalla completa).
- Colores de integrante: los de `equipo.json`, siempre acompañados de iniciales o nombre (nunca el color solo).
- Los archivos temporales van en `node_modules/.cache/informe-sprint/`, nunca en `/tmp` ni sueltos en el repo.
- Si cambia el equipo o el destinatario, se edita `equipo.json`, no los scripts.
