<img width="128" height="128" alt="image" src="https://github.com/user-attachments/assets/2ee05e17-5e18-44da-8bfc-cb902f76ccfc" />
<b>OCPP Wallbox MQTT Server (Home Assistant Add-on)</b>

## ⚙️ Configuration

All options are configured in the add-on UI.

---

### 🔌 Wallbox settings

#### `wallbox_set_limit_unit`
Power unit used to control the wallbox.

Allowed values:
- `W` = Watts
- `A` = Amps

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
- `7` when using Watts

---

#### `STOP_ON_SUSPENDEV`
Seconds to wait before stopping the charge when the EV enters suspended state.

This avoids idle energy waste (some EVs like Tesla may draw ~200W while suspended).

Example:

0 → disabled
30 → stop after 30 seconds
60 → stop after 1 minute


---

### 📊 MQTT Meter integration (optional)

If you have a power meter publishing data via MQTT, you can link it here.

#### `METER_MQTT_PREFIX`
Base MQTT topic for meter values.

Example: home/meter/grid/power


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

### 🔄 Auto update

#### `auto_update`
Automatically pull the latest OCPP MQTT Perl Server code from Git at every startup.

⚠️ This updates the server engine, not the Home Assistant add-on itself.

---

## 📌 Profiles

You need to check profile configuration inside ocpp.ini

---

## ⭐ Tips

After installing, go to /config/ocpp.ini and verify the configuration (the add-on reads its settings from there).

Huawei SmartCharger note: for Huawei SmartCharger, WALLBOX_SET_LIMIT_UNIT must be set to W (watts).

Configure the wallbox to connect to the OCPP server with:

Port: 9000

Encryption: none (no TLS)

Username/Password: none

---


## ⚙️ Automation

Home Assistant automation (example)

To provide the grid meter values (e.g., Huawei EMMA-A02) to the server via MQTT, create an automation like this:
```
alias: MQTT – EMMA meter completo
description: ""
triggers:
  - entity_id:
      - sensor.emma_potenza_di_alimentazione_in_ingresso
      - sensor.emma_tensione_fase_a
      - sensor.emma_corrente_fase_a
    trigger: state
actions:
  - data:
      topic: home/meter/grid/power
      payload: "{{ states('sensor.emma_potenza_di_alimentazione_in_ingresso') }}"
      retain: true
    action: mqtt.publish
  - data:
      topic: home/meter/grid/l1_voltage
      payload: "{{ states('sensor.emma_tensione_fase_a') }}"
      retain: true
    action: mqtt.publish
  - data:
      topic: home/meter/grid/l1_current
      payload: "{{ states('sensor.emma_corrente_fase_a') }}"
      retain: true
    action: mqtt.publish
mode: queued
```
---