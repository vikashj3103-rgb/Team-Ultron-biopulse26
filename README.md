# HealthConnect — Real-Time Clinical Monitoring & Caregiver Communication

HealthConnect is a role-based clinical monitoring and assistive-care platform designed to demonstrate a connected workflow across patient telemetry, clinical alerts, family-caregiver requests, clinician acknowledgement, nursing response, and emergency escalation.

> **Scope and safety:** This is an academic/hackathon demonstration. Software-generated vital readings are simulated and are not medical measurements. This project is not a validated medical device and must not be used to diagnose or treat patients.

## Project goals

- Present patient vital signs and clinical episodes in a clinician-focused workspace.
- Give authorized family caregivers a simple view of patient status and bedside requests.
- Reduce alert flooding by updating one ongoing patient-condition episode rather than creating a new alert for each repeated reading.
- Keep patient data scoped to the relevant patient and role.
- Demonstrate alert acknowledgement, nurse response, and configured emergency escalation.
- Connect an ESP32 flex-sensor glove to the application’s patient-event ingestion endpoint.

## Main application features

### Clinical monitoring
- Patient-specific views for blood pressure, heart rate/pulse, oxygen saturation (SpO2), temperature, and respiratory rate.
- Software telemetry scenarios for stable, attention, and critical conditions.
- Clinical episode grouping and repeated-reading deduplication.
- Alert lifecycle with active, acknowledged, responding, and resolved states.
- Patient telemetry history and trends.

### Role-based workflows
- **Doctor workstation:** assigned-patient worklist, current readings, alerts, acknowledgement, patient details, and nurse assistance.
- **Family attender portal:** assigned patient status, bedside requests, latest vitals, caregiver guidance, and escalation options where configured.
- **Administrator / clinical operations:** patient management, scenario controls, and call-service monitoring.
- **Call service:** request queue, staff allocation, response status, and resolution workflow.

### Realtime and interface
- React/TypeScript/Vite application architecture.
- Server-Sent Events (SSE) and cross-tab synchronization for live updates.
- Version guards and event/mutation deduplication to protect newer state.
- Responsive interface and multilingual UI support (English, Hindi, Tamil, and Telugu).
- Indoor hospital wayfinding interface.

## ESP32 smart glove

The repository now includes an app-notification firmware sketch for an **ESP32 Dev Module** using three flex sensors, an I2C LCD, a buzzer, and a Wi-Fi status LED.

| Sensor / control | ESP32 GPIO | Gesture sent to HealthConnect |
| --- | ---: | --- |
| Flex sensor 1 | 34 | EMERGENCY (display label: HELP EMERGENCY) |
| Flex sensor 2 | 35 | WATER |
| Flex sensor 3 | 32 | FOOD |
| Buzzer | 14 | Local audible alert |
| Wi-Fi LED | 2 | Indicates Wi-Fi connection |
| LCD SDA / SCL | 21 / 22 | I2C display |

The firmware posts gesture events to the documented `POST /api/patient-events` route using a device ID and gesture, for example:

```json
{"deviceId":"GLOVE-ESP32-DEV01","gesture":"WATER"}
```

The server must have that device ID mapped to the intended patient. This sketch currently implements **three physical gestures** (EMERGENCY, WATER, FOOD). The web app may offer MEDICINE or NURSE through software simulation, but those are not implemented in this three-sensor firmware.

See [firmware/README.md](firmware/README.md) and [docs/GLOVE-INTEGRATION.md](docs/GLOVE-INTEGRATION.md) for wiring, configuration, local Wi-Fi setup, optional tunnel mode, calibration, and testing. The firmware has been added to this repository but still needs compilation and physical validation on the assembled glove.

## Architecture overview

```text
ESP32 glove / software telemetry source
              |
              v
      Patient-event ingestion
              |
              v
       Patient-scoped DataStore
              |
       +------+------+
       |             |
       v             v
 Clinical episode   Care request
 / alert lifecycle  lifecycle
       |             |
       +------+------+
              |
        Realtime sync (SSE)
              |
    +---------+----------+
    |         |          |
  Doctor   Attender     Admin
```

## Technology

The documented application architecture uses React, TypeScript, Vite, patient-scoped services, telemetry and event processing, and SSE-based synchronization. Confirm the actual app source and package scripts in the delivery checkout. This repository currently contains the project documentation and glove firmware integration files; the complete HealthConnect web-app source directory still needs to be committed from the working development folder for a fully reproducible checkout.

## Run the web app locally

From the complete HealthConnect web-app source directory, with Node.js installed:

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3001
```

Open the local URL printed by Vite, commonly `http://localhost:3001`.

If the matching scripts exist in that source checkout, run:

```bash
npm test
npm run lint
npm run build
```

## Cloudflare Quick Tunnel (optional)

After the local app is running, a separate terminal can expose it for a temporary multi-device demonstration:

```bash
cloudflared tunnel --url http://localhost:3001 --protocol http2
```

Keep the tunnel process running. A Quick Tunnel hostname may change between sessions. Anyone who has the URL may be able to access exposed routes; use synthetic records only and do not expose secrets or real patient information.

## Repository contents

- `firmware/smart-glove/healthconnect_smart_glove.ino` — ESP32 firmware adapted to send in-app request events instead of Gmail.
- `firmware/smart-glove-dht22-demo/smart_glove_dht22_demo.ino` — uploaded ESP32 variant with three flex gestures, DHT22 temperature/humidity, LCD, buzzer, and email alerts. HR/SpO2 are randomized demo values, not sensor measurements.
- `firmware/smart-glove-dht22-demo/README.md` and `secrets.example.h` — setup notes and a local credentials template for the DHT22/email variant.
- `firmware/smart-glove/secrets.example.h` and `firmware/README.md` — app-event glove setup and testing instructions.
- `docs/GLOVE-INTEGRATION.md` — integration and networking guide.
- `docs/DEMO-WORKFLOW.md` — suggested demonstration flow.
- `.gitignore` — excludes local credentials, build outputs, and test artifacts.

## Security and privacy

- Never commit Wi-Fi passwords, API tokens, Supabase service-role keys, private keys, local `secrets.h`, or real patient records.
- Use synthetic names and readings in public demonstrations.
- Enforce role and patient-level authorization at the server/data layer, not only by hiding UI elements.
- A Cloudflare Quick Tunnel is transport, not authentication.
- The optional tunnel mode in the current firmware bypasses TLS certificate validation for demonstration convenience; do not use that configuration with sensitive data.

## Known scope and limitations

- Vital telemetry remains simulated unless a real medical telemetry device is specifically integrated and verified.
- Flex sensors detect bending; calibration is person- and glove-dependent.
- This firmware sends three gesture types only: EMERGENCY, WATER, and FOOD.
- Gmail alerts were intentionally deferred; this firmware focuses on in-app requests.
- Hardware-to-app delivery has not been physically tested in this environment. Compile and validate with the actual ESP32, sensors, local endpoint, and Wi-Fi before claiming a successful live integration.
- No open-source license has been selected; unless a license is added, reuse and redistribution permissions are not explicitly granted.

## Team

**Team Ultron — BioPulse 26**
