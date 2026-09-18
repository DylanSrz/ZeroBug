## Issue relacionada

Closes #

<!-- Recuerda: el PR debe apuntar a `dev` (GitHub propone `main` por defecto).
     Al mergear a `dev`, quien hace el merge cierra la issue a mano y mueve la tarjeta a Done. -->

## Qué cambia

<!-- 2–5 viñetas. Qué se agregó/cambió y por qué. Si hubo una decisión técnica, dilo aquí. -->

-

## Cómo probar estos cambios

<!-- OBLIGATORIO. Pasos concretos que el revisor puede seguir: comandos, endpoint, body de ejemplo, respuesta esperada. -->

1. `npm install` (si cambiaron dependencias)
2.
3.

## Checklist

- [ ] `npm run lint`, `npm run build`, `npm run test` y `npm run test:e2e` en verde
- [ ] Hay tests para la lógica nueva
- [ ] Swagger documenta los endpoints nuevos o modificados
- [ ] Si cambió el esquema: migración incluida (`npm run migration:generate`) y `import type` en la migración
- [ ] Si cambió la configuración: `.env.example` y README actualizados
- [ ] Rama actualizada con `dev` (`git pull origin dev`) y sin conflictos
- [ ] Revisor asignado

## Capturas / notas (opcional)

<!-- Respuesta de Swagger, salida de consola, dudas para el revisor. -->
