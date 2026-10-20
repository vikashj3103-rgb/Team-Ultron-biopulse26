# HealthConnect — Connected Hospital Care Platform

> **Judge evaluation repository** for HealthConnect / CareConnect: assistive communication, smart-glove events, patient telemetry, clinical alerts, caregiver coordination, and hospital indoor wayfinding.

## Evaluation links

- **GitHub repository:** https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26
- **Live web app:** **Not published from this repository yet.** No stable public application URL is currently configured here.
- **Current evaluation status:** The repository contains firmware, documentation, and Vite configuration, but the application source directory (`src/`) is missing from the current `main` branch. The current `index.html` imports `/src/main.tsx`, so a clone of this branch cannot build/run the actual web app yet.

### Required before judges can use the web app

1. Commit the complete working HealthConnect frontend source to this repository, including `src/`, all referenced assets, styles, services, components, pages, and any required configuration files. Do not commit `node_modules`, `dist`, real patient data, secrets, or credentials.
2. Run `npm ci` (or `npm install` if the lockfile needs to be updated), `npm run build`, `npm run lint`, and `npm test` in that full source checkout.
3. Deploy the frontend to a stable public host and add the verified URL above. A GitHub repository link alone does not launch a running application.
4. Deploy the synchronization/API endpoints separately or to a persistent backend. The current SSE relay and `POST /api/patient-events` gateway are implemented inside the Vite development-server plugin; a static Vercel deployment will not run those middleware handlers.
5. Test the deployed link from a separate network and verify the Doctor, Attender, Admin, and glove event flows before submitting it for evaluation.

> Do not send judges a localhost URL. A Cloudflare Quick Tunnel is temporary and only works while the laptop server and tunnel remain running. It is not a stable deployment.

## Project overview

HealthConnect is an academic healthcare technology project exploring how assistive communication, patient-specific telemetry, alerts, caregiver requests, and hospital navigation can be coordinated through a connected web platform.

### Planned and documented capabilities

- **Doctor workstation:** assigned-patient overview, vital readings, clinical alerts, patient charts, and alert acknowledgement.
- **Attender portal:** patient status, bedside requests, caregiver support actions, care-team context, and approved health information.
- **Clinical Operations:** controlled telemetry scenarios and event injection for software evaluation.
- **Smart-glove integration:** ESP32 Dev Module firmware for three flex-sensor event types—Emergency, Water, and Food.
- **Telemetry and alerts:** patient-scoped reading history, threshold-driven alert flow, acknowledgement, response, and resolution states.
- **Hospital wayfinding:** interactive multi-floor 3D map with a 2D blueprint option and route guidance.
- **Localization:** English, Hindi, Tamil, and Telugu interface dictionaries.
- **Bedside camera UI:** intended to support a laptop/USB webcam where browser permissions and hardware permit.

These are the project capabilities described in the documentation; they should not be treated as independently verified from the current incomplete source checkout.

## Technology

- React and TypeScript
- Vite and Tailwind CSS
- Supabase client dependency (configuration and backend readiness must be verified for the complete app)
- Server-Sent Events (SSE) middleware currently configured in `vite.config.ts` for local cross-device synchronization
- ESP32 Dev Module firmware using Wi-Fi and flex sensors
- SVG and CSS 3D techniques for hospital wayfinding

## Smart-glove firmware

Firmware and wiring notes are in [firmware/README.md](firmware/README.md), with integration details in [docs/GLOVE-INTEGRATION.md](docs/GLOVE-INTEGRATION.md). The current three-sensor sketch maps:
- GPIO 34 → Emergency
- GPIO 35 → Water
- GPIO 32 → Food

Medicine and Nurse may be available through software scenarios, but they are not mapped to these three physical sensors. Create a local secrets header from `secrets.example.h`; never commit Wi-Fi credentials or tokens. Hardware-to-app delivery still needs validation on the assembled board and the actual running backend.

## System workflow for evaluation after deployment

1. Open the hosted application and sign in with the evaluation access provided by the team.
2. Open Clinical Operations and select a synthetic patient.
3. Trigger a Food or Water request and confirm the exact request type appears in that patient’s Attender view.
4. Trigger a vital scenario such as BP elevation or an SpO₂ drop.
5. Open the authorized Doctor view and inspect the matching patient’s alert and telemetry graph.
6. Acknowledge the alert, follow the response workflow, and resolve it explicitly.
7. Repeat with a second synthetic patient to verify the first patient’s events do not alter the second patient.
8. Optionally demonstrate the hospital map and language selector.

## Local development (after the full source is committed)

The commands below are the intended Vite workflow but **will not work from the current checkout until `src/` and all application files are added**.

```bash
git clone https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26.git
cd Team-Ultron-biopulse26
npm ci
npm run dev -- --host 0.0.0.0 --port 3001
```

Open http://localhost:3001 after the complete application source is present.

### Intended quality checks

```bash
npm run build
npm run lint
npm test
```

A successful build proves compilation and bundling, not end-to-end deployment, realtime synchronization, or physical hardware operation.

## Deployment and security notes

- `vercel.json` is configured for a Vite frontend build and client-side route fallback. It does not host the custom server middleware inside `vite.config.ts`.
- `/api/sync/stream`, `/api/sync/state`, `/api/sync`, and `/api/patient-events` need a running compatible server/backend. Do not assume those endpoints exist in static hosting.
- Keep `.env`, `secrets.h`, Wi-Fi passwords, API tokens, Supabase service-role keys, and real patient data out of Git.
- Do not expose an unauthenticated administrator console or hardware-ingestion endpoint to the public internet.
- Use synthetic patient records only. This is an academic demonstration/research project, not a certified medical device or production clinical record system. Simulated readings must not be used for clinical decisions.

## Troubleshooting

**Port 3001 already in use (Windows)**

```cmd
netstat -ano | findstr :3001
```

If the existing application is already running, open http://localhost:3001 rather than launching a duplicate server.

**A second device cannot synchronize**

Confirm the devices use the same reachable server URL and that `/api/sync/stream` and `/api/sync/state` are served by the backend. Static frontend hosting alone is insufficient.

**The glove sends no request**

Check ESP32 Wi-Fi, configured endpoint URL, device-to-patient mapping, Serial Monitor output, and the HTTP response. See [glove integration instructions](docs/GLOVE-INTEGRATION.md).

## Project documents

- [Demo workflow](docs/DEMO-WORKFLOW.md)
- [Glove integration](docs/GLOVE-INTEGRATION.md)
- [Firmware setup](firmware/README.md)

## Team

**Project:** HealthConnect / CareConnect  
**Team:** Team Ultron — BioPulse 26  
**Repository:** https://github.com/vikashj3103-rgb/Team-Ultron-biopulse26
