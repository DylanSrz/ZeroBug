# Retrospectiva Sprint 1 — 24 de septiembre de 2026

**Asistentes:** @DylanSrz · @Gonza204658 · @Kerin0011 · @rodriguezvjhona-droid · @jorel2610

**Duración real del sprint:** 18 – 24 sep (7 días naturales, 5 hábiles). Estaba planificado hasta el 2 de octubre; se cerró antes para acortar la cadencia a sprints de una semana.

**Puntos comprometidos / completados:** 55 / \_\_ (se rellena tras la verificación de la Review)

## Cómo llegamos

| HU                     | Pts | Responsable   | Tareas | Estado al cierre |
| ---------------------- | --- | ------------- | ------ | ---------------- |
| HU-001 Plataforma base | 8   | Dylan · Kerin | 7/7    | Cerrada          |
| HU-002 Mesas           | 13  | Diego         | 5/5    | Código en `dev`  |
| HU-003 Categorías      | 8   | Kerin         | 4/4    | Código en `dev`  |
| HU-004 Productos       | 13  | Dylan         | 4/4    | Código en `dev`  |
| HU-005 Menú público    | 13  | Jonathan      | 3/3    | Código en `dev`  |

**Números del sprint:** 31 pull requests mergeados · 30+ issues cerradas · **216 tests automáticos** (109 unitarios + 107 e2e) · 2.135 líneas de código de producción y 2.916 de pruebas · 5 módulos de dominio con 20 endpoints documentados en Swagger.

**PRs por integrante:** Dylan 16 · Diego 6 · Kerin 6 · Jonathan 2 · Jorel 1.

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
- **Concentración del trabajo y de las revisiones en el Scrum Master**: 16 de 31 PRs y 26 de 30 revisiones. Es normal en el arranque (plataforma base), pero no es sostenible ni reparte el conocimiento.
- **Convenciones descubiertas tarde**: rutas con el prefijo duplicado, nombres en singular, excepciones genéricas en vez de las del proyecto. Se corrigieron en revisión, pero costaron rondas.

## Acciones

| Acción                                                                                                                                  | Responsable    | Para cuándo |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------- |
| Activar el borrado automático de ramas al mergear (quedan 30 ramas muertas)                                                             | @DylanSrz      | Hoy         |
| Antes de cada push: `git diff origin/dev...HEAD` y revisar que no aparezcan archivos ajenos                                             | Todo el equipo | Desde hoy   |
| Antes de pedir review: `git pull origin dev` en la rama, y levantar la app (`npm run start:dev`)                                        | Todo el equipo | Desde hoy   |
| Añadir al README una sección corta de "convenciones que más se olvidan" (ruta sin prefijo, nombres en plural, excepciones del proyecto) | @DylanSrz      | Sprint 2    |
| Repartir las revisiones: cada PR lo revisa alguien distinto al Scrum Master siempre que sea posible                                     | Todo el equipo | Desde hoy   |
| Rellenar el checklist del PR con lo que realmente se ejecutó; si algo no aplica, escribirlo                                             | Todo el equipo | Desde hoy   |

## Cambio de cadencia acordado

A partir del Sprint 2 los sprints duran **una semana, de lunes a viernes**. El Sprint 2 arranca hoy jueves 24 de septiembre y cierra el viernes 2 de octubre; a partir del Sprint 3 la cadencia queda alineada al lunes.

Consecuencia directa: la capacidad por sprint se reduce a la mitad, así que el alcance comprometido tiene que bajar en la misma proporción. Se revisa en el Planning de hoy.
