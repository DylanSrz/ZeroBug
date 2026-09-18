# 🤝 Working Agreement y Definition of Done — ZeroBug

> **Qué es este documento:** las reglas que el equipo acordó para trabajar junto durante el proyecto. Complementa a [`guia-git.md`](guia-git.md) (que manda en todo lo relacionado con Git). Se revisa en cada Retrospectiva; cualquier cambio se propone como PR a este archivo.
>
> **Vigente desde:** Sprint 1 (21 sep 2026). Firmado por todos los integrantes en la issue #98.

---

## 1. Equipo y roles

| Rol          | Quién                                                           | Responsabilidad                                                                        |
| ------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Scrum Master | @DylanSrz                                                       | Facilita ceremonias, mantiene el tablero, quita bloqueos, coordina merges `dev → main` |
| Developers   | @Gonza204658 · @Kerin0011 · @rodriguezvjhona-droid · @jorel2610 | Diseñan, implementan, prueban y revisan                                                |

No hay Product Owner externo: las historias de usuario en `docs/` son el contrato. Las dudas funcionales se resuelven en equipo y se registran como comentario en la HU.

## 2. Sprints

| Sprint | Fechas              | Meta                                                                                  |
| ------ | ------------------- | ------------------------------------------------------------------------------------- |
| 1      | 21 sep – 2 oct 2026 | Plataforma base (HU-001) + mesas, categorías, productos y menú público (HU-002 … 005) |
| 2      | 5 – 16 oct 2026     | Ciclo completo de reservas (HU-006 … 013)                                             |
| 3      | 19 – 30 oct 2026    | Usuarios, login JWT, roles y perfil (HU-014 … 019)                                    |
| 4      | 2 – 13 nov 2026     | Pedidos (HU-020 …)                                                                    |

Sprints de **2 semanas**, de lunes a viernes de la segunda semana. El alcance comprometido en el Planning no se amplía a mitad de sprint; lo que no cabe vuelve al _Backlog_ con un comentario.

## 3. Ceremonias

| Ceremonia           | Cuándo                                                                    | Duración | Qué se hace                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint Planning** | Lunes de inicio de sprint                                                 | ≤ 1 h    | Confirmar capacidad real (parciales, otras materias), fijar el Sprint Goal, mover HU y tareas de _Backlog_ a _Sprint Backlog_, asignar las primeras tareas |
| **Daily**           | Todos los días hábiles, **hora: _a definir en el Planning del Sprint 1_** | ≤ 15 min | Cada uno: qué hice, qué haré, qué me bloquea. Se revisan issues `bloqueada` y PRs sin revisor                                                              |
| **Sprint Review**   | Viernes de cierre                                                         | ≤ 45 min | Demo de cada HU terminada contra sus criterios de aceptación (Swagger); merge `dev → main` y tag `v0.N.0`                                                  |
| **Retrospectiva**   | Viernes de cierre, tras la Review                                         | ≤ 30 min | Qué mantener / qué mejorar / acciones con responsable. Acta en `docs/retros/sprint-N.md`                                                                   |

Si alguien no puede asistir a la Daily, deja su actualización por escrito en el canal antes de la hora.

## 4. Tablero

Tablero: <https://github.com/users/DylanSrz/projects/7>

```text
Backlog → Sprint Backlog → In Progress → In Review → Done
```

| Columna            | Significa                                     | Quién mueve                                     |
| ------------------ | --------------------------------------------- | ----------------------------------------------- |
| **Backlog**        | Refinado, no comprometido en ningún sprint    | Scrum Master                                    |
| **Sprint Backlog** | Comprometido en el sprint actual, sin empezar | Scrum Master (en el Planning)                   |
| **In Progress**    | Alguien está trabajando en ello               | Quien la toma: **se asigna** y la mueve         |
| **In Review**      | Hay PR abierto esperando revisión             | El autor al abrir el PR                         |
| **Done**           | Mergeado en `dev`, issue cerrada              | Quien mergea (se mueve sola al cerrar la issue) |

Reglas:

- **Máximo 2 issues _In Progress_ por persona.** Terminar antes de empezar.
- Una issue sin asignado no se toca; si quieres tomarla, asígnatela primero.
- Jerarquía: _Épica → Historia de usuario (HU) → Tareas_. Se trabaja sobre **tareas**; la HU se cierra cuando todas sus tareas están _Done_ y se cumplió su DoD (§7).
- Los Story Points van en las HU (Fibonacci: 1, 2, 3, 5, 8, 13). Las tareas no se puntúan.

## 5. Ramas, commits y Pull Requests

Todo según [`guia-git.md`](guia-git.md). Resumen de lo no negociable:

- `main` y `dev` están protegidas: **nadie hace push directo**. Todo entra por PR hacia `dev`; `dev → main` solo lo hace el Scrum Master al cierre del sprint.
- **Una tarea = una rama = un PR.** Rama desde `dev` actualizado, nombre sugerido en la issue.
- **PR pequeño**: objetivo ≤ 300 líneas de código (sin contar `package-lock.json`). Si crece, se parte.
- El PR usa la plantilla completa; la sección **"Cómo probar estos cambios" es obligatoria** y `Closes #N` enlaza la issue.
- El PR **apunta a `dev`** (GitHub propone `main`; revisar siempre).
- Antes de pedir review: `npm run lint:ci && npm run format:check && npm run build && npm run test && npm run test:e2e` en verde en local. CI lo repite y bloquea el merge si falla.
- Commits con formato `tipo: descripción en minúsculas` (`feat`, `fix`, `docs`, `refactor`, `chore`, `style`, `test`).

## 6. Revisión de código

- **1 aprobación obligatoria** de alguien distinto al autor (lo exige el ruleset). El autor asigna el revisor al abrir el PR.
- **Tiempo máximo de respuesta a un review: 24 h hábiles.** Si no puedes, dilo en el canal para que otro lo tome.
- El revisor **ejecuta los pasos de "Cómo probar"**, no solo lee el diff. Aprobar es responder por ese código.
- Comentarios en la línea concreta, con propuesta. Tono: se revisa el código, no a la persona.
- `Request changes` solo por errores funcionales, tests faltantes o incumplimiento del DoD; los detalles de estilo van como `Comment`.
- Los hilos de revisión deben resolverse antes del merge (lo exige el ruleset).
- **Quien mergea**: verifica que CI está en verde, mergea, **cierra la issue a mano** (el `Closes` no actúa hasta llegar a `main`) y confirma que la tarjeta pasó a _Done_.
- Un PR puede apilarse sobre otro (rama sobre rama) cuando depende de él; se indica en la descripción y se mergean en orden.

## 7. Definition of Done

### Por tarea (issue con etiqueta `tarea` / `técnica` / `docs`)

- [ ] El código está en `dev` mediante PR aprobado con CI en verde.
- [ ] Hay **tests** para la lógica nueva: unitarios para services/utilidades, e2e para endpoints.
- [ ] `npm run lint:ci` sin warnings y `npm run format:check` limpio.
- [ ] Los endpoints nuevos o modificados están en **Swagger** (`@ApiTags`, respuestas documentadas).
- [ ] Si cambió el esquema de base de datos: **migración versionada** en el mismo PR, con `import type` de TypeORM.
- [ ] Si cambió la configuración: `.env.example` y `README.md` actualizados.
- [ ] Los checkboxes de _Alcance_ de la issue están marcados.
- [ ] La issue está cerrada y la tarjeta en _Done_.

### Por historia de usuario (issue con etiqueta `historia`)

- [ ] Todas sus tareas están _Done_.
- [ ] Los **criterios de aceptación** de la HU fueron verificados manualmente en `dev` (Swagger/Postman) por **alguien distinto al autor principal**, marcando los checkboxes de la issue.
- [ ] Las reglas de negocio (RN-xxx) tienen al menos un test que las cubre.
- [ ] Demostrada en la **Sprint Review**.

## 8. Bloqueos

- Si una tarea no puede avanzar: etiqueta **`bloqueada`** + comentario en la issue con la causa y qué se necesita.
- Se levanta en la siguiente Daily; el Scrum Master la persigue.
- Un bloqueo de más de 1 día se resuelve con una llamada corta entre los implicados, no por chat.
- Si un secreto (`.env`, contraseña, token) se sube por accidente: avisar **de inmediato** al Scrum Master. Se rota la credencial; borrarlo en otro commit no basta.

## 9. Comunicación

- **Canal principal:** Discord del equipo (canal del proyecto). Decisiones importantes se registran además en la issue o PR correspondiente, para que queden en GitHub.
- Menciona a la persona (`@`) cuando necesites respuesta; una pregunta sin mención no compromete a nadie.
- Horario de respuesta esperado: mismo día hábil. Fuera de ese horario nadie está obligado a responder.
- Las decisiones técnicas del proyecto (ORM, librería de validación, etc.) se documentan en la sección _Decisiones técnicas_ del `README.md`.

## 10. Convenciones técnicas mínimas

Están detalladas en el `README.md` (_Convenciones de la API_). Las que más se olvidan:

- Todo endpoint bajo `/api/v1`; un módulo NestJS por dominio en `src/modules/<dominio>/`.
- DTOs con `class-validator`; cualquier campo no declarado devuelve 400.
- Errores desde el service con `EntityNotFoundException` (404) y `BusinessRuleException('…', 'RN-xxx')` (409). Sin `try/catch` en controladores.
- Nada de `synchronize: true` ni SQL manual sobre el esquema.

---

## Firma

Cada integrante comenta **"De acuerdo"** en la issue #98. A partir de ahí, este documento es la referencia ante cualquier duda de proceso.

| Integrante             | Fecha |
| ---------------------- | ----- |
| @DylanSrz              |       |
| @Gonza204658           |       |
| @Kerin0011             |       |
| @rodriguezvjhona-droid |       |
| @jorel2610             |       |
