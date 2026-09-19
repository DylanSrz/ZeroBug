# 🌿 Guía de Git y GitFlow — zeroBug

> **Qué es este documento:** la referencia completa de cómo trabajamos con Git en el equipo. Aquí está el detalle, incluyendo qué hacer cuando algo sale mal. Ante la duda, esta guía manda.

---

## 1. Las ramas del proyecto

| Rama | Qué es | Quién escribe en ella |
|---|---|---|
| `main` | **Producción**: solo versiones estables. Los merges los coordina el líder al cierre de cada sprint | Nadie directamente (protegida) |
| `dev` | **Integración**: aquí entra el trabajo terminado de todos | Nadie directamente (protegida) — solo mediante PR aprobado |
| `feature/nombre-corto` | Una rama por tarea nueva (ej: `feature/crud-menu`) | Su autor |
| `fix/nombre-corto` | Correcciones de errores (ej: `fix/puntaje-decimales`) | Su autor |
| `docs/nombre-corto` | Cambios solo de documentación | Su autor |

**Reglas de nombres:** minúsculas, palabras separadas por guiones, cortos y descriptivos. La issue correspondiente sugiere el nombre de la rama — úsenlo.

## 2. El ciclo de vida de una tarea (el ritual completo)

```bash
# 0. SIEMPRE parte de dev actualizado
git checkout dev
git pull origin dev

# 1. Crea tu rama
git checkout -b feature/mi-tarea

# 2. Trabaja. Haz commits pequeños y frecuentes
git add archivo1 archivo2        # (mejor nombrar archivos que usar "git add .")
git commit -m "feat: agregar endpoint de registro"

# 3. Sube tu rama
git push -u origin feature/mi-tarea

# 4. Abre el Pull Request hacia dev en GitHub y llena la plantilla completa

# 5. Pide revisión a un compañero (en Discord o asignándolo como Reviewer)

# 6. Aprobado → merge → GitHub borra la rama remota automáticamente

# 7. Limpieza local y a la siguiente tarea
git checkout dev
git pull origin dev
git branch -d feature/mi-tarea
git fetch --prune
```

**Una rama = una tarea = un PR.** Las ramas no se reutilizan: mergeada, muere; la próxima tarea estrena rama desde `dev` actualizado.

## 3. Mensajes de commit

Formato: **`tipo: descripción en presente y en minúsculas`**

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| `feat` | Nueva funcionalidad | `feat: agregar endpoint de registro de usuarios` |
| `fix` | Corrección de error | `fix: corregir calculo del puntaje con decimales` |
| `docs` | Documentación | `docs: agregar acta de la daily del 15 de julio` |
| `style` | Estilos/formato sin cambiar lógica | `style: ajustar espaciado de las tarjetas de curso` |
| `refactor` | Mejora interna sin cambiar comportamiento | `refactor: extraer validacion de opciones a una funcion` |
| `chore` | Configuración y herramientas | `chore: actualizar dependencias del backend` |

✅ `feat: agregar validacion de email duplicado en el registro`
❌ `cambios`, `arreglos`, `ya quedo`, `commit final`, `commit final 2`

**Por qué importa:** el historial de commits es evidencia evaluable del proyecto, y un `git log` legible permite encontrar cuándo se rompió algo.

## 4. Pull Requests

- Todo PR usa **la plantilla** (se carga sola) y se llena completa — en especial "Cómo probar estos cambios".
- Todo PR referencia su issue: `Closes #N`. Nota del equipo: como trabajamos con GitFlow, el `Closes` solo cierra la issue cuando el cambio llega a `main`; al mergear a `dev`, **quien hace el merge cierra la issue a mano y mueve la tarjeta a `Done`**.
- PRs **pequeños y frecuentes**: un PR de 200 líneas se revisa bien; uno de 2.000 se aprueba sin leer (y ahí se cuelan los errores).
- El PR debe apuntar a `dev`. GitHub propone `main` por defecto — **verifícalo siempre antes de crear**.

### Cómo revisar el PR de un compañero

1. Pestaña **Files changed** → leer el código con calma.
2. ¿Dudas o problemas? Comentar la línea específica (botón `+` al pasar el mouse).
3. Seguir los pasos de "Cómo probar" del PR y verificar que funciona.
4. **Review changes** → `Approve` (todo bien), `Request changes` (hay que corregir) o `Comment` (observaciones sin bloquear).
5. Aprobar es responder por ese código: no se aprueba por compromiso ni por afán.

## 5. Resolución de conflictos (te va a pasar — es normal)

Un **conflicto** ocurre cuando dos personas modifican las mismas líneas. GitHub lo avisa en el PR: *"This branch has conflicts that must be resolved"*.

```bash
# En tu rama, trae lo último de dev y mézclalo
git checkout feature/mi-tarea
git pull origin dev
# Git te dirá qué archivos tienen conflicto
```

Los archivos en conflicto tendrán marcas así:

```
<<<<<<< HEAD
tu versión de la línea
=======
la versión que está en dev
>>>>>>> dev
```

**Pasos:** (1) abre el archivo y decide qué se queda — tu versión, la otra, o una combinación; (2) borra las marcas `<<<<<<<`, `=======`, `>>>>>>>`; (3) prueba que todo sigue funcionando; (4) `git add` + `git commit` + `git push`. El PR se actualiza solo.

**Regla de oro:** si el conflicto toca código que no es tuyo, resuélvelo CON esa persona (llamada de 5 minutos), nunca borres el trabajo de un compañero por afán.
**Prevención:** ramas de vida corta (días, no semanas) y `git pull origin dev` en tu rama cada mañana.

## 6. Auxilios comunes (cuando algo sale mal)

| Problema | Solución |
|---|---|
| Hice commit en `dev` por error (sin push) | `git checkout -b feature/mi-tarea` (tu commit se va con la rama nueva), luego `git checkout dev` y `git reset --hard origin/dev` |
| Quiero deshacer el último commit pero guardar los cambios | `git reset --soft HEAD~1` |
| Subí algo que no debía al PR | Corrige en tu rama, nuevo commit, push — el PR se actualiza |
| El push me lo rechaza en `dev`/`main` | Es la protección de rama funcionando: tu trabajo va en una rama + PR |
| Borré/dañé un archivo sin commitear | `git checkout -- ruta/archivo` (vuelve a la última versión commiteada) |
| No sé en qué estado estoy | `git status` — SIEMPRE es el primer comando ante la duda |

⚠️ **Prohibido sin consultar al líder:** `git push --force`, `git reset --hard` sobre trabajo compartido, y borrar ramas ajenas. Estos comandos pueden destruir trabajo de otros.

## 7. Lo que NUNCA se sube al repositorio

- Archivos `.env`, contraseñas, cadenas de conexión, tokens o llaves.
- Carpetas de dependencias (`node_modules/`, `.venv/`) y archivos del sistema.
- Si un secreto se sube por accidente: avisar al líder DE INMEDIATO (se rota la credencial). No basta con borrarlo en otro commit: queda en el historial.

## 8. Ejercicio de iniciación (obligatorio para los 6)

Cada integrante completa una vez el ciclo entero, sin riesgo:

1. `git checkout dev && git pull origin dev`
2. `git checkout -b feature/presentacion-<tunombre>`
3. Agregar tu nombre, rol y usuario de GitHub a la tabla de integrantes del `README.md`.
4. `git add README.md && git commit -m "docs: agregar presentacion de <nombre> al readme"`
5. `git push -u origin feature/presentacion-<tunombre>`
6. Abrir el PR hacia `dev` con la plantilla y pedir revisión a un compañero (cadena: cada quien revisa el PR del siguiente en la lista del equipo).
7. Mergeado el PR: limpieza local (paso 7 del ciclo) — y listo, ya sabes GitFlow.
