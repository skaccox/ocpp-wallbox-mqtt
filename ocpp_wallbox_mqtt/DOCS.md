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
- `15` = full debug

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

Two wallboxes are supported: the first connects on **port 9000**, the second on
**9001**. There is nothing to configure for this — point the second wallbox at
port 9001 and it works.

Those ports are deliberately **not** add-on options. The server binds both by
default, and since the add-on runs with `host_network: true` it binds them
straight on the Home Assistant host, with no port mapping in between — so there
would be nothing for an add-on setting to do.

To move them, set `LISTEN0` and/or `LISTEN1` in `ocpp.ini`: the server reads any
`LISTEN<n>` key as the listening port of the n-th wallbox. Both are already in
your `ocpp.ini` as commented defaults, so uncomment and edit. The add-on never
writes those keys, so whatever you put there stays.

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
WALLBOX_MQTT_BASE=wallbox01
WALLBOX_MQTT_NAME=Garage

[wallbox02]
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
Automatically pull the latest OCPP MQTT Perl Server code from Git at every startup.

When enabled, the add-on will check for updates and perform a git pull each time it starts.

⚠️ This updates the server engine, not the Home Assistant add-on itself.

---

### 🔄 Single update now

#### `single_update_now`
Perform a one-time update of the OCPP MQTT Perl Server at the next add-on startup.

When enabled, the add-on will execute a git pull once and then automatically reset this option to false.

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