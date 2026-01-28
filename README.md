<img width="128" height="128" alt="image" src="https://github.com/user-attachments/assets/2ee05e17-5e18-44da-8bfc-cb902f76ccfc" />
<b>OCPP Wallbox MQTT Server (Home Assistant Add-on)</b>


This Home Assistant add-on runs the OCPP MQTT Perl Server to integrate OCPP-compatible EV chargers (wallboxes) via MQTT.

It enables advanced load management, grid limit protection, solar surplus charging and dynamic power control.

The add-on wraps the original project:
https://gitlab.com/lucabon/ocpp-mqtt-perl-server

It supports core OCPP features for managing charging sessions and reporting meter data, and includes dynamic load management to automatically adjust the charger’s power limits based on configurable rules (e.g., time of day / day of week) to optimize grid import and comply with power constraints.

The add-on also includes an automatic update mechanism, making it easy to stay in sync with the upstream project and receive improvements and fixes without manual reinstall steps.

Ideal for users who want a simple, self-hosted OCPP + MQTT bridge inside Home Assistant for monitoring, control, and smart power limiting.

## You need to remove existing other OCPP Server/Integration. This addon already include an OCPP server.

<img width="1639" height="936" alt="image" src="https://github.com/user-attachments/assets/fe2dc1d3-f216-4233-bac4-2c09f7965493" />


---

## 🚀 Installation

1. Go to Home Assistant → Settings → Add-ons → Add-on Store  
2. Open the menu (⋮) → Repositories  
3. Add this repository:

```
https://github.com/skaccox/ocpp-wallbox-mqtt
```
4. Refresh the Add-on Store and install **OCPP Wallbox MQTT Server**

---

## 📌 Notes

• The add-on requires an MQTT broker (Mosquitto recommended)  
• Works with any OCPP-compatible wallbox  
• Supports dynamic power control, solar surplus charging and load balancing  

---

## 🧠 Credits

Original OCPP MQTT Perl Server by:
https://gitlab.com/lucabon

Home Assistant add-on wrapper by:
Cristiano Puppin

---

## 🛠 Troubleshooting

If the add-on does not appear in the Store:

- Check Supervisor logs
- Refresh Add-on Store cache

---

## ⭐ Tips

For advanced automations, combine this add-on with:

• Home Assistant Energy Dashboard  
• Solar integrations  like Fusion Solar for Huawei Wallbox
• MQTT sensors  
• Charging profiles (Dynamic, Fixed, Eco, Solar)

---

Enjoy smart EV charging 🚗⚡
