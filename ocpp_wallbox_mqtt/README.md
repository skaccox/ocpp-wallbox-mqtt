<img width="128" height="128" alt="image" src="https://github.com/user-attachments/assets/2ee05e17-5e18-44da-8bfc-cb902f76ccfc" />
<b>OCPP Wallbox MQTT Server (Home Assistant Add-on)</b>


This Home Assistant add-on runs the OCPP MQTT Perl Server to integrate OCPP-compatible EV chargers (wallboxes) via MQTT.

It enables advanced load management, grid limit protection, solar surplus charging and dynamic power control.

The add-on wraps the OCPP MQTT Perl Server, originally by Luca Bonissi:
https://gitlab.com/lucabon/ocpp-mqtt-perl-server

By default it runs the multi-wallbox capable fork, and both the repository and
the branch are add-on options (`code_repo` / `code_ref`), so you can point it
at upstream or at any fork:
https://gitlab.com/skaccox/ocpp-mqtt-perl-server

Two wallboxes are supported: both connect on port 9000 and are told apart by the
URL path (`ws://host:9000/<WALLBOX_PATH>`), one path per wallbox section in `ocpp.ini`.

It supports core OCPP features for managing charging sessions and reporting meter data, and includes dynamic load management to automatically adjust the charger’s power limits based on configurable rules (e.g., time of day / day of week) to optimize grid import and comply with power constraints.

The add-on also includes an automatic update mechanism, making it easy to stay in sync with the upstream project and receive improvements and fixes without manual reinstall steps.

Ideal for users who want a simple, self-hosted OCPP + MQTT bridge inside Home Assistant for monitoring, control, and smart power limiting.

## You need to remove existing other OCPP Server/Integration. This addon already include an OCPP server.

---

## ⚙️ Configuration Notes

The add-on configuration panel exposes only the **main parameters**, which are automatically written to:

```
/config/ocpp-mqtt-perl-server/ocpp.ini
```

These options cover the most common settings such as MQTT connection, grid limits, power management and basic behavior flags.

Advanced parameters, charging profiles, OCPP keys and other fine-tuning options can be edited directly inside the `ocpp.ini` file.

You can modify the file using the **File Editor** add-on.

⚡ **No restart is required** — changes to `ocpp.ini` are applied dynamically by the server.

This allows advanced users to fully customize the OCPP engine while keeping the add-on configuration simple and clean.

---

## 🔌 Huawei Smart Charger

For **Huawei Smart Charger / Huawei Wallbox**, the following configuration is recommended:

```ini
WALLBOX_SET_LIMIT_UNIT=W
USE_STOP_AS_SUSPEND=1
WALLBOX_SET_LIMIT_ZERO_ON_STOP=1
CONFKEY=MeterValuesSampledData:Current.Import,Current.Offered,Energy.Active.Import.Register,Power.Active.Import,Voltage,Frequency,Temperature,Power.Factor,Power.Offered
```

---

## 🧠 Credits

Original OCPP MQTT Perl Server by:
https://gitlab.com/lucabon

Home Assistant add-on wrapper by:
Cristiano Puppin

---

## ⭐ Tips

For advanced automations, combine this add-on with:

• Home Assistant Energy Dashboard  
• Solar integrations  like Fusion Solar for Huawei Wallbox  
• MQTT sensors  
• Charging profiles (Dynamic, Fixed, Eco, Solar)

---

Enjoy smart EV charging 🚗⚡
