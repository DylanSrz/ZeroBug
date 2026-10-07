# Decisiones del equipo

Registro de decisiones de negocio y de diseño que afectan a varias historias. Cada una dice qué se decidió, por qué y dónde vive en el código. Si una decisión cambia, se añade una nueva que la reemplace; las anteriores no se borran.

## D-001 — Conflicto horario y parámetros de las reservas

**Fecha:** 7 de octubre de 2026 · **Sprint:** 2 · **Issue:** #53 · **Historias afectadas:** HU-006, HU-007, HU-009, HU-012, HU-013

### Decisión

1. **Duración de una reserva: 120 minutos.** Una reserva ocupa la mesa desde su hora de inicio hasta 120 minutos después. Se configura con `RESERVATION_DURATION_MINUTES` (entre 15 y 720).
2. **Tolerancia de no-show: 15 minutos.** Una reserva solo puede marcarse como `NO_SHOW` cuando han pasado 15 minutos desde su hora de inicio sin check-in (RN-078). Se configura con `RESERVATION_NO_SHOW_TOLERANCE_MINUTES` (entre 0 y 120).
3. **Conflicto horario.** Dos reservas de la **misma mesa** entran en conflicto si sus intervalos se solapan, tomando cada intervalo como `[inicio, inicio + duración)`, y la reserva existente está en un estado que bloquea la mesa: `PENDING`, `CONFIRMED` o `CHECKED_IN`. Las reservas `CANCELLED`, `NO_SHOW` y `COMPLETED` no bloquean.
   - En SQL: `existente.inicio < nueva.inicio + duración AND nueva.inicio < existente.inicio + duración`.
   - El intervalo es semiabierto: una reserva de 18:00 y otra de 20:00 en la misma mesa **no** chocan.
4. **Horario de atención: no se valida por ahora.** Cualquier fecha y hora futura es aceptable. Si se añade, será una decisión nueva.

### Por qué

- Las reglas RN-040 (disponibilidad) y RN-045 (asignación) hablan de "conflicto de horario" sin definirlo; sin una definición única, cada historia lo implementaría distinto.
- Una duración fija es suficiente para el alcance del proyecto y evita pedir al cliente la hora de salida. Al ser configurable, se puede ajustar sin tocar el código.

### Dónde vive

- Variables: `src/config/env.validation.schema.ts` (validación y valores por defecto), `.env.example` y la tabla de variables del `README.md`.
- Lectura desde el código: `ConfigService` → `reservations.durationMinutes` y `reservations.noShowToleranceMinutes` (`src/config/env.config.ts`). No se escriben los números en los services.
