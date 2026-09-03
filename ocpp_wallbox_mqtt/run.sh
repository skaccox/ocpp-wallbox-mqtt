#!/usr/bin/with-contenv bashio
set -e

APP_DIR="/config/ocpp-mqtt-perl-server"
INI_FILE="/config/ocpp-mqtt-perl-server/ocpp.ini"

OCPP_VERBOSE="$(bashio::config 'ocpp_verbose')"
# ---- Parametri UI ----
WALLBOX_SET_LIMIT_UNIT="$(bashio::config 'wallbox_set_limit_unit')"

WALLBOX_SET_LIMIT_MAINSTEP="$(bashio::config 'wallbox_set_limit_mainstep' | tr ',' '.')"
WALLBOX_SET_LIMIT_FINESTEP="$(bashio::config 'wallbox_set_limit_finestep' | tr ',' '.')"

GRID_LIMIT="$(bashio::config 'grid_limit')"
GRID_LIMIT_SAFE="$(bashio::config 'grid_limit_safe')"

MINPOWER="$(bashio::config 'minpower')"
STOP_ON_SUSPENDEV="$(bashio::config 'stop_on_suspendev')"

METER_MQTT_PREFIX="$(bashio::config 'meter_mqtt_prefix')"
METER_MQTT_POWER="$(bashio::config 'meter_mqtt_power')"
PV_MQTT_PREFIX="$(bashio::config 'pv_mqtt_prefix')"

METER_MQTT_L1_POWER="$(bashio::config 'meter_mqtt_l1_power')"
METER_MQTT_L2_POWER="$(bashio::config 'meter_mqtt_l2_power')"
METER_MQTT_L3_POWER="$(bashio::config 'meter_mqtt_l3_power')"

METER_MQTT_L1_VOLTAGE="$(bashio::config 'meter_mqtt_l1_voltage')"
METER_MQTT_L2_VOLTAGE="$(bashio::config 'meter_mqtt_l2_voltage')"
METER_MQTT_L3_VOLTAGE="$(bashio::config 'meter_mqtt_l3_voltage')"

METER_MQTT_L1_CURRENT="$(bashio::config 'meter_mqtt_l1_current')"
METER_MQTT_L2_CURRENT="$(bashio::config 'meter_mqtt_l2_current')"
METER_MQTT_L3_CURRENT="$(bashio::config 'meter_mqtt_l3_current')"


MQTT_BROKER="$(bashio::config 'mqtt_broker')"
MQTT_USER="$(bashio::config 'mqtt_user')"
MQTT_PASS="$(bashio::config 'mqtt_pass')"

WALLBOX_MQTT_NAME="$(bashio::config 'wallbox_mqtt_name')"

DATA_DIR="$(bashio::config 'data_dir')"
DEFAULT_VIEW="$(bashio::config 'default_view')"

# ---- Sorgente del codice (repo/branch configurabili dalle opzioni) ----
DEFAULT_CODE_REPO="https://gitlab.com/lucabon/ocpp-mqtt-perl-server.git"
DEFAULT_CODE_REF="main"

CODE_REPO="$(bashio::config 'code_repo')"
CODE_REF="$(bashio::config 'code_ref')"

if [ -z "${CODE_REPO}" ] || [ "${CODE_REPO}" = "null" ]; then
  CODE_REPO="${DEFAULT_CODE_REPO}"
fi
if [ -z "${CODE_REF}" ] || [ "${CODE_REF}" = "null" ]; then
  CODE_REF="${DEFAULT_CODE_REF}"
fi
AUTO_UPDATE="$(bashio::config 'auto_update')"
FORCE_UPDATE_ONCE=false
if bashio::config.true 'single_update_now'; then
  FORCE_UPDATE_ONCE=true
fi

ADD_WALLBOX_POWER_TO_METER=0
GLOBAL_ENERGY=0
USE_STOP_AS_SUSPEND=0


if bashio::config.true 'add_wallbox_power_to_meter'; then
  ADD_WALLBOX_POWER_TO_METER=1
fi

if bashio::config.true 'global_energy'; then
  GLOBAL_ENERGY=1
fi

if bashio::config.true 'use_stop_as_suspend'; then
  USE_STOP_AS_SUSPEND=1
fi

bashio::log.info "App dir: ${APP_DIR}"
bashio::log.info "Repo: ${CODE_REPO} (${CODE_REF})"
bashio::log.info "Auto update: ${AUTO_UPDATE}"

# ---- Helpers ----
have_net() {
  # check "internet reachability" in modo leggero
  ping -c 1 -W 1 1.1.1.1 >/dev/null 2>&1
}

git_try_update() {
  # best-effort: non deve mai far morire lo startup
  set +e
  git -C "${APP_DIR}" fetch --prune origin "${CODE_REF}" >/dev/null 2>&1
  local r1=$?
  if [ $r1 -ne 0 ]; then
    bashio::log.warning "Git fetch fallito (rete non pronta?). Mantengo la versione attuale."
    set -e
    return 0
  fi

  git -C "${APP_DIR}" pull --ff-only origin "${CODE_REF}" >/dev/null 2>&1
  local r2=$?
  if [ $r2 -ne 0 ]; then
    bashio::log.warning "Git pull non eseguito (branch divergente o modifiche locali). Mantengo la versione attuale."
    set -e
    return 0
  fi

  set -e
  bashio::log.info "Update git completato."
  return 0
}

# ---- Clone / Update ----

normalize_url() {
  # Ignora differenze irrilevanti (slash finale, suffisso .git) per non
  # rifare set-url a ogni avvio.
  local u="$1"
  u="${u%/}"
  u="${u%.git}"
  printf '%s' "${u}"
}

wait_net() {
  local tries=0
  while [ ${tries} -lt 5 ]; do
    if have_net; then return 0; fi
    tries=$((tries+1))
    bashio::log.warning "Rete non pronta (tentativo ${tries}/5). Attendo 3s..."
    sleep 3
  done
  return 1
}

git_reconcile_remote() {
  # Allinea origin alla URL configurata: sulle installazioni esistenti il clone
  # non viene rifatto, quindi senza questo origin resterebbe sul repo vecchio.
  local current
  current="$(git -C "${APP_DIR}" config --get remote.origin.url 2>/dev/null || true)"

  if [ -z "${current}" ]; then
    bashio::log.warning "Remote 'origin' assente in ${APP_DIR}: lo imposto a ${CODE_REPO}"
    git -C "${APP_DIR}" remote add origin "${CODE_REPO}" || return 1
    REPO_CHANGED=true
    return 0
  fi

  if [ "$(normalize_url "${current}")" != "$(normalize_url "${CODE_REPO}")" ]; then
    bashio::log.info "Repo cambiato nelle opzioni: ${current} -> ${CODE_REPO}"
    git -C "${APP_DIR}" remote set-url origin "${CODE_REPO}" || return 1
    REPO_CHANGED=true
  fi
  return 0
}

git_current_ref() {
  # Nome del branch, altrimenti tag esatto, altrimenti SHA (HEAD distaccato).
  local r
  r="$(git -C "${APP_DIR}" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [ -n "${r}" ]; then printf '%s' "${r}"; return 0; fi
  r="$(git -C "${APP_DIR}" describe --tags --exact-match HEAD 2>/dev/null || true)"
  if [ -n "${r}" ]; then printf '%s' "${r}"; return 0; fi
  git -C "${APP_DIR}" rev-parse HEAD 2>/dev/null || true
}

git_switch_ref() {
  # Cambiare ref richiede un checkout, non basta il pull.
  # NB: non usiamo mai "git clean": ocpp.ini, i log e data/ vivono dentro
  # questo working tree e non sono tracciati.
  set +e

  git -C "${APP_DIR}" fetch --prune --tags origin >/dev/null 2>&1
  if [ $? -ne 0 ]; then
    bashio::log.warning "Git fetch da ${CODE_REPO} fallito (rete o repo non raggiungibile). Mantengo la versione attuale."
    set -e
    return 1
  fi

  local ok=1
  if git -C "${APP_DIR}" rev-parse --verify --quiet "refs/remotes/origin/${CODE_REF}" >/dev/null 2>&1; then
    git -C "${APP_DIR}" checkout -B "${CODE_REF}" "origin/${CODE_REF}" >/dev/null 2>&1 && ok=0
    if [ ${ok} -ne 0 ]; then
      bashio::log.warning "Checkout di ${CODE_REF} bloccato da modifiche locali: forzo (i file non tracciati - ocpp.ini, log, data/ - non vengono toccati)."
      git -C "${APP_DIR}" checkout -f -B "${CODE_REF}" "origin/${CODE_REF}" >/dev/null 2>&1 && ok=0
    fi
    if [ ${ok} -eq 0 ]; then
      git -C "${APP_DIR}" branch --set-upstream-to="origin/${CODE_REF}" "${CODE_REF}" >/dev/null 2>&1
    fi
  elif git -C "${APP_DIR}" rev-parse --verify --quiet "${CODE_REF}^{commit}" >/dev/null 2>&1; then
    # tag o SHA: HEAD distaccato
    git -C "${APP_DIR}" checkout --detach "${CODE_REF}" >/dev/null 2>&1 && ok=0
    if [ ${ok} -ne 0 ]; then
      git -C "${APP_DIR}" checkout -f --detach "${CODE_REF}" >/dev/null 2>&1 && ok=0
    fi
  else
    bashio::log.error "Ref '${CODE_REF}' non trovato su ${CODE_REPO}. Verifica repo/branch nelle opzioni."
    set -e
    return 1
  fi

  set -e
  if [ ${ok} -ne 0 ]; then
    bashio::log.error "Impossibile passare a ${CODE_REF}."
    return 1
  fi

  bashio::log.info "Ora su ${CODE_REF} da ${CODE_REPO}"
  return 0
}

REPO_CHANGED=false
REF_CHANGED=false

if [ ! -d "${APP_DIR}/.git" ]; then
  # Prima installazione: senza rete non possiamo andare avanti
  bashio::log.info "Cloning ocpp-mqtt-perl-server..."

  if ! wait_net; then
    bashio::log.error "Rete non disponibile: impossibile clonare ${CODE_REPO}. Riprova quando HA ha connettività."
    exit 1
  fi

  rm -rf "${APP_DIR}"
  if ! git clone --branch "${CODE_REF}" "${CODE_REPO}" "${APP_DIR}"; then
    bashio::log.error "Clone fallito. Verifica repo/ref o connettività."
    exit 1
  fi
else
  # 1) origin deve puntare alla URL configurata
  git_reconcile_remote || bashio::log.warning "Non ho potuto aggiornare l'URL di origin."

  # 2) il ref in uso deve essere quello configurato
  CURRENT_REF="$(git_current_ref)"
  if [ "${CURRENT_REF}" != "${CODE_REF}" ]; then
    REF_CHANGED=true
    bashio::log.info "Ref cambiato nelle opzioni: ${CURRENT_REF:-sconosciuto} -> ${CODE_REF}"
  fi

  if [ "${REPO_CHANGED}" = "true" ] || [ "${REF_CHANGED}" = "true" ]; then
    # Cambio esplicito nelle opzioni: si applica anche con auto_update disattivo.
    if wait_net; then
      git_switch_ref || bashio::log.warning "Cambio repo/ref non applicato: avvio la versione attuale."
    else
      bashio::log.warning "Rete non disponibile: cambio repo/ref rinviato al prossimo avvio."
    fi
  elif bashio::config.true 'auto_update' || [ "${FORCE_UPDATE_ONCE}" = "true" ]; then
    if wait_net; then
      bashio::log.info "Aggiornamento (git pull)..."
      git_try_update
    else
      bashio::log.warning "Rete ancora non disponibile: salto auto_update e avvio la versione attuale."
    fi
  else
    bashio::log.info "Auto update disabled, skipping git update"
  fi

  # se era un update one-shot, resettalo nelle option
  if [ "${FORCE_UPDATE_ONCE}" = "true" ]; then
    bashio::log.info "Reset update_now flag"
    bashio::addon.option single_update_now false
  fi
fi

# ---- Log versione in uso (se possibile) ----
if [ -d "${APP_DIR}/.git" ]; then
  bashio::log.info "Using ocpp-mqtt-perl-server @ $(git -C "${APP_DIR}" log -1 --oneline 2>/dev/null || echo 'unknown')"
else
  bashio::log.warning "Repo git non presente in ${APP_DIR} (strano)."
fi

# ---- Sanity ----
if [ ! -f "${APP_DIR}/ocpp.pl" ]; then
  bashio::log.error "Non trovo ${APP_DIR}/ocpp.pl"
  exit 1
fi

# ---- Template ini ----
ini_template_path () {
  if [ -f "${APP_DIR}/ocpp-default.ini" ]; then
    printf '%s' "${APP_DIR}/ocpp-default.ini"
  elif [ -f "${APP_DIR}/default.ini" ]; then
    printf '%s' "${APP_DIR}/default.ini"
  fi
}

INI_TEMPLATE="$(ini_template_path)"

# ---- Create ini if missing ----
if [ ! -f "${INI_FILE}" ]; then
  mkdir -p "$(dirname "${INI_FILE}")"

  if [ -z "${INI_TEMPLATE}" ]; then
    bashio::log.error "Non trovo ${INI_FILE} e non trovo template ini (ocpp-default.ini/default.ini) in ${APP_DIR}"
    exit 1
  fi

  cp -f "${INI_TEMPLATE}" "${INI_FILE}"
  bashio::log.info "Creato ${INI_FILE} da $(basename "${INI_TEMPLATE}")"
fi

# ---- Helper ini ----

ini_has_key () {
  # vero se la chiave esiste, attiva o commentata
  grep -qE "^[[:space:]]*#?[[:space:]]*$1=" "${INI_FILE}"
}

ini_insert_block () {
  # Inserisce un blocco di righe nella sezione globale, cioè PRIMA della prima
  # sezione [..]. Appendere a fine file finirebbe dentro l'ultima sezione.
  BLOCK="$1" awk '
    BEGIN { ins=0 }
    {
      if (!ins && $0 ~ /^[[:space:]]*\[/) { printf "%s\n", ENVIRON["BLOCK"]; ins=1 }
      print
    }
    END { if (!ins) printf "%s\n", ENVIRON["BLOCK"] }
  ' "${INI_FILE}" > "${INI_FILE}.tmp" && mv "${INI_FILE}.tmp" "${INI_FILE}"
}

ini_merge_defaults () {
  # ocpp.ini non viene mai sovrascritto dopo la creazione: sulle installazioni
  # esistenti le chiavi nuove del template non comparirebbero mai. Qui le
  # aggiungiamo COMMENTATE col loro default, così restano visibili e
  # documentate senza cambiare il comportamento attuale.
  # Gira una volta per ogni versione del template (stamp sul suo hash).
  local tmpl="$1"
  local stamp="${APP_DIR}/.addon-ini-merged"
  local cur_sig

  [ -z "${tmpl}" ] && return 0
  [ -f "${tmpl}" ] || return 0

  cur_sig="$(md5sum "${tmpl}" 2>/dev/null | awk '{print $1}')"
  if [ -z "${cur_sig}" ]; then
    cur_sig="$(wc -c < "${tmpl}" | tr -d ' ')"
  fi

  if [ -f "${stamp}" ] && [ "$(cat "${stamp}" 2>/dev/null)" = "${cur_sig}" ]; then
    return 0
  fi

  bashio::log.info "Confronto ${INI_FILE} con $(basename "${tmpl}")..."

  local block=""
  local n=0
  local key raw

  # Nel template ogni chiave e' descritta dai commenti che la precedono: senza
  # di quelli nell'ini resta un elenco di nomi senza spiegazione. awk emette un
  # record per chiave (commenti + riga della chiave, unite da \001) perche'
  # read ne legge una per volta.
  while IFS=$'\t' read -r key raw; do
    [ -z "${key}" ] && continue
    if ini_has_key "${key}"; then continue; fi
    block="${block}${raw//$'\001'/$'\n'}
"
    n=$((n+1))
    bashio::log.info "  + ${key}"
  done <<EOF
$(awk -v SEP=$'\001' '
  /^[[:space:]]*\[/ { exit }
  {
    s = $0
    sub(/^[[:space:]]+/, "", s)
    sub(/[[:space:]]+$/, "", s)

    # riga vuota: il commento accumulato non descrive la chiave che segue
    if (s == "") { doc = ""; next }

    bare = s
    if (bare ~ /^#/) { sub(/^#[[:space:]]*/, "", bare) }

    if (bare ~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
      k = bare
      sub(/=.*$/, "", k)
      # riga vuota di stacco solo per le chiavi che hanno una descrizione
      printf "%s\t%s#%s\n", k, (doc == "" ? "" : SEP doc), bare
      doc = ""
      next
    }

    # commento di prosa: documentazione della chiave che segue
    if (s ~ /^#/) { doc = doc s SEP }
  }
' "${tmpl}")
EOF

  if [ ${n} -gt 0 ]; then
    ini_insert_block "# --- Chiavi aggiunte dall'add-on dal template (default, commentate) ---
${block}"
    bashio::log.info "Aggiunte ${n} chiavi mancanti a ${INI_FILE}"
  else
    bashio::log.info "Nessuna chiave nuova nel template."
  fi

  printf '%s' "${cur_sig}" > "${stamp}"
}

ini_active_key () {
  # vero solo se la chiave e' attiva, cioe' non commentata
  grep -qE "^[[:space:]]*$1=" "${INI_FILE}"
}

ini_ensure_active () {
  # WALLBOX1_SHARE e PRIORITY_WALLBOX sono lo store of record del server per
  # quota e priorita': il valore che arriva su MQTT viene riscritto qui e
  # riletto all'avvio. Commentate equivalgono ad assenti, quindi ogni riavvio
  # perderebbe entrambe.
  #
  # ini_merge_defaults aggiunge tutto commentato, ed essendo ini_has_key vera
  # anche sulla forma commentata non ci tornerebbe mai piu' sopra: da qui le
  # riattiviamo. Il valore non viene toccato -- resta quello scritto sulla
  # riga, cioe' il default del template -- quindi il comportamento non cambia.
  # Si riattiva l'ULTIMA occorrenza perche' e' quella che il server legge.
  local key="$1"

  if ini_active_key "${key}"; then return 0; fi
  if ! ini_has_key "${key}"; then return 0; fi

  awk -v k="${key}" '
    NR==FNR {
      if ($0 ~ "^[[:space:]]*#[[:space:]]*" k "=") { last=FNR }
      next
    }
    {
      if (FNR==last) {
        s=$0
        sub(/^[[:space:]]*#[[:space:]]*/, "", s)
        print s
      }
      else { print }
    }
  ' "${INI_FILE}" "${INI_FILE}" > "${INI_FILE}.tmp" && mv "${INI_FILE}.tmp" "${INI_FILE}"

  bashio::log.info "${key} era commentata — riattivata ($(grep -E "^[[:space:]]*${key}=" "${INI_FILE}" | tail -1))."
}

ini_merge_defaults "${INI_TEMPLATE}"

# Fuori dal merge: quello gira solo quando cambia il template, mentre una
# chiave di store of record lasciata commentata va riattivata comunque.
ini_ensure_active "WALLBOX1_SHARE"
ini_ensure_active "PRIORITY_WALLBOX"

set_kv () {
  local key="$1"
  local value="$2"

  if [ "${value}" = "null" ]; then
    value=""
  fi

  if [ -z "${value}" ]; then
    return 0
  fi

  # Caso speciale: GRID_LIMIT e GRID_LIMIT_SAFE
  # Non vengono mai attivate né aggiunte: se non sono già attive nell'ini,
  # l'utente deve deciderlo esplicitamente.
  if [ "${key}" = "GRID_LIMIT" ] || [ "${key}" = "GRID_LIMIT_SAFE" ]; then
    if grep -qE "^[[:space:]]*${key}=" "${INI_FILE}"; then
      awk -v k="$key" -v v="$value" '
        BEGIN { done=0 }
        {
          if (!done && $0 ~ "^[[:space:]]*" k "=") {
            print k "=" v
            done=1
          } else {
            print
          }
        }
      ' "${INI_FILE}" > "${INI_FILE}.tmp" && mv "${INI_FILE}.tmp" "${INI_FILE}"
    else
      bashio::log.warning "Chiave attiva ${key} non trovata in ${INI_FILE} — NON modificata."
    fi
    return 0
  fi

  # Comportamento standard per tutte le altre chiavi

  # 1 se esiste attiva → aggiorna
  if grep -qE "^[[:space:]]*${key}=" "${INI_FILE}"; then
    awk -v k="$key" -v v="$value" '
      BEGIN { done=0 }
      {
        if (!done && $0 ~ "^[[:space:]]*" k "=") {
          print k "=" v
          done=1
        } else {
          print
        }
      }
    ' "${INI_FILE}" > "${INI_FILE}.tmp" && mv "${INI_FILE}.tmp" "${INI_FILE}"
    return 0
  fi

  # 2 se esiste commentata → decommenta
  if grep -qE "^[[:space:]]*#[[:space:]]*${key}=" "${INI_FILE}"; then
    awk -v k="$key" -v v="$value" '
      BEGIN { done=0 }
      {
        if (!done && $0 ~ "^[[:space:]]*#[[:space:]]*" k "=") {
          print k "=" v
          done=1
        } else {
          print
        }
      }
    ' "${INI_FILE}" > "${INI_FILE}.tmp" && mv "${INI_FILE}.tmp" "${INI_FILE}"
    return 0
  fi

  # 3 non esiste → la aggiungo nella sezione globale
  # (le chiavi per-wallbox esistono già nel template dentro [wallbox01],
  #  quindi in pratica qui arrivano solo chiavi globali)
  ini_insert_block "${key}=${value}"
  bashio::log.info "Chiave ${key} assente in ${INI_FILE} — aggiunta (${key}=${value})."
}


bashio::log.info "Aggiorno ${INI_FILE} dai parametri add-on..."

set_kv "VERBOSE" "${OCPP_VERBOSE}"

set_kv "MQTT_BROKER" "${MQTT_BROKER}"
set_kv "MQTT_USERNAME" "${MQTT_USER}"
set_kv "MQTT_PASSWORD" "${MQTT_PASS}"

set_kv "WALLBOX_MQTT_NAME" "${WALLBOX_MQTT_NAME}"
set_kv "WALLBOX_SET_LIMIT_UNIT" "${WALLBOX_SET_LIMIT_UNIT}"
set_kv "WALLBOX_SET_LIMIT_MAINSTEP" "${WALLBOX_SET_LIMIT_MAINSTEP}"
set_kv "WALLBOX_SET_LIMIT_FINESTEP" "${WALLBOX_SET_LIMIT_FINESTEP}"

set_kv "GRID_LIMIT" "${GRID_LIMIT}"
set_kv "GRID_LIMIT_SAFE" "${GRID_LIMIT_SAFE}"
set_kv "ADD_WALLBOX_POWER_TO_METER" "${ADD_WALLBOX_POWER_TO_METER}"

set_kv "MINPOWER" "${MINPOWER}"
set_kv "GLOBAL_ENERGY" "${GLOBAL_ENERGY}"
set_kv "USE_STOP_AS_SUSPEND" "${USE_STOP_AS_SUSPEND}"
set_kv "STOP_ON_SUSPENDEV" "${STOP_ON_SUSPENDEV}"

set_kv "METER_MQTT_PREFIX" "${METER_MQTT_PREFIX}"
set_kv "METER_MQTT_POWER" "${METER_MQTT_POWER}"
set_kv "PV_MQTT_PREFIX" "${PV_MQTT_PREFIX}"

set_kv "METER_MQTT_L1_POWER" "${METER_MQTT_L1_POWER}"
set_kv "METER_MQTT_L2_POWER" "${METER_MQTT_L2_POWER}"
set_kv "METER_MQTT_L3_POWER" "${METER_MQTT_L3_POWER}"

set_kv "METER_MQTT_L1_VOLTAGE" "${METER_MQTT_L1_VOLTAGE}"
set_kv "METER_MQTT_L2_VOLTAGE" "${METER_MQTT_L2_VOLTAGE}"
set_kv "METER_MQTT_L3_VOLTAGE" "${METER_MQTT_L3_VOLTAGE}"

set_kv "METER_MQTT_L1_CURRENT" "${METER_MQTT_L1_CURRENT}"
set_kv "METER_MQTT_L2_CURRENT" "${METER_MQTT_L2_CURRENT}"
set_kv "METER_MQTT_L3_CURRENT" "${METER_MQTT_L3_CURRENT}"

set_kv "DATADIR" "${DATA_DIR}"

# I parametri di tuning multiwallbox (WALLBOX1_SHARE, PRIORITY_WALLBOX,
# WAIT_SUSPEND/RESUME/PRIORITY) NON sono opzioni dell'add-on: chi li vuole li
# imposta in ocpp.ini. Il merge col template li ha gia' aggiunti commentati
# col loro default, quindi basta decommentarli.

bashio::log.info "Avvio web log viewer (Python) su porta 8099 (Ingress)"

export OCPP_DATA_DIR="${APP_DIR}/${DATA_DIR:-data}"
export OCPP_LOG="${APP_DIR}/ocpp.log"
export OCPP_DEFAULT_VIEW="${DEFAULT_VIEW:-live}"
export OCPP_INI="${INI_FILE}"

python3 - <<'PY' &
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

import json
LOG          = os.environ["OCPP_LOG"]
INDEX        = "/var/www/index.html"
DATA_DIR     = os.environ["OCPP_DATA_DIR"]
DEFAULT_VIEW = os.environ.get("OCPP_DEFAULT_VIEW", "live")
INI          = os.environ.get("OCPP_INI", "")

def wallbox_names(path):
    """Mappa sezione ini -> nome leggibile della wallbox.

    Una sezione conta come wallbox se contiene almeno un parametro WALLBOX*,
    che e' la stessa regola del server (ocpp_ini.pm): il nome della sezione e'
    arbitrario, [wallbox01] e' solo convenzione. Il nome mostrato e'
    WALLBOX_MQTT_NAME, con l'id di sezione come ripiego.

    La colonna 9 di _charge.dat contiene proprio l'id di sezione, quindi questa
    mappa e' esattamente cio' che serve per etichettare i grafici.
    """
    sections = []
    cur = None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for raw in f:
                s = raw.strip()
                # "[nome]" con eventuale commento in coda: chiudere sulla prima "]"
                # invece di pretendere che la riga finisca lì. Con endswith("]")
                # un "[wallbox02] ; garage" non apriva la sezione e le sue chiavi
                # finivano attribuite a quella precedente.
                if s.startswith("["):
                    end = s.find("]")
                    if end > 0:
                        cur = (s[1:end].strip(), {})
                        sections.append(cur)
                        continue
                if cur is None or not s or s[0] in "#;" or "=" not in s:
                    continue
                k, v = s.split("=", 1)
                cur[1][k.strip()] = v.strip()
    except OSError:
        return {}

    out = {}
    for name, kv in sections:
        if any(k.startswith("WALLBOX") for k in kv):
            out[name] = kv.get("WALLBOX_MQTT_NAME") or name
    return out

class H(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        u = urlparse(self.path)

        if u.path == "/config":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(json.dumps({
                "default_view": DEFAULT_VIEW,
                "wallbox_names": wallbox_names(INI),
            }).encode())
            return

        if u.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                with open(INDEX, "rb") as f:
                    html = f.read()
                # stesso canale gia' usato per default_view: iniettato nella
                # pagina, quindi disponibile prima che i grafici disegnino,
                # senza un fetch in piu' da gestire
                inject = (
                    '<script>'
                    f'window.OCPP_DEFAULT_VIEW="{DEFAULT_VIEW}";'
                    f'window.OCPP_WALLBOX_NAMES={json.dumps(wallbox_names(INI))};'
                    '</script>'
                ).encode()
                html = html.replace(b"</head>", inject + b"</head>", 1)
                self.wfile.write(html)
            except FileNotFoundError:
                self.wfile.write(b"index.html not found in /var/www\n")
            return

        if u.path == "/log":
            qs = parse_qs(u.query)
            n = int(qs.get("n", ["400"])[0])
            n = max(50, min(10000, n))

            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()

            if not os.path.exists(LOG):
                self.wfile.write(f"Log non trovato: {LOG}\n".encode())
                return

            with open(LOG, "rb") as f:
                data = f.read().splitlines()[-n:]
            self.wfile.write(b"\n".join(data) + b"\n")
            return

        if u.path.startswith("/data/"):
            rel = u.path[len("/data/"):].lstrip("/")
            if ".." in rel or rel == "":
                self.send_response(404)
                self.end_headers()
                return
            path = os.path.join(DATA_DIR, rel)
            if os.path.isfile(path):
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with open(path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()
            return

        # --- static files from /var/www (icon.png, css, js, ...)
        if u.path.startswith("/"):
            rel = u.path.lstrip("/")
            # sicurezza: niente path traversal
            if ".." in rel or rel.startswith(("/", "\\")) or rel == "":
                self.send_response(404)
                self.end_headers()
                return

            path = os.path.join("/var/www", rel)

            if os.path.isfile(path):
                # content-type base (basta per png/svg/css/js)
                ext = os.path.splitext(path)[1].lower()
                ctype = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".svg": "image/svg+xml",
                    ".css": "text/css; charset=utf-8",
                    ".js": "application/javascript; charset=utf-8",
                    ".ico": "image/x-icon",
                }.get(ext, "application/octet-stream")

                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with open(path, "rb") as f:
                    self.wfile.write(f.read())
                return


        self.send_response(404)
        self.end_headers()

HTTPServer(("0.0.0.0", 8099), H).serve_forever()
PY

bashio::log.info "Avvio: perl ocpp.pl"
cd "${APP_DIR}"
exec perl ocpp.pl


