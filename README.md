# ZeroBug — Restaurant API

[![CI](https://github.com/DylanSrz/ZeroBug/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/DylanSrz/ZeroBug/actions/workflows/ci.yml)

API REST para la gestión operativa de un restaurante: **mesas, menú, reservas, usuarios/roles y pedidos**.
Backend en NestJS + TypeScript sobre PostgreSQL, desarrollado con metodología SCRUM en 4 sprints.

- 📋 Tablero: <https://github.com/users/DylanSrz/projects/7>
- 📘 Historias de usuario y reglas de negocio (RN-xxx): [`docs/`](docs/)
- 🌿 Cómo trabajamos con Git: [`docs/guia-git.md`](docs/guia-git.md)
- 🤝 Acuerdos de trabajo y Definition of Done: [`docs/working-agreement.md`](docs/working-agreement.md)
- 📖 Documentación de la API (Swagger): `http://localhost:3000/api/docs` con la app corriendo

## Stack

| Capa                | Herramienta                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| Runtime / lenguaje  | Node.js 24 LTS · TypeScript (ESM)                                          |
| Framework           | NestJS 12                                                                  |
| Base de datos / ORM | PostgreSQL 16 · TypeORM con migraciones versionadas (`synchronize: false`) |
| Configuración       | `@nestjs/config` + validación de variables con **zod**                     |
| Validación HTTP     | `class-validator` + `class-transformer` (`ValidationPipe` global)          |
| Documentación       | `@nestjs/swagger` (OpenAPI)                                                |
| Testing             | Vitest + Supertest (unit y e2e)                                            |
| Calidad             | oxlint · Prettier                                                          |
| Seguridad base      | Helmet · CORS configurable por entorno · formato de error uniforme         |
| Infraestructura     | Docker · Docker Compose                                                    |

## Requisitos

- Node.js ≥ 24 y npm
- Docker y Docker Compose (para PostgreSQL)
- Git

## Puesta en marcha

```bash
git clone git@github.com:DylanSrz/ZeroBug.git
cd ZeroBug
git checkout dev                 # el trabajo se integra en dev; main es producción

cp .env.example .env             # y completa DATABASE_USER / DATABASE_PASSWORD / DATABASE_NAME
npm install

docker compose up -d db          # PostgreSQL en localhost:5432
npm run start:dev                # API en http://localhost:3000 (aplica migraciones pendientes al arrancar)
```

Comprueba que todo está arriba:

```bash
curl http://localhost:3000/api/v1/health
# → {"status":"ok","service":"restaurant-api"}
```

Swagger: <http://localhost:3000/api/docs>

### Todo en Docker (API + base de datos)

```bash
docker compose up -d --build     # levanta db y restaurant-api con las variables del .env
docker compose logs -f restaurant-api
```

Dentro de Docker la API alcanza PostgreSQL por el nombre del servicio (`DATABASE_HOST=db`, lo inyecta compose).

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Si falta una obligatoria o tiene un valor inválido, **la aplicación no arranca** y muestra la lista de problemas.

| Variable                                | Descripción                                                            | Default       |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------- |
| `NODE_ENV`                              | `development` · `production` · `test`                                  | `development` |
| `APP_PORT`                              | Puerto HTTP                                                            | `3000`        |
| `DATABASE_HOST/PORT/USER/PASSWORD/NAME` | Conexión a PostgreSQL                                                  | puerto `5432` |
| `CORS_ORIGIN`                           | Orígenes permitidos separados por coma. En producción no se admite `*` | `*`           |
| `OBSERVE_*`                             | NestJS Observe (opcional)                                              | —             |

Nunca se versiona `.env`; los secretos no van en el código (RN-013).

## Scripts

| Comando                                                         | Qué hace                                |
| --------------------------------------------------------------- | --------------------------------------- |
| `npm run start:dev`                                             | API en modo watch                       |
| `npm run build` / `npm run start:prod`                          | Compila a `dist/` y ejecuta             |
| `npm run lint`                                                  | oxlint sobre `src/` y `test/`           |
| `npm run format`                                                | Prettier                                |
| `npm run test`                                                  | Tests unitarios (`*.spec.ts`)           |
| `npm run test:e2e`                                              | Tests end-to-end (`test/*.e2e-spec.ts`) |
| `npm run test:cov`                                              | Cobertura                               |
| `npm run migration:generate -- src/database/migrations/Nombre`  | Genera migración desde las entidades    |
| `npm run migration:run` / `migration:revert` / `migration:show` | Aplica, deshace o lista migraciones     |
| `npm run migration:create -- src/database/migrations/Nombre`    | Migración vacía                         |

## Estructura del proyecto

```text
src/
├── app.module.ts            # módulo raíz: Config, Observe, TypeORM y módulos de dominio
├── app.setup.ts             # configuración transversal: /api/v1, ValidationPipe, Helmet, CORS, filtro de errores
├── main.ts                  # bootstrap
├── common/
│   ├── exceptions/          # EntityNotFoundException (404), BusinessRuleException (409 + RN)
│   └── filters/             # HttpExceptionFilter: formato de error uniforme
├── config/                  # env.config, env.validation.schema (zod), swagger.config
├── database/
│   ├── data-source.ts       # DataSource para la CLI de TypeORM
│   ├── database.config.ts   # conexión de la app (migrationsRun: true)
│   └── migrations/          # <timestamp>-<Nombre>.ts
└── modules/
    └── <dominio>/           # un módulo NestJS por dominio (RN-004)
        ├── dto/
        ├── entities/
        ├── <dominio>.controller.ts
        ├── <dominio>.service.ts
        └── <dominio>.module.ts
test/                        # e2e (supertest)
docs/                        # HU-001 … HU-020, guía de git
```

## Convenciones de la API

- Todos los endpoints viven bajo **`/api/v1`** (RN-003). Un controlador nuevo cae ahí automáticamente.
- Los controladores son delgados; la lógica de negocio va en los services (RN-005/006) y el acceso a datos solo mediante TypeORM (RN-007).
- Los DTOs se validan con decoradores de `class-validator`. Cualquier campo no declarado en el DTO responde **400**. Para query params numéricos usar `@Type(() => Number)`.
- Errores: lanzar desde el service `EntityNotFoundException('Mesa', id)` → 404 o `BusinessRuleException('…', 'RN-016')` → 409. No hace falta `try/catch` en controladores; toda respuesta de error tiene la forma:

  ```json
  {
    "statusCode": 409,
    "error": "Conflict",
    "message": "El número de mesa ya existe",
    "rule": "RN-016",
    "path": "/api/v1/tables",
    "timestamp": "…"
  }
  ```

- Cada controlador lleva `@ApiTags('Nombre')` para agruparse en Swagger (RN-012).
- Todo cambio de esquema es una migración versionada (ver abajo).

## Tests

```bash
npm run test          # unitarios, sin base de datos
npm run test:e2e      # e2e; los specs que importan AppModule necesitan PostgreSQL arriba (docker compose up -d db)
```

Los e2e de configuración transversal (`test/app-setup.e2e-spec.ts`, `test/http-exception-filter.e2e-spec.ts`) no necesitan base de datos.

## Base de datos y migraciones (TypeORM)

El esquema de PostgreSQL se administra **únicamente** con migraciones versionadas de TypeORM
(`synchronize: false`). Nunca se modifica la base de datos a mano.

**Convención de carpetas**

```text
src/
├── database/
│   ├── data-source.ts        # DataSource para la CLI (npm run migration:*)
│   ├── database.config.ts    # Conexión de la app NestJS (migrationsRun: true)
│   └── migrations/           # <timestamp>-<Nombre>.ts, una por cambio de esquema
└── modules/<dominio>/entities/*.entity.ts
```

**Flujo de trabajo**

```bash
# 0. Levanta PostgreSQL y ten el .env configurado (DATABASE_HOST=localhost en local)
docker compose up -d db

# 1. Modifica o crea una entidad (*.entity.ts)

# 2. Genera la migración comparando entidades vs. base de datos
npm run migration:generate -- src/database/migrations/NombreDescriptivo

# 3. Revisa el SQL generado en src/database/migrations/ y ajústalo si hace falta
#    (usa `import type { MigrationInterface, QueryRunner } from 'typeorm'` — Vitest lo exige)

# 4. Aplícala en tu base local
npm run migration:run

# 5. Verifica el estado ([X] aplicada, [ ] pendiente)
npm run migration:show

# 6. Commitea la entidad y la migración juntas en el mismo PR
```

Otros comandos:

```bash
npm run migration:revert   # deshace la última migración aplicada
npm run migration:create -- src/database/migrations/NombreDescriptivo   # migración vacía (datos, índices manuales)
```

**Cómo se aplican en cada entorno**

- **Local / Docker:** la API ejecuta las migraciones pendientes al arrancar (`migrationsRun: true`
  en `database.config.ts`), por lo que `docker compose up -d` deja la base de datos lista.
  En el contenedor se usan las migraciones compiladas en `dist/database/migrations/*.js`.
- **Reglas:** una migración commiteada nunca se edita; si hay que corregir algo, se crea otra.
  No uses `synchronize: true` ni cambies el esquema con SQL manual.

## Decisiones técnicas

| Decisión                                                                                  | Motivo                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeORM** en vez de Prisma (que menciona `docs/HU-001.md` original)                     | El proyecto ya estaba construido con TypeORM al planificar; se conservó y se actualizó la HU. Migraciones versionadas con `synchronize: false`. |
| **Vitest** en vez de Jest                                                                 | Ya configurado por el starter; ESM nativo y más rápido. Requiere `import type` para tipos de `typeorm` en migraciones.                          |
| **oxlint** en vez de ESLint                                                               | Ya configurado por el starter; suficiente para las reglas del proyecto.                                                                         |
| **class-validator + class-transformer** para DTOs; **zod** solo para variables de entorno | Estándar NestJS y `@nestjs/swagger` documenta los DTOs automáticamente. Decisión del equipo (issue #30).                                        |
| **`NODE_ENV`** (no `APP_NODE`)                                                            | Convención que leen Nest, TypeORM y el `Dockerfile`.                                                                                            |
| Migraciones aplicadas **al arrancar** (`migrationsRun: true`)                             | `docker compose up` deja el entorno listo sin pasos manuales.                                                                                   |
| Prefijo global `'/api'` **con barra inicial**                                             | Sin ella Nest 12 + Express 5 no montan el manejador de 404 bajo el prefijo.                                                                     |

## Flujo de trabajo

Cada PR ejecuta el workflow **CI** (`.github/workflows/ci.yml`): `quality` (lint sin warnings, Prettier, build, unit) y `e2e` (PostgreSQL efímero, migraciones, tests e2e). Ambos checks son obligatorios para mergear en `dev` y `main`.

SCRUM con sprints de 2 semanas; acuerdos de equipo y Definition of Done en [`docs/working-agreement.md`](docs/working-agreement.md). Cada tarea del tablero es una rama corta + un PR pequeño hacia `dev` con `Closes #N`, revisado por un compañero. `main` solo recibe merges de `dev` al cierre de cada sprint. Detalles en [`docs/guia-git.md`](docs/guia-git.md).

## Equipo

| Nombre             | Rol                          | Usuario de GitHub      |
| ------------------ | ---------------------------- | ---------------------- |
| Dylan Suárez       | Scrum Master · Desarrollador | @DylanSrz              |
| Jonathan Rodríguez | Desarrollador                | @rodriguezvjhona-droid |
| Kerin Barranco     | Desarrollador                | @Kerin0011             |
| Diego Gonzales     | Desarrollador                | @Gonza204658           |            
| jorel Hernandez    | Desarrollador                | @jorel2610             |

