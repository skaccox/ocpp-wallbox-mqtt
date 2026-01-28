#!/usr/bin/with-contenv bashio
set -e

APP_DIR="/config/ocpp-mqtt-perl-server"
INI_FILE="/config/ocpp-mqtt-perl-server/ocpp.ini"

OCPP_VERBOSE="$(bashio::config 'ocpp_verbose')"
# ---- Parametri UI ----
WALLBOX_SET_LIMIT_UNIT="$(bashio::config 'wallbox_set_limit_unit')"

WALLBOX_SET_LIMIT_MAINSTEP="$(bashio::config 'wallbox_set_limit_mainstep')"
WALLBOX_SET_LIMIT_FINESTEP="$(bashio::config 'wallbox_set_limit_finestep' | tr ',' '.')"

GRID_LIMIT="$(bashio::config 'grid_limit')"
GRID_LIMIT_SAFE="$(bashio::config 'grid_limit_safe')"

MINPOWER="$(bashio::config 'minpower')"
STOP_ON_SUSPENDEV="$(bashio::config 'stop_on_suspendev')"

METER_MQTT_PREFIX="$(bashio::config 'meter_mqtt_prefix')"
METER_MQTT_POWER="$(bashio::config 'meter_mqtt_power')"

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

CODE_REPO="https://gitlab.com/lucabon/ocpp-mqtt-perl-server.git"
CODE_REF="main"
AUTO_UPDATE="$(bashio::config 'auto_update')"

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
if [ ! -d "${APP_DIR}/.git" ]; then
  # Prima installazione: senza rete non possiamo andare avanti
  bashio::log.info "Cloning ocpp-mqtt-perl-server..."

  # piccola attesa rete (max ~15s) per evitare fail subito
  tries=0
  while [ $tries -lt 5 ]; do
    if have_net; then break; fi
    tries=$((tries+1))
    bashio::log.warning "Rete non pronta (tentativo ${tries}/5). Attendo 3s..."
    sleep 3
  done

  if ! have_net; then
    bashio::log.error "Rete non disponibile: impossibile clonare ${CODE_REPO}. Riprova quando HA ha connettività."
    exit 1
  fi

  rm -rf "${APP_DIR}"
  if ! git clone --branch "${CODE_REF}" "${CODE_REPO}" "${APP_DIR}"; then
    bashio::log.error "Clone fallito. Verifica repo/ref o connettività."
    exit 1
  fi
else
  if bashio::config.true 'auto_update'; then
    # rete spesso non pronta subito: pochi retry, ma non blocchiamo lo start
    tries=0
    while [ $tries -lt 5 ]; do
      if have_net; then
        bashio::log.info "Aggiornamento (git pull)..."
        git_try_update
        break
      fi
      tries=$((tries+1))
      bashio::log.warning "Rete non pronta per git pull (tentativo ${tries}/5). Attendo 3s..."
      sleep 3
    done

    if ! have_net; then
      bashio::log.warning "Rete ancora non disponibile: salto auto_update e avvio la versione attuale."
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

# ---- Create ini if missing ----
if [ ! -f "${INI_FILE}" ]; then
  mkdir -p "$(dirname "${INI_FILE}")"

  if [ -f "${APP_DIR}/ocpp-default.ini" ]; then
    cp -f "${APP_DIR}/ocpp-default.ini" "${INI_FILE}"
    bashio::log.info "Creato ${INI_FILE} da ocpp-default.ini"
  elif [ -f "${APP_DIR}/default.ini" ]; then
    cp -f "${APP_DIR}/default.ini" "${INI_FILE}"
    bashio::log.info "Creato ${INI_FILE} da default.ini"
  else
    bashio::log.error "Non trovo ${INI_FILE} e non trovo template ini (ocpp-default.ini/default.ini) in ${APP_DIR}"
    exit 1
  fi
fi

set_kv () {
  local key="$1"
  local value="$2"

  if grep -qE "^[[:space:]]*${key}=" "${INI_FILE}"; then
    # replace ONLY the first occurrence
    sed -i -E "0,/^[[:space:]]*${key}=/{s|^[[:space:]]*${key}=.*|${key}=${value}|}" "${INI_FILE}"
  else
    echo "${key}=${value}" >> "${INI_FILE}"
  fi
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

set_kv "METER_MQTT_L1_VOLTAGE" "${METER_MQTT_L1_VOLTAGE}"
set_kv "METER_MQTT_L2_VOLTAGE" "${METER_MQTT_L2_VOLTAGE}"
set_kv "METER_MQTT_L3_VOLTAGE" "${METER_MQTT_L3_VOLTAGE}"

set_kv "METER_MQTT_L1_CURRENT" "${METER_MQTT_L1_CURRENT}"
set_kv "METER_MQTT_L2_CURRENT" "${METER_MQTT_L2_CURRENT}"
set_kv "METER_MQTT_L3_CURRENT" "${METER_MQTT_L3_CURRENT}"

bashio::log.info "Avvio web log viewer (Python) su porta 8099 (Ingress)"

python3 - <<'PY' &
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

LOG = "/config/ocpp-mqtt-perl-server/ocpp.log"
INDEX = "/var/www/index.html"

class H(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        u = urlparse(self.path)

        if u.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                with open(INDEX, "rb") as f:
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.wfile.write(b"index.html not found in /var/www\n")
            return

        if u.path == "/log":
            qs = parse_qs(u.query)
            n = int(qs.get("n", ["400"])[0])
            n = max(50, min(5000, n))

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


