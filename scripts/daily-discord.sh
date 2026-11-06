#!/usr/bin/env bash
# Mensaje diario del equipo en #📅｜daily (Discord). Lo ejecuta
# .github/workflows/daily-discord.yml; también se puede correr a mano.
#
# Modos (variable MODO):
#   recordatorio  días de reunión, 30 min antes: agenda del día (Planning el
#                 primer día del sprint, Review y Retro el último, daily el resto)
#   asincrona     días sin reunión, 8:00 a. m.: las tres preguntas de la daily
#   auto          (por defecto) elige según el día
#
# Variables:
#   DISCORD_WEBHOOK_DAILY  URL del webhook de #daily (secreto del repositorio)
#   DRY_RUN=1              imprime el mensaje y el JSON en vez de enviarlos
#   FECHA=AAAA-MM-DD       simula otro día (por defecto, hoy en Colombia)
#
# Ejemplo: DRY_RUN=1 FECHA=2026-10-19 MODO=recordatorio bash scripts/daily-discord.sh
set -euo pipefail

ZONA=America/Bogota
FECHA="${FECHA:-$(TZ=$ZONA date +%F)}"
MODO="${MODO:-auto}"
DRY_RUN="${DRY_RUN:-0}"

# Lunes a viernes a la 1:00 p. m. (1 = lunes … 7 = domingo)
DIAS_REUNION="${DIAS_REUNION:-1 2 3 4 5}"
HORA_REUNION="1:00 p. m."

# sprint|inicio|fin|release
SPRINTS=(
  "3|2026-10-12|2026-10-16|v0.3.0"
  "4|2026-10-19|2026-10-23|v1.0.0"
)
ULTIMO_SPRINT=4

# Integrantes que se mencionan (IDs de Discord)
MENCIONES=(
  570371097309216779  # César
  717432535205806081  # Dilant
  1029533614116966480 # Leonardo
)

# Canales que se enlazan en el mensaje
CANAL_BLOQUEOS=1559594041149231204
CANAL_SPRINTS=1559594051471417386
CANAL_REVISIONES=1559594117649010749

DIAS=(_ lunes martes miércoles jueves viernes sábado domingo)
MESES=(_ enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre)

dia_semana=$(date -d "$FECHA" +%u)
fecha_larga="${DIAS[$dia_semana]} $(date -d "$FECHA" +%-d) de ${MESES[$(date -d "$FECHA" +%-m)]}"

sprint="" inicio="" fin="" release=""
for fila in "${SPRINTS[@]}"; do
  IFS='|' read -r s i f r <<<"$fila"
  if [[ ! "$FECHA" < "$i" && ! "$FECHA" > "$f" ]]; then
    sprint=$s inicio=$i fin=$f release=$r
  fi
done

if [[ -z "$sprint" ]]; then
  echo "Sin sprint activo el $FECHA: no se envía nada."
  exit 0
fi
if ((dia_semana > 5)); then
  echo "Fin de semana: no se envía nada."
  exit 0
fi

es_dia_reunion=false
[[ " $DIAS_REUNION " == *" $dia_semana "* ]] && es_dia_reunion=true

if [[ "$MODO" == auto ]]; then
  $es_dia_reunion && MODO=recordatorio || MODO=asincrona
fi
# Cada cron dispara un modo; si no corresponde al día, no se envía.
if [[ "$MODO" == recordatorio && $es_dia_reunion == false ]] ||
  [[ "$MODO" == asincrona && $es_dia_reunion == true ]]; then
  echo "El $fecha_larga no corresponde el modo '$MODO': no se envía nada."
  exit 0
fi

menciones=""
for id in "${MENCIONES[@]}"; do menciones+="<@$id> "; done

preguntas="**Antes de la reunión, escribe tu daily aquí:**
✅ ¿Qué hice ayer?
🎯 ¿Qué haré hoy? (con el # del issue)
🚧 ¿Algo me bloquea? → cuéntalo en <#$CANAL_BLOQUEOS> con @ a quien necesitas"

if [[ "$MODO" == asincrona ]]; then
  contenido="☀️ **Daily asíncrona · $fecha_larga** · Sprint $sprint
$menciones

Hoy no tenemos reunión: respondan aquí antes del mediodía.
✅ ¿Qué hice ayer?
🎯 ¿Qué haré hoy? (con el # del issue)
🚧 ¿Algo me bloquea? → cuéntalo en <#$CANAL_BLOQUEOS> con @ a quien necesitas"

elif [[ "$FECHA" == "$inicio" ]]; then
  contenido="⏰ **Hoy a la $HORA_REUNION: Sprint Planning del Sprint $sprint** ($(date -d "$inicio" +%-d) – $(date -d "$fin" +%-d) de ${MESES[$(date -d "$fin" +%-m)]})
$menciones

**Agenda (máximo 1 hora)**
1. Objetivo del Sprint $sprint
2. Propuesta de reparto en <#$CANAL_SPRINTS>: cada uno confirma su capacidad real
3. Orden de trabajo por dependencias
4. Cada uno sale con su primera tarea asignada y en *In Progress*

$preguntas"

elif [[ "$FECHA" == "$fin" ]]; then
  if [[ "$sprint" == "$ULTIMO_SPRINT" ]]; then
    cierre="3. **Entrega final del proyecto: release \`$release\`** 🏁"
  else
    cierre="3. Release \`$release\` y lo que pasa al Sprint $((sprint + 1))"
  fi
  contenido="⏰ **Hoy a la $HORA_REUNION: Sprint Review y Retro del Sprint $sprint**
$menciones

**Agenda**
1. **Review:** demo de cada historia desde Swagger contra sus criterios de aceptación. Cada historia la prueba alguien distinto a su autor
2. **Retro:** qué mantener, qué mejorar y acciones con responsable
$cierre

$preguntas"

else
  dia_sprint=$(($(($(date -d "$FECHA" +%s) - $(date -d "$inicio" +%s))) / 86400 + 1))
  aviso=""
  if [[ "$sprint" == "$ULTIMO_SPRINT" && "$(date -d "$fin -1 day" +%F)" == "$FECHA" ]]; then
    aviso="
⚠️ **Hoy a las 6:00 p. m. es la congelación:** lo que no esté en \`dev\` a esa hora no entra en la entrega."
  fi
  contenido="⏰ **Hoy a la $HORA_REUNION: daily** · Sprint $sprint, día $dia_sprint de 5
$menciones

**Agenda (15 minutos)**
1. Ronda: qué hice, qué haré (con #issue) y qué me bloquea
2. PRs esperando revisión en <#$CANAL_REVISIONES>: ninguno más de medio día
3. Riesgos para el cierre del viernes$aviso

$preguntas"
fi

payload=$(jq -n --arg content "$contenido" --args '{
  content: $content,
  allowed_mentions: { parse: [], users: $ARGS.positional },
  flags: 4
}' "${MENCIONES[@]}")

if [[ "$DRY_RUN" == 1 ]]; then
  echo "── $MODO · $fecha_larga · ${#contenido} caracteres ──"
  echo "$contenido"
  echo "── JSON ──"
  echo "$payload" | jq -c '{allowed_mentions, flags}'
  exit 0
fi

if ((${#contenido} > 2000)); then
  echo "El mensaje supera los 2000 caracteres de Discord (${#contenido})." >&2
  exit 1
fi
: "${DISCORD_WEBHOOK_DAILY:?Falta el secreto DISCORD_WEBHOOK_DAILY}"
curl -fsS -H 'Content-Type: application/json' -d "$payload" "$DISCORD_WEBHOOK_DAILY"
echo "Enviado: $MODO · $fecha_larga"
