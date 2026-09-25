# Informes de sprint

Cada **viernes**, al cierre del sprint (lunes a viernes), el equipo entrega un informe de lo que trabajó en esa semana al Team Leader, **Abrahan Villa**. El informe tiene dos piezas:

| Pieza | Para qué |
| --- | --- |
| `presentacion.html` | Presentación interactiva para exponer: se navega con las flechas del teclado, tiene vista general, gráficos y detalle por integrante. Es un solo archivo, funciona sin internet. |
| `Informe-Sprint-NN-ZeroBug.pdf` | Documento formal (A4) que se entrega al Team Leader. |

Cada sprint tiene su carpeta y los informes se acumulan aquí:

```text
docs/informes-sprint/
├── README.md              ← este archivo
├── equipo.json            ← integrantes, roles, colores y destinatario (se toca solo si cambia el equipo)
├── recolectar.mjs         ← obtiene los números del sprint desde GitHub, git y Vitest
├── generar.mjs            ← construye la presentación, el documento y el PDF
├── plantilla/             ← estilos y comportamiento compartidos por todos los sprints
│   ├── presentacion.css
│   ├── presentacion.js
│   └── informe.css
└── sprint-01/
    ├── metricas.json      ← generado por recolectar.mjs (no se edita a mano)
    ├── contenido.json     ← textos del sprint (se redacta cada semana)
    ├── presentacion.html  ← generado
    ├── informe.html       ← generado (fuente del PDF)
    └── Informe-Sprint-01-ZeroBug.pdf
```

## Cómo se prepara cada viernes

Requisitos: `gh` autenticado, Chromium o Chrome instalado, y el árbol de trabajo sin cambios pendientes en archivos versionados (el recolector cambia temporalmente al commit del release para contar las pruebas).

```bash
# 1. Números del sprint N (PRs, revisiones, tareas, historias, pruebas, endpoints)
node docs/informes-sprint/recolectar.mjs N

# 2. Textos: copiar el contenido.json del sprint anterior y actualizarlo
cp docs/informes-sprint/sprint-0<N-1>/contenido.json docs/informes-sprint/sprint-0N/contenido.json
#    …editar objetivo, resultado, aporte de cada integrante, retro, decisiones y próximo sprint

# 3. Presentación, documento y PDF (con capturas para revisarlos)
node docs/informes-sprint/generar.mjs N --capturas
```

Abrir `sprint-0N/presentacion.html` en el navegador para revisarla. Las capturas de cada diapositiva y de cada página del PDF quedan en `node_modules/.cache/informe-sprint/capturas/`.

### Qué cuenta en cada sprint

- **Ventana del sprint:** todo lo que entró en `dev` entre el release anterior (`v0.<N-1>.0`) y el release del sprint (`v0.<N>.0`). Si el release todavía no existe, hasta el momento de ejecutar el recolector. Se puede forzar con `--desde=ISO --hasta=ISO`.
- **PRs:** pull requests mergeados a `dev` dentro de la ventana, atribuidos a su autor en GitHub.
- **Tareas resueltas:** tareas del milestone del sprint cerradas por un PR del integrante (`Closes #N` en la descripción). Si una tarea se resolvió sin referenciarla, se atribuye a mano en `contenido.json` → `ajustesTareas`.
- **Revisiones:** revisiones de código hechas a PRs de otros compañeros dentro de la ventana. Las descartadas se cuentan según su estado original.
- **Historias y puntos:** historias del milestone con el campo *Story Points* del tablero.
- **Pruebas y endpoints:** se miden sobre el código del release (o de `dev` si aún no hay release).

### Campos de `contenido.json`

| Campo | Contenido |
| --- | --- |
| `titular`, `resultado`, `objetivo` | Titular corto, resultado del sprint y objetivo tal como se fijó en el Planning |
| `resumen` | 4–5 puntos del resumen ejecutivo |
| `historias` | Por número de issue: nombre corto, módulo, qué se entregó y responsables (si difieren de los asignados) |
| `integrantes` | Por login de GitHub: lista de aportes destacados, en tono neutral y verificable |
| `ajustesTareas` | Atribuciones manuales: `{ "50": { "pr": 149 } }` o `{ "105": { "login": "DylanSrz" } }` |
| `calidad`, `retro`, `decisiones`, `calendario` | Prácticas de calidad, retrospectiva, decisiones del sprint y calendario de sprints |
| `incidencias` | Lo que salió mal en el sprint: `titulo`, `detalle`, `impacto`, `solucion`, `estado`. Se incluyen siempre, con tono factual |
| `siguiente` | Objetivo, historias, puntos y riesgos del próximo sprint |

Los textos admiten `**negrita**` y `` `código` ``.

## Criterios del informe

- Es un informe **del equipo**: cada integrante aparece con lo que hizo, en tono neutral. Los aspectos a mejorar se redactan a nivel de equipo, sin señalar personas.
- Todos los números salen de `metricas.json`; nunca se escriben a mano en `contenido.json`.
- El diseño lo dan las plantillas: si hay que mejorarlo, se cambia `plantilla/` y aplica a los sprints siguientes. Los informes ya entregados no se regeneran.
