# ESP32 Smart Glove — Integration Guide

This guide documents how the glove should connect to HealthConnect. It intentionally does not invent pin assignments or firmware protocol details that have not been verified from the final `.ino` file.

## Confirmed setup so far

- Board family: **ESP32 Dev Module**
- Input sensors: flex sensors for detecting mild finger/hand movement
- The board is expected to use Wi-Fi.
- The glove is intended to send gesture requests to HealthConnect.
- Gesture/request categories in the application: `WATER`, `FOOD`, `MEDICINE`, `NURSE`, and `EMERGENCY`.

## Important networking clarification

Being connected to the same Wi-Fi is not, by itself, enough to connect an ESP32 to a browser application. The firmware must send events to a network service that is reachable from the ESP32, and the service must accept and validate those events.

When the ESP32 is on the same LAN as the laptop, it can usually reach a laptop-hosted endpoint using the laptop's LAN IP address and a listening port, subject to firewall and server configuration. A Cloudflare URL is useful only if the firmware is specifically written to make requests to that public URL and the endpoint supports the chosen protocol. A browser tunnel does not automatically create an ESP32 integration endpoint.

## Firmware details to confirm

Before declaring hardware integration complete, verify all of these directly in the final `.ino` file:

- [ ] Exact GPIO pin for each flex sensor.
- [ ] Analog read resolution/attenuation and any divider/resistor wiring assumptions.
- [ ] Baseline calibration and bend thresholds for the actual glove.
- [ ] How a gesture is classified and how ambiguous readings are rejected.
- [ ] Wi-Fi connection/reconnection behavior.
- [ ] Transport used to send events (HTTP, WebSocket, MQTT, etc.).
- [ ] Destination host, port, path/topic, and payload format.
- [ ] Device ID and patient ID mapping.
- [ ] Retry/deduplication behavior when the network is interrupted.
- [ ] Sensor filtering/debouncing.
- [ ] Any credentials are kept out of Git history.

## Recommended event contract

Choose a contract that matches the endpoint actually implemented by HealthConnect. A conceptual event should contain:

```json
{
  "deviceId": "glove-esp32-01",
  "patientId": "pat-ramesh",
  "eventId": "unique-device-event-id",
  "gesture": "FOOD",
  "timestamp": "ISO-8601 timestamp"
}
```

This is an example schema only, not a claim that the current firmware already sends this JSON. Adapt field names and transport to the implemented endpoint. Do not let an unknown gesture silently default to `WATER`; reject it and log a clear error.

## Calibration and testing

1. Upload the final sketch to the correct ESP32 Dev Module.
2. Open Serial Monitor at the baud rate set in the sketch.
3. Observe raw flex readings for the relaxed and intended bent positions.
4. Calibrate thresholds with the glove actually worn; allow for person-to-person variation.
5. Trigger one gesture at a time and confirm the serial output matches the expected label.
6. Send one event and confirm HealthConnect receives exactly one request.
7. Verify that `FOOD` appears as food, `WATER` as water, and each other gesture stays correctly mapped.
8. Repeat while the Doctor, Attender, and Admin views are open.
9. Disconnect Wi-Fi briefly and reconnect. Verify events are not duplicated.
10. Test each patient/device mapping so one glove event cannot update the wrong patient.

## Deployment choices

### Same local Wi-Fi
Use the laptop's LAN IP and an endpoint port explicitly enabled by the server. Check Windows Firewall and ensure the server listens on the LAN interface. Do not put `localhost` in the ESP32 firmware: on the ESP32, localhost refers to the ESP32 itself.

### Cloudflare Quick Tunnel
Use a public HTTPS hostname only if the firmware's networking library and backend endpoint support that connection and the app intentionally exposes an ingestion route. Some setups need a separate API route/server rather than pointing device firmware at the frontend. Review authentication and rate limiting before exposing an endpoint.

## Safety

This glove is an assistive communication demonstration, not a validated medical device. It must not be used to diagnose a patient, measure medical-grade vitals, or replace hospital emergency communication.
