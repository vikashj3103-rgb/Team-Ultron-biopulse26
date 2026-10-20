# HealthConnect Demo Workflow

Use synthetic records only. This is a software/hardware demonstration, not a clinical system.

## 1. Start the application

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3001
```

Optionally expose the local app through a Cloudflare Quick Tunnel in a second terminal:

```bash
cloudflared tunnel --url http://localhost:3001 --protocol http2
```

## 2. Show the role-based workflow

1. Open the Admin/Clinical Operations screen and choose a specific synthetic patient.
2. Start the telemetry scenario and show the current vital readings.
3. Trigger one condition (for example, a simulated oxygen alert).
4. Open the Doctor dashboard and show the single patient-specific clinical episode.
5. Acknowledge the episode and verify the Attender view updates without a manual refresh.
6. Show nurse assistance and the call-service lifecycle.
7. If enabled, demonstrate the caregiver emergency-escalation timeout using a short presentation setting.
8. Reset the scenario before repeating with another patient.

## 3. Show the glove workflow (when firmware and ingestion are configured)

1. Power the ESP32 glove.
2. Confirm Wi-Fi and device connection in Serial Monitor or a verified connection indicator.
3. Trigger one calibrated gesture.
4. Verify the decoded gesture in firmware logs.
5. Confirm one correctly mapped care request reaches the intended patient in HealthConnect.
6. Repeat for FOOD, WATER, MEDICINE, NURSE, and EMERGENCY.

## 4. What to explain

- Telemetry readings are separated from clinical alert episodes.
- Repeated readings update the existing episode rather than flooding the dashboard.
- Acknowledgement and escalation are explicit state transitions.
- Care requests are distinct from clinical vital alerts.
- Patient/role isolation and reconnect handling are key architectural goals.

## 5. Demo reliability tips

- Keep the application terminal running.
- Keep the Cloudflare terminal running if a public link is being used.
- Test the public link on the intended phone/tablet before the presentation.
- Do not expose API keys, passwords, or real patient information.
- If hardware connection is not verified, present glove interaction as a separate integration step rather than claiming live hardware-to-app connectivity.
