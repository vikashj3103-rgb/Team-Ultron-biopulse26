# HealthConnect — Connected Hospital Care Platform

> **Evaluation repository for the HealthConnect / CareConnect project**  
> Assistive communication, smart-glove events, patient telemetry, clinical alerts, caregiver coordination, and indoor hospital wayfinding.

## Judge access

- **Source code:** https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26
- **Live web app:** Not yet published as a stable public deployment. The repository link opens the source code; it does not itself launch the application.
- **Local evaluator run:** Follow [Quick start](#quick-start) below.
- **Suggested evaluation flow:** Open the app → sign in with an approved demo role → open Clinical Operations → select a synthetic patient → trigger a request or vital event → confirm the correct Doctor and Attender views update.

> **Important deployment note:** The current cross-device synchronization and `/api/patient-events` hardware gateway are implemented in the Vite development-server plugin (`vite.config.ts`). A static Vercel build alone does not run that middleware. Before using a public deployment for judging, move the API/SSE gateway to a persistent server or another supported backend and verify the deployed endpoints end to end.

## Project overview

HealthConnect is an academic healthcare technology project exploring how assistive communication, patient-specific telemetry, alerts, caregiver requests, and hospital navigation can be coordinated in one web platform.

The project includes:
- **Doctor workstation:** assigned patient overview, vital readings, clinical alerts, patient charts, and alert acknowledgement.
- **Attender portal:** patient status, bedside requests, caregiver support actions, care-team context, and approved health information.
- **Clinical Operations:** controlled telemetry scenarios and event injection for evaluation.
- **Smart-glove integration:** ESP32 Dev Module firmware for three flex-sensor event types—Emergency, Water, and Food.
- **Telemetry and alerts:** patient-scoped reading history, threshold-driven alert flow, acknowledgement, response, and resolution states.
- **Hospital wayfinding:** interactive multi-floor 3D map with a 2D blueprint option and turn-by-turn route guidance.
- **Localization:** English, Hindi, Tamil, and Telugu interface dictionaries.
- **Bedside camera UI:** supports a laptop/USB webcam flow where browser permissions and device availability allow.

Use **synthetic data only**. This project is a demonstration/research prototype, not a certified medical device or a production clinical record system. Simulated readings must not be used for clinical decisions.

## Quick start

### Requirements
- Node.js version compatible with the Vite version in `package.json` (use a current supported Node.js LTS release).
- npm.
- For optional hardware testing: Arduino IDE / ESP32 board package and a configured ESP32 Dev Module.

### Install and run

```bash
git clone https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26.git
cd Team-Ultron-biopulse26
npm install
npm run dev -- --host 0.0.0.0 --port 3001
```

Open http://localhost:3001.

The Vite server also hosts the current local synchronization relay on port 3001. Keep the server process running while testing multiple browsers/devices.

### Build and checks

```bash
npm run build
npm run lint
npm test
```

A successful build verifies compilation and bundling; it does not by itself prove that deployed multi-device synchronization or physical hardware integration works.

## Evaluator walkthrough

1. Start the application using the commands above.
2. Sign in using the demo/role access provided by the project team. Do not assume public credentials are enabled.
3. Open **Clinical Operations** from the administrator interface.
4. Select one synthetic patient and trigger a **Food** or **Water** request.
5. Open that patient’s Attender view and confirm the request type and patient attribution.
6. Trigger a clinical scenario such as a BP elevation or SpO₂ drop.
7. Open the authorized Doctor view and inspect the patient’s alert and telemetry graph.
8. Acknowledge the alert, follow the response workflow, and resolve it explicitly.
9. Repeat with a different synthetic patient to verify that patient A’s event does not update patient B.
10. Optionally test the hospital map and language selector.

For a fair evaluation, verify the same workflow in separate browser sessions. Confirm that events carry a patient ID, that Food remains Food and Water remains Water, and that alerts do not silently resolve.

## System architecture

```text
ESP32 Smart Glove ──HTTP event──┐
                               ▼
Admin Clinical Operations → Event / Telemetry Processing
                               ▼
                     Patient-scoped data layer
                               ▼
                     Realtime synchronization
                      ┌────────┴────────┐
                      ▼                 ▼
                Doctor Workstation  Attender Portal
                      │                 │
                      └──── alerts / requests ────┘
```

The glove and software simulation are intended to use the same event-processing contract. Every event should retain a stable patient identifier and explicit event type throughout processing.

## Smart-glove firmware

Firmware and wiring notes are in [firmware/README.md](firmware/README.md). The current three-sensor firmware maps:
- GPIO 34 → Emergency
- GPIO 35 → Water
- GPIO 32 → Food

Other request types may be available through software simulation but are **not** mapped to these three physical sensors. Review [firmware/smart-glove](firmware/smart-glove) and create a local secrets file from the provided example. Never commit Wi-Fi credentials or tokens.

## Configuration and deployment

- Keep secrets in local ignored files or deployment environment variables. Never commit `.env`, `secrets.h`, Supabase service-role keys, access tokens, or real patient data.
- Vercel’s current configuration builds the Vite frontend and rewrites routes to `index.html`; it does not automatically host the custom middleware defined in `vite.config.ts`.
- For a public judge URL with multi-device synchronization, deploy a supported persistent API/SSE service or use a suitable managed realtime backend, configure the frontend to call it, and test from a separate network.
- A Cloudflare Quick Tunnel is temporary and normally changes URL when restarted. It exposes the local machine while running; it is not the same as a stable hosted deployment.
- Do not expose an unauthenticated administrator console or hardware-ingestion endpoint to the public internet.

## Screenshots and evidence

Place approved screenshots in `docs/screenshots/` and link them here. Use synthetic patient records only. Do not commit identifiable patient information, secrets, or screenshots showing private credentials.

## Troubleshooting

**Port 3001 is already in use**

Check the existing server before starting another copy:

Windows:
```cmd
netstat -ano | findstr :3001
```

If the existing application is working, open http://localhost:3001 rather than launching a duplicate server.

**A second device cannot synchronize**

Confirm both devices use the same reachable server URL, that the server is running, and that `/api/sync/stream` and `/api/sync/state` are available on that same origin. Static frontend hosting alone will not provide the development-server middleware.

**The glove sends no request**

Check ESP32 Wi-Fi connectivity, configured endpoint URL, device-to-patient mapping, Serial Monitor output, and the HTTP response. See [glove integration instructions](docs/GLOVE-INTEGRATION.md).

**Language or page route looks blank**

Refresh the app, confirm the build is current, and check browser-console errors. Client-side route rewriting is included in `vercel.json`; API routes still require a backend.

## Project documents

- [Demo workflow](docs/DEMO-WORKFLOW.md)
- [Glove integration](docs/GLOVE-INTEGRATION.md)
- [Firmware setup](firmware/README.md)

## Limitations and honest evaluation notes

- The configured live public URL is not included yet.
- The local Vite relay is development-server middleware and must be replaced or separately hosted for a production-style deployment.
- The physical ESP32/glove should be verified on actual hardware before claiming the end-to-end hardware path is proven.
- The interface and telemetry scenarios are for academic demonstration only and are not a substitute for validated medical devices or clinical judgment.

## Team

**Project:** HealthConnect / CareConnect  
**Owner:** Vikash J and team  
**Repository:** https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26
