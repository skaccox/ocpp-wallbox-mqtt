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
DEFAULT_CODE_REPO="https://gitlab.com/skaccox/ocpp-mqtt-perl-server.git"
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

# Aggiornamento chiesto dalla UI: il web server scrive il flag e fa riavviare
# l'add-on, cosi' il pull avviene qui - prima che perl riparta - e non sotto ai
# piedi del processo in esecuzione. La prima riga del flag dice chi l'ha
# chiesto: "manual" (pulsante UPDATE) o "auto" (controllo orario con
# auto_update attivo), e da li' dipende se l'allineamento puo' essere forzato.
UPDATE_FLAG="${APP_DIR}/.addon-update-now"
UPDATE_STATE="${APP_DIR}/.addon-update-last"

UPDATE_REQUEST=""
if [ -f "${UPDATE_FLAG}" ]; then
  UPDATE_REQUEST="$(head -n 1 "${UPDATE_FLAG}" 2>/dev/null | tr -d '[:space:]')"
  case "${UPDATE_REQUEST}" in
    manual|auto) ;;
    # flag illeggibile: si aggiorna comunque, ma senza forzare nulla
    *) UPDATE_REQUEST="auto" ;;
  esac
fi

UPDATE_REQUESTED=false
if [ -n "${UPDATE_REQUEST}" ]; then
  UPDATE_REQUESTED=true
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

update_state_write() {
  # Esito dell'ultimo aggiornamento chiesto dalla UI: senza, un pull rifiutato
  # resterebbe solo nel log dell'add-on e il pulsante UPDATE ricomparirebbe
  # senza spiegazione. L'ultimo campo e' il commit che si stava inseguendo: il
  # controllo orario ci riprova da solo solo quando quello cambia, altrimenti
  # un errore stabile (branch divergente) farebbe riavviare l'add-on in loop.
  local target
  target="$(git -C "${APP_DIR}" rev-parse --verify --quiet "refs/remotes/origin/${CODE_REF}" 2>/dev/null || true)"
  printf '%s\t%s\t%s\t%s\n' "$1" "$(date '+%Y-%m-%d %H:%M:%S')" "$2" "${target}" \
    > "${UPDATE_STATE}" 2>/dev/null || true
}

git_try_update() {
  # best-effort: non deve mai far morire lo startup.
  # $1 = chi ha chiesto l'aggiornamento: "" (auto_update all'avvio), "auto"
  # (controllo orario della UI) o "manual" (pulsante UPDATE). Solo "manual" e'
  # una richiesta esplicita dell'utente, quindi solo li', se il fast-forward
  # non passa, ci si allinea comunque a origin/<ref>: negli altri due casi la
  # versione attuale resta dov'e'. Come in git_switch_ref non si usa mai
  # "git clean": ocpp.ini, i log e data/ non sono tracciati.
  local req="${1:-}"

  local force=false
  if [ "${req}" = "manual" ]; then force=true; fi

  # l'esito serve alla UI solo se l'aggiornamento l'ha chiesto lei
  local report=false
  if [ -n "${req}" ]; then report=true; fi

  set +e

  git -C "${APP_DIR}" fetch --prune origin "${CODE_REF}" >/dev/null 2>&1
  local r1=$?
  if [ $r1 -ne 0 ]; then
    bashio::log.warning "Git fetch fallito (rete non pronta?). Mantengo la versione attuale."
    if [ "${report}" = "true" ]; then
      update_state_write "error" "git fetch fallito (repo non raggiungibile?)"
    fi
    set -e
    return 0
  fi

  git -C "${APP_DIR}" pull --ff-only origin "${CODE_REF}" >/dev/null 2>&1
  local r2=$?
  if [ $r2 -ne 0 ]; then
    if [ "${force}" = "true" ] && git -C "${APP_DIR}" rev-parse --verify --quiet "refs/remotes/origin/${CODE_REF}" >/dev/null 2>&1; then
      bashio::log.warning "Fast-forward non possibile: allineo a origin/${CODE_REF} (richiesto dal pulsante UPDATE)."
      git -C "${APP_DIR}" checkout -f -B "${CODE_REF}" "origin/${CODE_REF}" >/dev/null 2>&1
      local r3=$?
      if [ $r3 -eq 0 ]; then
        git -C "${APP_DIR}" branch --set-upstream-to="origin/${CODE_REF}" "${CODE_REF}" >/dev/null 2>&1
        update_state_write "ok" "allineato a origin/${CODE_REF}"
        set -e
        bashio::log.info "Update git completato."
        return 0
      fi
      update_state_write "error" "checkout di origin/${CODE_REF} fallito"
    else
      bashio::log.warning "Git pull non eseguito (branch divergente o modifiche locali). Mantengo la versione attuale."
      if [ "${report}" = "true" ]; then
        update_state_write "error" "pull rifiutato: branch divergente o modifiche locali ai file tracciati"
      fi
    fi
    set -e
    return 0
  fi

  set -e
  if [ "${report}" = "true" ]; then
    update_state_write "ok" "aggiornato"
  fi
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
      if git_switch_ref; then
        # il checkout porta gia' alla punta del ref: un update chiesto dal
        # pulsante e' servito
        rm -f "${UPDATE_FLAG}"
      else
        bashio::log.warning "Cambio repo/ref non applicato: avvio la versione attuale."
      fi
    else
      bashio::log.warning "Rete non disponibile: cambio repo/ref rinviato al prossimo avvio."
    fi
  elif bashio::config.true 'auto_update' || [ "${UPDATE_REQUESTED}" = "true" ]; then
    if wait_net; then
      bashio::log.info "Aggiornamento (git pull)..."
      git_try_update "${UPDATE_REQUEST}"
      # flag consumato: altrimenti l'update si ripeterebbe a ogni riavvio
      if [ "${UPDATE_REQUESTED}" = "true" ]; then
        bashio::log.info "Reset flag update (${UPDATE_REQUEST})"
        rm -f "${UPDATE_FLAG}"
      fi
    else
      bashio::log.warning "Rete ancora non disponibile: salto auto_update e avvio la versione attuale."
      # flag NON consumato: senza rete l'update chiesto non e' stato fatto
      if [ "${UPDATE_REQUESTED}" = "true" ]; then
        update_state_write "error" "rete non disponibile all'avvio: riprovo al prossimo riavvio"
      fi
    fi
  else
    bashio::log.info "Auto update disabled, skipping git update"
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
export OCPP_APP_DIR="${APP_DIR}"
export OCPP_CODE_REPO="${CODE_REPO}"
export OCPP_CODE_REF="${CODE_REF}"
export OCPP_AUTO_UPDATE="$(bashio::config.true 'auto_update' && echo true || echo false)"

python3 - <<'PY' &
import os
import re
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import json
LOG          = os.environ["OCPP_LOG"]
INDEX        = "/var/www/index.html"
DATA_DIR     = os.environ["OCPP_DATA_DIR"]
DEFAULT_VIEW = os.environ.get("OCPP_DEFAULT_VIEW", "live")
INI          = os.environ.get("OCPP_INI", "")

APP_DIR      = os.environ.get("OCPP_APP_DIR", "")
CODE_REPO    = os.environ.get("OCPP_CODE_REPO", "")
CODE_REF     = os.environ.get("OCPP_CODE_REF", "main")
UPDATE_FLAG  = os.path.join(APP_DIR, ".addon-update-now")  if APP_DIR else ""
UPDATE_STATE = os.path.join(APP_DIR, ".addon-update-last") if APP_DIR else ""
SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
AUTO_UPDATE  = os.environ.get("OCPP_AUTO_UPDATE", "false") == "true"

# Ogni quanto ricontrollare il repo del server perl, e ogni quanto riprovare
# se il controllo non e' riuscito (tipicamente rete non pronta all'avvio).
VERSION_TTL   = 3600
VERSION_RETRY = 120

# Dopo un aggiornamento automatico fallito si riprova solo se nel frattempo e'
# cambiato il commit da inseguire, o comunque non prima di questo tempo.
AUTO_RETRY_COOLDOWN = 6 * 3600

_git_lock      = threading.Lock()
_cache_lock    = threading.Lock()
_version_data  = None
_version_when  = 0
_restart_error = ""
_auto_tried    = False


def git(*args, timeout=60):
    try:
        p = subprocess.run(
            ["git", "-C", APP_DIR, *args],
            capture_output=True, text=True, timeout=timeout,
        )
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except Exception as e:  # git assente, timeout, ...
        return 1, "", str(e)


def git_out(*args, **kw):
    rc, out, _ = git(*args, **kw)
    return out if rc == 0 else ""


def commit_info(rev):
    """(sha, sha breve, data ISO, oggetto) del commit, o campi vuoti."""
    out = git_out("log", "-1", "--format=%H%x1f%h%x1f%cI%x1f%s", rev)
    f = out.split("\x1f") if out else []
    if len(f) != 4:
        return {"sha": "", "short": "", "date": "", "subject": ""}
    return {"sha": f[0], "short": f[1], "date": f[2], "subject": f[3]}


def read_update_state():
    """Esito dell'ultimo aggiornamento chiesto dalla UI, scritto da run.sh."""
    if not UPDATE_STATE:
        return None
    try:
        with open(UPDATE_STATE, "r", encoding="utf-8", errors="replace") as fh:
            line = fh.readline().strip()
    except OSError:
        return None
    if not line:
        return None
    f = line.split("\t")
    return {
        "status":  f[0],
        "when":    f[1] if len(f) > 1 else "",
        "message": f[2] if len(f) > 2 else "",
        "target":  f[3] if len(f) > 3 else "",
    }


CHG_RE = re.compile(r"\bCHG\*")
PWR_RE = re.compile(r"\bP\s*=\s*([0-9]+(?:[.,][0-9]+)?)")
TS_RE  = re.compile(r"^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})")


def charging_now(max_age=180, min_w=50):
    """Ricarica in corso, secondo le ultime righe del log.

    Stessa regola della vista live (CHG* con P>50): un riavvio in mezzo a una
    sessione fa cadere la connessione della wallbox, quindi l'aggiornamento
    automatico aspetta che sia finita. Nel dubbio si risponde False: bloccare
    per sempre gli aggiornamenti sarebbe peggio.
    """
    try:
        with open(LOG, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            fh.seek(max(0, fh.tell() - 200000))
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return False

    for line in reversed(lines[-4000:]):
        if not CHG_RE.search(line):
            continue
        pwr = PWR_RE.search(line)
        ts = TS_RE.match(line)
        if not pwr or not ts:
            continue
        try:
            when = time.mktime(tuple(int(x) for x in ts.groups()) + (0, 0, -1))
        except (ValueError, OverflowError):
            return False
        if time.time() - when > max_age:
            return False  # ultima riga di carica troppo vecchia
        try:
            return float(pwr.group(1).replace(",", ".")) > min_w
        except ValueError:
            return False
    return False


def version_info(fetch=True):
    """Commit in uso vs punta del ref configurato.

    Il repo del server e' un'opzione (code_repo/code_ref) e non pubblica un
    numero di versione, quindi l'unico confronto affidabile e' fra HEAD e la
    punta del ref su origin: funziona anche su un fork o su un branch proprio.
    """
    info = {
        "repo": CODE_REPO,
        "ref": CODE_REF,
        "local": "", "local_short": "", "local_date": "", "local_subject": "",
        "remote": "", "remote_short": "", "remote_date": "", "remote_subject": "",
        "behind": 0, "ahead": 0,
        "update_available": False,
        "pinned": False,
        "dirty": False,
        "pending": bool(UPDATE_FLAG) and os.path.isfile(UPDATE_FLAG),
        "last_update": read_update_state(),
        "restart_error": _restart_error,
        "auto_update": AUTO_UPDATE,
        "charging": charging_now(),
        "error": "",
    }

    if not APP_DIR or not os.path.isdir(os.path.join(APP_DIR, ".git")):
        info["error"] = "repository git non trovato"
        return info

    with _git_lock:
        head = commit_info("HEAD")
        info["local"]         = head["sha"]
        info["local_short"]   = head["short"]
        info["local_date"]    = head["date"]
        info["local_subject"] = head["subject"]

        if fetch:
            rc, _, err = git("fetch", "--prune", "--tags", "origin", timeout=60)
            if rc != 0:
                info["error"] = (err.splitlines() or ["git fetch fallito"])[-1]

        # branch remoto, altrimenti tag: un ref pinnato a uno SHA non ha una
        # punta da inseguire, quindi non si offre nessun aggiornamento
        target = ""
        if git_out("rev-parse", "--verify", "--quiet",
                   "refs/remotes/origin/%s" % CODE_REF):
            target = "refs/remotes/origin/%s" % CODE_REF
        elif git_out("rev-parse", "--verify", "--quiet",
                     "refs/tags/%s" % CODE_REF):
            target = "refs/tags/%s^{commit}" % CODE_REF
        else:
            info["pinned"] = True

        if target:
            rem = commit_info(target)
            info["remote"]         = rem["sha"]
            info["remote_short"]   = rem["short"]
            info["remote_date"]    = rem["date"]
            info["remote_subject"] = rem["subject"]

            for key, rng in (("behind", "HEAD..%s" % target),
                             ("ahead",  "%s..HEAD" % target)):
                n = git_out("rev-list", "--count", rng)
                info[key] = int(n) if n.isdigit() else 0

            info["update_available"] = info["behind"] > 0

        info["dirty"] = bool(git_out("status", "--porcelain", "--untracked-files=no"))

    return info


def version_cached(refresh=False):
    global _version_data, _version_when
    with _cache_lock:
        data, when = _version_data, _version_when

    if refresh or data is None:
        # Alla prima richiesta, prima che il worker abbia fatto il suo giro, si
        # risponde senza fetch: istantaneo e comunque significativo (se doveva
        # aggiornare, run.sh ha gia' fatto fetch all'avvio).
        data = version_info(fetch=refresh)
        when = time.time() if refresh else 0
        with _cache_lock:
            _version_data, _version_when = data, when
    else:
        # i campi volatili non aspettano il prossimo giro del worker
        data = dict(data)
        data["pending"] = bool(UPDATE_FLAG) and os.path.isfile(UPDATE_FLAG)
        data["last_update"] = read_update_state()
        data["restart_error"] = _restart_error
        data["charging"] = charging_now()

    out = dict(data)
    out["checked"] = int(when)
    return out


def maybe_auto_update(info):
    """Con auto_update attivo, il controllo orario applica da solo l'update.

    Senza, auto_update aggiorna solo all'avvio dell'add-on: chi non riavvia mai
    non aggiorna mai. Le condizioni servono a non trasformarlo in un ciclo di
    riavvii, e a non tagliare una ricarica in corso.
    """
    global _auto_tried

    if not AUTO_UPDATE or _auto_tried:
        return
    if not info.get("update_available") or info.get("pending"):
        return
    if info.get("error"):
        return  # fetch fallito: non c'e' niente di affidabile da inseguire
    if info.get("charging"):
        return  # si riprova al giro dopo, a sessione finita

    st = info.get("last_update") or {}
    if st.get("status") == "error":
        if st.get("target"):
            # gia' fallito inseguendo questo stesso commit: riprovarci non
            # cambierebbe l'esito, riavvierebbe soltanto. Con un commit nuovo
            # invece un tentativo ha senso.
            if st["target"] == info.get("remote"):
                return
        else:
            # errore senza un commit di riferimento (fetch fallito): si
            # riprova a tempo
            try:
                if time.time() - os.path.getmtime(UPDATE_STATE) < AUTO_RETRY_COOLDOWN:
                    return
            except OSError:
                pass

    _auto_tried = True
    request_update("auto")


def version_worker():
    """Controllo periodico, sempre attivo anche con auto_update disattivo.

    Il primo giro e' quasi subito: e' quello che fa comparire la freccia sulla
    versione in cima, e aspettarlo mezzo minuto si nota.
    """
    global _version_data, _version_when
    time.sleep(3)  # lasciar partire perl e la rete
    while True:
        wait = VERSION_TTL
        try:
            data = version_info(fetch=True)
            with _cache_lock:
                _version_data, _version_when = data, time.time()
            maybe_auto_update(data)
            if data.get("error"):
                # all'avvio la rete puo' non essere ancora pronta: riprovare
                # fra un'ora vorrebbe dire un'ora senza sapere se c'e' un update
                wait = VERSION_RETRY
        except Exception:
            wait = VERSION_RETRY
        time.sleep(wait)


def supervisor_restart():
    """Riavvio dell'add-on: il pull vero lo fa run.sh alla ripartenza."""
    global _restart_error
    if not SUPERVISOR_TOKEN:
        _restart_error = "SUPERVISOR_TOKEN non disponibile"
        return
    last = ""
    for host in ("supervisor", "172.30.32.2"):
        req = urllib.request.Request(
            "http://%s/addons/self/restart" % host,
            data=b"", method="POST",
            headers={"Authorization": "Bearer " + SUPERVISOR_TOKEN},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                r.read()
            return
        except Exception as e:
            last = str(e)
    _restart_error = last or "riavvio non riuscito"


def request_update(origin="manual"):
    """Marca l'aggiornamento e chiede il riavvio dell'add-on.

    Il git pull non si fa da qui: cambiare i file sotto ai piedi del perl in
    esecuzione non ha senso. Si scrive il flag e aggiorna run.sh alla
    ripartenza, con lo stesso percorso gia' usato da auto_update. L'origine
    finisce nel flag perche' solo la richiesta esplicita dell'utente ("manual")
    autorizza run.sh a forzare l'allineamento a origin/<ref>.
    """
    global _restart_error
    if not UPDATE_FLAG:
        return False, "app dir non configurata"
    try:
        with open(UPDATE_FLAG, "w", encoding="utf-8") as fh:
            fh.write("%s\n%d\n" % (origin, int(time.time())))
    except OSError as e:
        return False, str(e)

    _restart_error = ""
    # la risposta va spedita prima: il riavvio uccide questo processo
    threading.Timer(1.0, supervisor_restart).start()
    return True, ""


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

    def send_json(self, payload, code=200):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        u = urlparse(self.path)

        if u.path == "/update":
            try:
                length = int(self.headers.get("Content-Length") or 0)
                if length:
                    self.rfile.read(length)
            except (TypeError, ValueError):
                pass
            ok, err = request_update("manual")
            self.send_json({"ok": ok, "error": err}, 200 if ok else 500)
            return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)

        if u.path == "/version":
            qs = parse_qs(u.query)
            refresh = qs.get("refresh", ["0"])[0] in ("1", "true", "yes")
            self.send_json(version_cached(refresh))
            return

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

threading.Thread(target=version_worker, daemon=True).start()

# ThreadingHTTPServer: il controllo versione e l'update non devono bloccare il
# polling del log
ThreadingHTTPServer(("0.0.0.0", 8099), H).serve_forever()
PY

bashio::log.info "Avvio: perl ocpp.pl"
cd "${APP_DIR}"
exec perl ocpp.pl


