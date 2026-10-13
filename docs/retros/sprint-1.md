# Retrospectiva Sprint 1 — 25 de septiembre de 2026

**Asistentes:** @DylanSrz · @Gonza204658 · @Kerin0011 · @rodriguezvjhona-droid · @jorel2610

**Duración real del sprint:** 18 – 24 sep (7 días naturales, 5 hábiles). Estaba planificado hasta el 2 de octubre; se cerró antes para acortar la cadencia a sprints de una semana. La Sprint Review y esta retrospectiva se celebraron el viernes 25 de septiembre.

**Puntos comprometidos / completados:** 55 / 55 (velocidad: 55)

## Cómo llegamos

| HU                     | Pts | Responsable   | Tareas | Estado al cierre   |
| ---------------------- | --- | ------------- | ------ | ------------------ |
| HU-001 Plataforma base | 8   | Dylan · Kerin | 7/7    | Cerrada · `v0.1.0` |
| HU-002 Mesas           | 13  | Diego         | 5/5    | Cerrada · `v0.1.0` |
| HU-003 Categorías      | 8   | Kerin         | 4/4    | Cerrada · `v0.1.0` |
| HU-004 Productos       | 13  | Dylan         | 4/4    | Cerrada · `v0.1.0` |
| HU-005 Menú público    | 13  | Jonathan      | 3/3    | Cerrada · `v0.1.0` |

**Números del sprint:** 33 pull requests integrados en `dev` · 33 tareas cerradas · **216 pruebas automáticas** (109 unitarias + 107 e2e) · 2.295 líneas de código de producción y 3.198 de pruebas · 21 endpoints documentados en Swagger (20 de dominio y el de estado del servicio) · release `v0.1.0`.

**PRs por integrante:** Dylan 18 · Diego 6 · Kerin 6 · Jonathan 2 · Jorel 1.
**Revisiones de código:** Dylan 30 · Kerin 2 · Diego 1.

Las cifras salen de `docs/informes-sprint/sprint-01/metricas.json` (ventana del sprint: todo lo integrado en `dev` hasta el release `v0.1.0`).

## Qué mantener

- **CI obligatorio desde el primer día.** Lint sin warnings, Prettier, build, unitarios y e2e contra PostgreSQL efímero en cada PR. Bloqueó merges con problemas reales varias veces.
- **Working Agreement y Definition of Done escritos antes de empezar a programar.** Cada discusión sobre proceso se resolvió citando el documento en vez de opinando.
- **Tests desde el principio, no al final.** Ninguna HU llegó a `dev` sin pruebas; los e2e corren contra PostgreSQL real, no contra mocks.
- **Formato uniforme de errores con trazabilidad a las reglas de negocio** (`rule: "RN-016"`). Hace que los criterios de aceptación se puedan verificar mirando la respuesta.
- **Tablero con jerarquía épica → historia → tarea.** Permitió repartir una HU entre varias personas sin pisarse.

## Qué mejorar

- **PRs apuntando a `main` en lugar de `dev`** (dos veces). GitHub propone `main` por defecto y el diff pasa a mostrar 80+ commits, lo que esconde el cambio real.
- **Checklists del PR marcados sin ser ciertos.** Varios PRs declaraban tests o migraciones que no existían. El revisor se apoya en esa casilla.
- **Cambios que tocan archivos de otros compañeros sin querer**: stubs inyectados en `categories.service.ts` y `products.service.ts`, y un spec e2e ajeno sobrescrito.
- **Ramas creadas desde ramas viejas.** El CI pasa en verde en la rama aislada, pero al integrar aparecen conflictos e imports rotos.
- **Concentración del trabajo y de las revisiones en el Scrum Master**: 18 de 33 PRs y 30 de 33 revisiones. Es normal en el arranque (plataforma base), pero no es sostenible ni reparte el conocimiento.
- **Convenciones descubiertas tarde**: rutas con el prefijo duplicado, nombres en singular, excepciones genéricas en vez de las del proyecto. Se corrigieron en revisión, pero costaron rondas.
- **Cambios de configuración del repositorio sin anticipar su efecto**: el borrado automático de ramas eliminó `dev` al publicar el release (ver _Incidencias_).

## Incidencias

**Rama `dev` eliminada al publicar el release.** Al mergear el PR de release #158 (`dev → main`) el 24 de septiembre, el borrado automático de ramas —activado ese mismo día para limpiar las ramas ya integradas— eliminó también `dev`, porque era la rama de origen del PR. No se perdió trabajo (todo estaba en `main`), pero durante un día no se pudieron abrir PRs hacia `dev`. Se restauró el 25 de septiembre desde el release y se desactivó el borrado automático.

## Acciones

| Acción                                                                                                                                  | Responsable    | Para cuándo    |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------- |
| Desactivar el borrado automático de ramas y comprobar tras cada release que `dev` sigue existiendo                                      | @DylanSrz      | Hecho (25 sep) |
| Limpiar ramas con `gh pr merge --delete-branch` solo en PRs de feature, nunca en el PR de release                                       | Todo el equipo | Desde hoy      |
| Antes de cada push: `git diff origin/dev...HEAD` y revisar que no aparezcan archivos ajenos                                             | Todo el equipo | Desde hoy      |
| Antes de pedir review: `git pull origin dev` en la rama, y levantar la app (`npm run start:dev`)                                        | Todo el equipo | Desde hoy      |
| Añadir al README una sección corta de "convenciones que más se olvidan" (ruta sin prefijo, nombres en plural, excepciones del proyecto) | @DylanSrz      | Sprint 2       |
| Repartir las revisiones: cada PR lo revisa alguien distinto al Scrum Master siempre que sea posible                                     | Todo el equipo | Desde hoy      |
| Rellenar el checklist del PR con lo que realmente se ejecutó; si algo no aplica, escribirlo                                             | Todo el equipo | Desde hoy      |

## Cambio de cadencia acordado

A partir del Sprint 2 los sprints duran **una semana, de lunes a viernes**. El Sprint 2 va del jueves 24 de septiembre al viernes 2 de octubre y su Planning se hace el viernes 25, en la misma reunión que esta retrospectiva; a partir del Sprint 3 la cadencia queda alineada al lunes.

Consecuencia directa: la capacidad por sprint se reduce a la mitad, así que el alcance comprometido baja en la misma proporción. El Sprint 2 compromete 34 puntos (HU-006, HU-007 y HU-008) en lugar de los 79 planificados originalmente para las dos semanas de reservas.
