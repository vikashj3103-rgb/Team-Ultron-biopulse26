# HealthConnect — Real-Time Clinical Monitoring & Caregiver Communication

HealthConnect is a role-based clinical monitoring and assistive-care platform built to demonstrate how patient telemetry, clinical alerts, caregiver requests, clinician acknowledgement, nursing response, and emergency escalation can work together in one connected workflow.

> **Scope:** This repository is for an academic/hackathon software and hardware demonstration. Simulated vital readings are not real medical measurements and must not be used for diagnosis or treatment. The system is not a production medical device.

## Project goals

- Give clinicians a patient-focused view of current vital signs and clinical alert episodes.
- Give authorized family caregivers a simple view of patient status and bedside requests.
- Reduce alert flooding by updating a continuing patient-condition episode instead of creating a new card for every repeated reading.
- Keep patient data scoped to the selected patient and role.
- Demonstrate acknowledgement, nurse-response, and timed emergency-escalation workflows.
- Provide a pathway for integrating an ESP32-based assistive glove.

## Main features

### Clinical monitoring
- Patient-specific vital-sign views: blood pressure, heart rate/pulse, oxygen saturation (SpO2), temperature, and respiratory rate.
- Configurable software telemetry scenarios for stable, attention, and critical conditions.
- Clinical episode grouping and repeated-reading deduplication.
- Alert lifecycle with active, acknowledged, responding, and resolved states.
- Trend/history views for patient telemetry.

### Role-based workflows
- **Doctor workstation:** assigned-patient worklist, current readings, alerts, acknowledgement, patient details, and nurse assistance.
- **Family attender portal:** assigned patient status, care requests, latest vitals, caregiver guidance, and escalation options where configured.
- **Administrator / clinical operations:** scenario controls, patient management, and call-service monitoring.
- **Call service:** request queue, duty staff allocation, response status, and resolution workflow.

### Realtime and interface
- Browser-based React/TypeScript application.
- Server-Sent Events (SSE) and cross-tab synchronization for live application updates.
- Stale-state/version guards and event/mutation deduplication.
- Responsive interface and multilingual UI support (English, Hindi, Tamil, and Telugu).
- Indoor hospital wayfinding interface.

### Assistive glove integration
The glove uses an **ESP32 Dev Module** and flex sensors intended to detect predefined hand gestures for basic bedside requests. The ESP32 and web app need a reachable event endpoint or another explicitly implemented transport; simply joining the same Wi-Fi does not automatically pair the glove with the web app.

Gesture labels intended by the application include:

| Gesture/event | Intended request |
| --- | --- |
| WATER | Water request |
| FOOD | Food/meal request |
| MEDICINE | Medication assistance request |
| NURSE | Nurse assistance request |
| EMERGENCY | Emergency assistance request |

The exact flex-sensor pin assignments, calibration thresholds, gesture classification, Wi-Fi configuration, and event payload must match the final firmware. Do not assume pin numbers or a network protocol without checking the code.

## Architecture overview

```text
ESP32 glove / software telemetry source
              |
              v
   Event and telemetry ingestion
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

The application architecture described for this project uses React, TypeScript, Vite, and service modules for state, clinical monitoring, telemetry, event processing, and network synchronization. Confirm the actual package/configuration files in the working project before assuming any optional backend or database is configured.

## Run locally

From the project root, with Node.js installed:

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3001
```

Open the local URL printed by Vite, commonly `http://localhost:3001`.

Run quality checks if the corresponding scripts exist in `package.json`:

```bash
npm test
npm run lint
npm run build
```

## Cloudflare Quick Tunnel (optional)

Start the app locally first. In a separate terminal, run:

```bash
cloudflared tunnel --url http://localhost:3001 --protocol http2
```

Keep the tunnel terminal open while using the generated `https://….trycloudflare.com` address. A Quick Tunnel is temporary and may have network restrictions. A public tunnel exposes the application to anyone with the URL, so use only synthetic demonstration data and do not expose secrets or real patient information.

## Hardware integration checklist

1. Confirm the actual ESP32 board selection is **ESP32 Dev Module** in Arduino IDE.
2. Confirm each flex sensor's wiring and exact GPIO assignments in firmware.
3. Calibrate sensor baseline and bend ranges for the actual glove; do not copy thresholds from another glove without testing.
4. Configure Wi-Fi securely in local firmware and never commit real credentials.
5. Verify how firmware sends an event (HTTP, WebSocket, MQTT, or another transport) and match that transport to an implemented, reachable server endpoint.
6. Include a stable patient/device identifier and an explicit gesture type in each event.
7. Test each gesture separately and verify the correct request appears for the intended patient only.
8. Test Wi-Fi loss/reconnection and ensure reconnects do not duplicate requests.
9. Use synthetic data in demonstrations. Do not treat these readings as medical-grade measurements.

See [docs/GLOVE-INTEGRATION.md](docs/GLOVE-INTEGRATION.md) for the integration checklist and event-contract guidance.

## Repository contents

- `docs/GLOVE-INTEGRATION.md` — glove integration and verification notes.
- `docs/DEMO-WORKFLOW.md` — suggested end-to-end demonstration script.
- `firmware/` — place the verified ESP32 Arduino `.ino` firmware here when available.

## Security and privacy

- Never commit `.env`, Wi-Fi passwords, API tokens, Supabase service-role keys, private keys, or real patient records.
- Use synthetic names and readings in public demonstrations.
- Enforce role and patient-level authorization on the server/data layer, not only by hiding UI elements.
- A Cloudflare Quick Tunnel is not authentication. Do not expose an unauthenticated administrative interface containing sensitive data.

## Known scope/limitations

- Software telemetry is simulated unless a real device source is explicitly connected and verified.
- Flex sensors detect bending; gesture detection requires calibrated logic in firmware.
- The glove is not medically validated, and the platform is not intended for clinical decision-making.
- Realtime synchronization only works when the client, server, and any required event-ingestion path are running and reachable.

## Team

**Team Ultron — BioPulse 26**

## License

No license has been selected yet. Until one is added, reuse and redistribution rights are not explicitly granted.
