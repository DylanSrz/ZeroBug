## Issue relacionada

Closes #11

<!-- El PR debe apuntar a `dev`. -->

## Qué cambia

- Se agrega la entidad `Category` para persistir las categorías del menú.
- El nombre es único y tiene una longitud entre 2 y 50 caracteres.
- Se agregan descripción nullable, estado `ACTIVE | INACTIVE` y timestamps.
- Se agrega `CategoriesModule` con `TypeOrmModule.forFeature`.
- Se agrega la migración `CreateCategories` con índice único en `name`.

## Cómo probar estos cambios

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Ejecutar las validaciones:

   ```bash
   npm run lint
   npm run build
   npm run test
   ```

3. Con PostgreSQL configurado y las variables de `.env` disponibles, ejecutar:

   ```bash
   npm run migration:run
   ```

4. Verificar que exista la tabla `categories` con nombre único, longitud entre 2 y 50 caracteres, estado predeterminado `ACTIVE`, descripción nullable y timestamps.

## Checklist

- [x] `npm run lint`, `npm run build` y `npm run test` en verde
- [ ] `npm run test:e2e` en verde
- [ ] Hay tests para la lógica nueva
- [x] Swagger documenta los endpoints nuevos o modificados: no aplica, no se agregaron endpoints
- [x] Migración incluida con `import type`
- [x] No se modificó la configuración
- [ ] Rama actualizada con `dev` y sin conflictos
- [ ] Revisor asignado

## Capturas / notas

Los tests e2e y la migración requieren PostgreSQL activo y correctamente configurado.
