# Retrospectiva Sprint 2 — 12 de octubre de 2026

> **Borrador** preparado por el Scrum Master a partir de los hechos del sprint (PRs, issues, dailys y Discord). No hubo reunión de retrospectiva: el cierre se movió al lunes, el mismo día en que arranca el Sprint 3. Se revisa con el equipo en la Planning del Sprint 3 y, si alguien no está de acuerdo con algo, se corrige aquí con un PR.

**Equipo:** @DylanSrz · @cesarvega1 · @MrDilant · @leonardo-200224 (equipo nuevo desde este sprint)

**Duración real del sprint:** 5 – 12 oct. Estaba planificado hasta el viernes 9; el cierre y el release se movieron al lunes 12 (ver _Incidencias_).

**Puntos comprometidos / completados:** 68 / 68 (velocidad: 68)

## Cómo llegamos

| HU                          | Pts | Responsable      | Tareas | Estado al cierre   |
| --------------------------- | --- | ---------------- | ------ | ------------------ |
| HU-006 Disponibilidad       | 13  | César            | 5/5    | Cerrada · `v0.2.0` |
| HU-007 Registro de reserva  | 13  | Dilant · Dylan   | 4/4    | Cerrada · `v0.2.0` |
| HU-008 Consulta de reserva  | 8   | Leonardo         | 2/2    | Cerrada · `v0.2.0` |
| HU-010 Cancelación          | 8   | Leonardo · Dylan | 2/2    | Cerrada · `v0.2.0` |
| HU-014 Registro de clientes | 13  | Dylan            | 4/4    | Cerrada · `v0.2.0` |
| HU-015 Inicio de sesión     | 13  | Dylan            | 3/3    | Cerrada · `v0.2.0` |

**Números del sprint:** 21 pull requests integrados en `dev` · 20 tareas cerradas · **475 pruebas automáticas** (274 unitarias + 201 e2e) · 30 endpoints documentados en Swagger · release `v0.2.0`.

**PRs por integrante:** Dylan 13 · César 4 · Dilant 2 · Leonardo 2.
**Revisiones de código:** Dylan 10 · Dilant 8.

Las cifras salen de `docs/informes-sprint/sprint-02/metricas.json` (ventana: del 5 de octubre al release `v0.2.0`).

Además se adelantaron piezas del Sprint 3: `RolesGuard` con `@Roles` y seed del primer ADMIN (HU-017) y la recuperación de contraseña (HU-018).

## Revisión de las acciones del Sprint 1

| Acción del Sprint 1                                    | Resultado                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Comprobar tras cada release que `dev` sigue existiendo | Cumplida: `v0.2.0` salió sin borrar `dev` y se sincronizó con `main` (#184)          |
| `git diff origin/dev...HEAD` antes de cada push        | Parcial: hubo PRs con archivos de otra rama mezclados (#172 traía los de #170)       |
| `git pull origin dev` antes de pedir review            | Parcial: varios PRs llegaron con conflictos o desactualizados                        |
| Sección de convenciones en el README                   | Cumplida, y además guías paso a paso por persona en Discord                          |
| Repartir las revisiones fuera del Scrum Master         | Mejoró: Dilant hizo 8 de las 18 revisiones; César y Leonardo, ninguna                |
| Checklist del PR con lo que realmente se ejecutó       | Parcial: un PR enlazó mal su issue (`Closes #<#54>`) y otro tenía un título genérico |

## Qué mantener

- **Decisiones de negocio escritas antes de implementar** (D-001 conflicto horario, D-002 usuarios, D-003 mesas). Las tres historias de reservas aplicaron la misma regla sin discutirla de nuevo.
- **Probar el estado combinado de las ramas antes de integrar.** Detectó a tiempo el enum de estados duplicado y la migración que dependía de una base local.
- **E2e contra PostgreSQL real, aislados con datos propios** (capacidades raras y fechas de 2099). Permitió probar la concurrencia de verdad: tres solicitudes simultáneas por dos mesas.
- **Guías paso a paso por tarea** en el canal de cada uno, con el código de referencia ya probado.
- **Revisión que corrige en la rama** en lugar de devolver el PR: ahorró rondas en sprints de una semana.

## Qué mejorar

- **PRs acumulados para el último día.** Cuatro llegaron entre el jueves por la noche y el viernes, y seis tareas no tenían PR al cierre del viernes. Con sprints de una semana no queda margen de revisión.
- **Avisar antes cuando una tarea no va a llegar.** Al vencer el plazo del domingo no había PR ni aviso en el canal; hubo que reasignar cuatro tareas el lunes.
- **Daily escrita constante.** El canal de dailys se usó el viernes y no los días siguientes.
- **Revisiones concentradas en dos personas.** César y Leonardo no revisaron ningún PR de otro compañero.
- **Finales de línea distintos en Windows.** Prettier fallaba al subir desde Windows porque el repositorio no fija LF.

## Incidencias

**Tareas sin entregar al vencer el plazo.** Al cierre del viernes 9 faltaban #59, #60 (HU-007) y #66, #67 (HU-010). Se fijó como plazo el domingo 11 a las 18:00 y a esa hora no tenían PR. El Scrum Master implementó las cuatro el lunes 12 (#179 a #182); las revisó e integró @MrDilant y el release `v0.2.0` salió esa noche (#183). Impacto: el cierre del sprint coincidió con el inicio del Sprint 3.

**Conflictos de integración entre ramas.** Dos ramas definieron por separado el enum de estados y una migración de la misma tabla; además, el guard JWT global dejó sin token las pruebas e2e del Sprint 1. Se unificó el enum, se regeneró la migración contra una base limpia y se creó el helper `authenticate` para las pruebas.

## Acciones

| Acción                                                                                             | Responsable    | Para cuándo     |
| -------------------------------------------------------------------------------------------------- | -------------- | --------------- |
| Daily escrita todos los días hábiles en 📅 dailys, con los bloqueos y lo que no va a llegar        | Todo el equipo | Desde el lun 12 |
| Abrir el PR en cuanto la tarea está lista; ninguna tarea del Sprint 3 llega sin PR al miércoles 14 | Todo el equipo | Sprint 3        |
| Cada integrante revisa al menos un PR de otro compañero por semana                                 | Todo el equipo | Sprint 3        |
| Confirmar en la Planning la capacidad real de cada uno para los 92 puntos del Sprint 3             | @DylanSrz      | Lun 12          |
| Tablero de PRs en 📡 repositorio a mitad de jornada y antes de la revisión de cierre               | @DylanSrz      | Sprint 3        |
| Fijar LF con `.gitattributes` para que Prettier no falle en Windows                                | @DylanSrz      | Lun 12          |
