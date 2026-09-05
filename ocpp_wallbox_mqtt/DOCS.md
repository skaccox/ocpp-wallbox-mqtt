<img width="128" height="128" alt="image" src="https://github.com/user-attachments/assets/2ee05e17-5e18-44da-8bfc-cb902f76ccfc" />
<b>OCPP Wallbox MQTT Server (Home Assistant Add-on)</b>

## ⚙️ Configuration

All options are configured in the add-on UI.

---

### 🔌 Wallbox settings

#### `wallbox_set_limit_unit`
Power unit used to control the wallbox.

Allowed values:
- `W` = Watts (required for Huawei SmartCharger)  
- `A` = Amps

---

#### `wallbox_set_limit_mainstep`
Step used when converting Watt power changes into real Ampere increments.

This parameter defines how many Amps are added or removed at each adjustment when controlling the wallbox in Watts mode.

It replaces the old internal compensation logic (removed since v1.9910) to avoid cumulative errors and drifting values.

Default:
- `1` (1 Amp step)

Typical usage:
- Keep `1` for precise control  
- Increase slightly if your wallbox reacts too slowly to power changes  

---

#### `wallbox_set_limit_finestep`
Decimal precision supported by the wallbox when setting current limits.

This allows the server to send Ampere values with decimal digits instead of rounding to integers.

Example values:
- `0.01` → wallbox supports two decimal places (recommended for Huawei SmartCharger)  
- `0.1` → one decimal place  
- `1` → integer Amps only  


---

> ℹ️ When using `W` mode, the server adjusts power by translating Watt changes into real Ampere steps using `WALLBOX_SET_LIMIT_MAINSTEP`, then applies decimal precision defined by `WALLBOX_SET_LIMIT_FINESTEP`.

---


#### `ocpp_verbose`
Log verbosity of the OCPP server.

Range:
- `0` = minimal logs  
- `22` = full debug

---

#### `wallbox_mqtt_name`
MQTT topic prefix for the wallbox.

Example: MyWallbox

---

### 📡 MQTT connection

#### `mqtt_broker`
MQTT broker address.

Example: localhost:1883


#### `mqtt_user`
MQTT username (optional)

#### `mqtt_pass`
MQTT password (optional)

---

### ⚡ Grid power management

#### `GRID_LIMIT`
Maximum grid contract power in Watts.

Typical values:  4000 for 3kw contract

---

#### `GRID_LIMIT_SAFE`
Safety threshold below grid limit to avoid power disconnection.

Example:
GRID_LIMIT = 4000
GRID_LIMIT_SAFE = 3300


---

#### `ADD_WALLBOX_POWER_TO_METER`
If enabled, wallbox power is added to the home meter consumption.

Useful when the meter measures only household loads.

---

### 🔋 Charging control

#### `MINPOWER`
Minimum wallbox charging power.

Recommended:
- `6` when using Watts

---

#### `STOP_ON_SUSPENDEV`
Seconds to wait before stopping the charge when the EV enters suspended state.

This avoids idle energy waste (some EVs like Tesla may draw ~200W while suspended).

Example:

0 → disabled
0:30 → stop after 30 seconds
0:60 → stop after 1 minute


---

### 📊 MQTT Meter integration (optional)

If you have a power meter publishing data via MQTT, you can link it here.

#### `METER_MQTT_PREFIX`
Base MQTT topic for meter values.

Example: `home/grid`

---

#### `METER_MQTT_POWER`
Sub-topic for total grid power (appended to `METER_MQTT_PREFIX`).

Example: `power` → full topic: `home/grid/power`

---

#### Voltage topics

METER_MQTT_L1_VOLTAGE
METER_MQTT_L2_VOLTAGE
METER_MQTT_L3_VOLTAGE


---

#### Current topics

METER_MQTT_L1_CURRENT
METER_MQTT_L2_CURRENT
METER_MQTT_L3_CURRENT


---

#### `PV_MQTT_PREFIX`
Base MQTT topic for PV inverter power. Used by the charts to display solar production.

Example: `home/pv` → the add-on reads `home/pv/power`

---

### 🧭 Code source

The add-on does not bundle the OCPP server: it clones it into
`/config/ocpp-mqtt-perl-server` at first start. Both the repository and the
ref are options, so you can point the add-on at a fork or a specific branch.

#### `code_repo`
Git URL of the OCPP/MQTT Perl server to run.

Default:
- `https://gitlab.com/skaccox/ocpp-mqtt-perl-server.git` (multi-wallbox capable fork)

Upstream is `https://gitlab.com/lucabon/ocpp-mqtt-perl-server.git`.

#### `code_ref`
Branch, tag or commit SHA to check out.

Default:
- `main`

Changing either option is applied **on the next add-on restart, even with
`auto_update` disabled**, because it is an explicit request:

- `code_repo` changed → `git remote set-url origin <new url>`
- `code_ref` changed → `git fetch` + checkout of the new ref

> ℹ️ If the working tree has local modifications to tracked files, the
> checkout is forced so the configured ref always wins. Untracked files —
> `ocpp.ini`, `ocpp.log`, `charge.log` and `data/` all live inside that
> directory — are never touched, and `git clean` is never run.

---

### 🔌🔌 Multi-wallbox

Two wallboxes are supported, and what tells them apart is the **URL path, not
the port**. Each wallbox section has a `WALLBOX_PATH` (it defaults to the name
of the section), and the wallbox must be configured to connect to exactly that
path:

```
ws://<home-assistant-host>:9000/<WALLBOX_PATH>
```

So both wallboxes normally live on **port 9000** — that is the usual setup:

```ini
[wallbox01]
WALLBOX_PATH=giardino     ; ws://ha:9000/giardino

[wallbox02]
WALLBOX_PATH=garage       ; ws://ha:9000/garage
```

A wallbox connecting on a path the server does not know is not recognised, so
if one of the two never shows up in the log, check that path first.

The server also listens on a **second port, 9001**, out of the box. It is a
second socket, not "the port of the second wallbox": either wallbox can use
either port, because identity comes from the path. Use it only if something in
your network makes a single port awkward — and if you do not want it at all,
`LISTEN1=0` in `ocpp.ini` switches it off and leaves the server listening on
9000 alone.

Those ports are deliberately **not** add-on options. The server binds them by
default, and since the add-on runs with `host_network: true` it binds them
straight on the Home Assistant host, with no port mapping in between — so there
would be nothing for an add-on setting to do.

To move them, set `LISTEN0` and/or `LISTEN1` in `ocpp.ini`: the server reads any
`LISTEN<n>` key as a listening port. Both are already in your `ocpp.ini` as
commented defaults, so uncomment and edit. The add-on never writes those keys,
so whatever you put there stays.

**The power-sharing parameters are not add-on options: they live in
`ocpp.ini`.** They are tuning knobs you set once and rarely touch, and putting
them in the add-on UI would only duplicate the ini — with the add-on
overwriting your ini value at every restart.

You do not have to add them by hand. On the first start after an update the
add-on compares `ocpp.ini` with the `ocpp-default.ini` shipped by the server
and appends any missing key **commented, with its default value**, in the
global section. So the keys below are already in your `ocpp.ini`: find them,
uncomment, set. Existing values are never touched.

`WALLBOX1_SHARE` and `PRIORITY_WALLBOX` are the exception: the add-on keeps
them **active**, and uncomments them if it finds them commented out. They are
the server's store of record for the split and the priority — commented out is
the same as absent, and a restart would forget both. Only the `#` is removed,
never the value, so nothing changes in behaviour.

| key | what it does | default |
|---|---|---|
| `WALLBOX1_SHARE` | share of available power for the first wallbox: a number `0`-`100`, and nothing else. Any other value is refused, with a warning in the log naming it, and read as `50` | `50` |
| `PRIORITY_WALLBOX` | which wallbox keeps charging when there is not enough power for both: a position in ini order (`1`, `2`) or a wallbox name — its `WALLBOX_MQTT_NAME`, its path, or its section. The Home Assistant select writes the display name, so the two cannot drift apart | `1` |
| `WAIT_SUSPEND` | delay before suspending a wallbox | `360s` |
| `WAIT_RESUME` | delay before resuming one | `360s` |
| `WAIT_PRIORITY` | how long a suspension in progress is protected from being inverted by a change of `PRIORITY_WALLBOX` | `360s` |

#### Naming the wallboxes in the graphs

Each wallbox is a `[section]` in `ocpp.ini` — any section holding a `WALLBOX*`
parameter counts as one, so `[wallbox01]` is only a convention and the name is
yours to choose. Set `WALLBOX_MQTT_NAME` inside the section and that name is
what the graphs use:

```ini
[wallbox01]
WALLBOX_PATH=wallbox01
WALLBOX_MQTT_BASE=wallbox01
WALLBOX_MQTT_NAME=Garage

[wallbox02]
WALLBOX_PATH=wallbox02
WALLBOX_MQTT_BASE=wallbox02
WALLBOX_MQTT_NAME=Cortile
```

The names show up as series labels in the daily chart, as bar labels in the
week/month chart, in the `EV Total` breakdown and in the session tooltip. If a
section has no `WALLBOX_MQTT_NAME` the graphs fall back to `EV1`/`EV2` for
`wallboxNN` sections, or to the section id for any other name. Renaming takes
effect on the next page reload.

---

For the `WAIT_*` timings a bare number up to 20 is read as loop ticks; add `s`
for seconds. Reducing power is immediate — changing the *number* of active
wallboxes is delayed, because household peaks are transient and closing a
session has a cost.

> ℹ️ Home Assistant decides the split and the priority; the server only
> allocates power and knows nothing about cars or state of charge. An
> automation drives both over MQTT on `ocpp/config/general/WALLBOX1_SHARE`
> and `.../PRIORITY_WALLBOX` without touching the file: the server writes back
> to `ocpp.ini` whatever arrives on those topics. The file stays the store of
> record — at startup the retained MQTT values are published *from* it, not
> the other way round.

---

### 🔄 Auto update

#### `auto_update`
Keep the OCPP MQTT Perl Server in sync with `code_repo` / `code_ref` on its own.

When enabled the add-on updates in two moments:

- **at every startup**, with a `git pull --ff-only` before the Perl server is
  launched;
- **on the hourly check**, if new commits appeared while the add-on was
  running. Without this, an add-on that is never restarted would never update.

The hourly update reuses the same path as the startup one — it marks the
update, restarts the add-on, and the pull happens at startup — so the code is
never swapped underneath the running Perl process. It stays deliberately
conservative:

- it waits while a **charging session is running** (`CHG*` with more than 50 W
  in the last 3 minutes): a restart would drop the wallbox connection. The
  update is applied at one of the next hourly checks.
- it never forces anything. If the fast-forward is refused (diverged branch,
  local changes to tracked files) the current version stays, the reason is
  shown in the UPDATE panel, and the same commit is not retried — otherwise a
  stable failure would restart the add-on every hour. A *new* commit upstream
  is tried again.
- if the check itself cannot reach the repository, nothing is attempted.

With `auto_update` off, nothing is ever updated on its own: the UPDATE button
is the only way in, and it is always available.

⚠️ This updates the server engine, not the Home Assistant add-on itself.

---

### 🔄 Version indicator and update

There is no option for a one-shot update: the web UI does it.

The version of the Perl server is always shown in the header, right after the
clock — `v2.0059`. It is computed with the same rule as `Version()` in
`ocpp_ini.pm`: the highest of `$VERSION{MAIN|INI|FUNC|MQTT|WS}`, compared as
strings, read from the files that are actually running. That is the number the
server publishes on `ocpp/heartbeat`, so the panel and MQTT never disagree —
including the string comparison, which is why the panel is deliberately not
smarter than the server about, say, `10.0` against `9.0`. Which module happens
to hold the highest number changes over time and does not matter; reading
`MAIN` alone did, which is why it showed `1.9935`. If a fork declares none of
those keys, the short git hash is shown instead.

Click it and the panel gives version, commit, subject and date, the repository
and ref being followed, and a **Check now**.

What is *compared*, though, is the commit, not that number: the version string
only moves when upstream decides to bump it, while the code moves at every
commit — and since the repository itself is an option (`code_repo` /
`code_ref`), git is the only reliable reference. So the panel shows both, and
two different commits can legitimately carry the same version number.

The check runs a few seconds after startup and once an hour after that,
whatever `auto_update` says.

When the configured ref is ahead, the indicator turns **amber with an up
arrow**. The panel then shows how many new commits there are and the subject
of the last one; confirming restarts the add-on, and the update itself is done
at startup by the same code path as `auto_update` — never underneath the
running Perl process.

- If the fast-forward is refused (diverged branch, local changes to tracked
  files) the working tree is realigned to `origin/<ref>` anyway, because the
  update was requested explicitly — this is the one difference from the
  automatic update, which in the same situation gives up and reports why.
  Untracked files — `ocpp.ini`, `ocpp.log`, `charge.log`, `data/` — are never
  touched and `git clean` is never run.
- Local commits of your own on that branch are reported in the panel before
  you confirm: updating leaves them behind.
- If `code_ref` is a tag or a commit SHA there is no tip to follow, so no
  update is ever offered — the panel says the server is pinned.
- The outcome of the last attempt is shown in the panel, so a refused update
  no longer hides in the add-on log.
- A charging session in progress is reported before you confirm: the restart
  drops the wallbox connection.

On a phone the label is truncated to keep clear of the clock; the full
version and commit are in the panel.

⚠️ This updates the server engine, not the Home Assistant add-on itself.

---

### 📁 Data directory

#### `data_dir`
Subdirectory (relative to the add-on working directory) where the OCPP server stores its data files, such as energy history and charging session records.

These files are also served by the built-in web interface to display charts and history.

Default: `data`

⚠️ Leave this set to `data` for the charts to work correctly.

---



## 📌 Profiles

You need to check profile configuration inside ocpp.ini

---

## ⭐ Tips

After installing, go to /config/ocpp.ini and verify the configuration (the add-on write its settings here).

Configure the wallbox to connect to the OCPP server with:

Port: 9000

Path: the `WALLBOX_PATH` of its section in `ocpp.ini`, i.e.
`ws://<host>:9000/<WALLBOX_PATH>`

Encryption: none (no TLS)

Username/Password: none

---


## ⚙️ Automation

Home Assistant automation (example)

To provide the grid meter values and PV production (e.g., Huawei EMMA-A02) to the server via MQTT, create an automation like this:
```
alias: MQTT – EMMA meter completo
description: ""
triggers:
  - entity_id: sensor.emma_potenza_di_alimentazione_in_ingresso
    trigger: state
  - entity_id: sensor.emma_tensione_fase_a
    trigger: state
  - entity_id: sensor.emma_corrente_fase_a
    trigger: state
  - entity_id: sensor.emma_potenza_attiva_inverter
    trigger: state
actions:
  - choose:
      - conditions:
          - condition: template
            value_template: >-
              {{ trigger.entity_id ==
              'sensor.emma_potenza_di_alimentazione_in_ingresso' }}
        sequence:
          - action: mqtt.publish
            data:
              topic: home/grid/power
              payload: >-
                {{
                states('sensor.emma_potenza_di_alimentazione_in_ingresso')|float(0)
                }}
              retain: true
      - conditions:
          - condition: template
            value_template: "{{ trigger.entity_id == 'sensor.emma_tensione_fase_a' }}"
        sequence:
          - action: mqtt.publish
            data:
              topic: home/grid/l1_voltage
              payload: "{{ states('sensor.emma_tensione_fase_a')|float(0) }}"
              retain: true
      - conditions:
          - condition: template
            value_template: "{{ trigger.entity_id == 'sensor.emma_corrente_fase_a' }}"
        sequence:
          - action: mqtt.publish
            data:
              topic: home/grid/l1_current
              payload: "{{ states('sensor.emma_corrente_fase_a')|float(0) }}"
              retain: true
      - conditions:
          - condition: template
            value_template: "{{ trigger.entity_id == 'sensor.emma_potenza_attiva_inverter' }}"
        sequence:
          - action: mqtt.publish
            data:
              topic: home/pv/power
              payload: "{{ states('sensor.emma_potenza_attiva_inverter')|float(0) }}"
              retain: true
mode: queued
```
---