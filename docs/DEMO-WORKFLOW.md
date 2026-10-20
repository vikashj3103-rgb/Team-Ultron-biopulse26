# HealthConnect Demo Workflow

Use synthetic records only. This is an academic/hackathon demonstration, not a clinical system.

## 1. Start the web app

From the complete HealthConnect source checkout:

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3001
```

Optionally start a Cloudflare Quick Tunnel in another terminal:

```bash
cloudflared tunnel --url http://localhost:3001 --protocol http2
```

## 2. Demonstrate the software workflow

1. Open the Admin/Clinical Operations screen and choose a synthetic patient.
2. Start a telemetry scenario and show the current vital readings.
3. Trigger a simulated critical condition.
4. Open the Doctor dashboard and show the patient-specific clinical episode.
5. Acknowledge the episode and verify the Attender view synchronizes without refreshing.
6. Show nurse assistance and the call-service lifecycle.
7. If enabled, demonstrate the caregiver escalation timeout.
8. Reset the scenario before repeating with a different patient.

## 3. Demonstrate the ESP32 glove

1. Select ESP32 Dev Module and upload the firmware in firmware/smart-glove.
2. Create a local secrets.h from secrets.example.h with the actual Wi-Fi credentials.
3. Configure the laptop LAN IP for same-Wi-Fi testing, or configure the current tunnel URL for a remote-network test.
4. Confirm the device ID is registered and mapped to the intended patient in the application.
5. Keep Serial Monitor open at 115200 baud.
6. Bend one calibrated sensor at a time:
   - GPIO 34 → EMERGENCY
   - GPIO 35 → WATER
   - GPIO 32 → FOOD
7. Confirm the server accepts the event and that the correct single care request appears for the intended patient.
8. Test each gesture again after returning the sensor to baseline.

MEDICINE and NURSE may be available through the software simulation but are not mapped to the three physical sensors in this firmware.

## 4. Explain the architecture

- Telemetry readings are separate from clinical alert episodes.
- Repeated readings update an episode instead of flooding the dashboard.
- Care requests and clinical vital alerts are different event types.
- Doctor acknowledgement and caregiver escalation are explicit state transitions.
- Patient/role isolation and reconnect handling protect cross-device state.

## 5. Reliability and security

- Keep the application server and tunnel terminal open throughout the demo.
- Test the public URL and actual glove-to-endpoint delivery before presenting.
- Do not publish Wi-Fi passwords, API keys, or real patient data.
- A Cloudflare URL is not authentication. Use synthetic data and do not expose an unauthenticated administrative interface.
- Do not claim hardware integration has been verified until it has been tested on the physical ESP32 and the request is confirmed in the app.
