# ESP32 Smart Glove — HealthConnect Integration Guide

The repository contains the app-notification sketch at [firmware/smart-glove/healthconnect_smart_glove.ino](../firmware/smart-glove/healthconnect_smart_glove.ino). It is adapted from the previously shared ESP32 sketch: Gmail SMTP is omitted for now and gesture events are POSTed to the HealthConnect patient-event endpoint.

## Board and pin mapping

Select **ESP32 Dev Module** in Arduino IDE.

| Signal | ESP32 GPIO | Function |
| --- | ---: | --- |
| Flex sensor 1 | 34 | HELP / EMERGENCY |
| Flex sensor 2 | 35 | WATER |
| Flex sensor 3 | 32 | FOOD |
| Buzzer | 14 | Local audible alert |
| Wi-Fi LED | 2 | LED is on while Wi-Fi is connected |
| LCD SDA / SCL | 21 / 22 | I2C |
| LCD address | 0x27 | 16×2 LCD |

These assignments come from the shared sketch. Verify them against the actual assembly. Each flex sensor must be wired with a suitable voltage divider and safe ESP32 input voltage. Calibrate thresholds while the glove is worn.

## Gesture-event endpoint

The documented application ingestion route is:

```http
POST /api/patient-events
Content-Type: application/json

{"deviceId":"GLOVE-ESP32-DEV01","gesture":"WATER"}
```

The firmware sends the device ID and one gesture value. The application's device registry must map that device ID to the intended patient. Update DEVICE_ID in the sketch if the admin panel uses a different ID. The request labels sent by the physical sketch are:

| Flex sensor | Gesture value |
| --- | --- |
| GPIO 34 | EMERGENCY |
| GPIO 35 | WATER |
| GPIO 32 | FOOD |

The current three-sensor firmware does not send MEDICINE or NURSE. Add and calibrate explicit gestures before describing those as physical glove features.

## Wi-Fi credentials

1. Copy `firmware/smart-glove/secrets.example.h` to `firmware/smart-glove/secrets.h`.
2. Add your 2.4 GHz Wi-Fi SSID and password in that local file.
3. Do not commit `secrets.h`; it is excluded by `.gitignore`.
4. Upload the sketch and open Serial Monitor at 115200 baud.

## Option A — Same local Wi-Fi (recommended)

1. Run HealthConnect on the laptop with the ingestion route enabled on port 3001.
2. Run `ipconfig` on the laptop and identify its Wi-Fi IPv4 address.
3. Set `LOCAL_SERVER_IP` in the sketch to that address.
4. Leave `USE_CLOUDFLARE_TUNNEL` as 0.
5. Permit the app port through Windows Firewall if necessary.
6. Make sure both the laptop and ESP32 are on a network that allows device-to-device traffic.

The ESP32 must not use `localhost`; that would point to the ESP32 itself.

## Option B — ESP32 on a remote network through Cloudflare

A remote glove can reach the laptop only if its firmware sends the event over the internet to an accessible ingestion endpoint. A shared browser URL alone does not connect the hardware.

1. Start HealthConnect and the Cloudflare Quick Tunnel.
2. Copy the current HTTPS tunnel URL into `CLOUDFLARE_BASE_URL`.
3. Set `USE_CLOUDFLARE_TUNNEL` to 1.
4. Ensure the ESP32 has internet access. Quick Tunnel URLs are temporary and may change.
5. The sketch currently uses `WiFiClientSecure.setInsecure()`, which bypasses TLS certificate validation. This is a hackathon-only convenience and is not appropriate for production or real patient data. A secure deployment should validate the server certificate and authenticate device events.

## Calibration, event delivery, and recovery

1. Keep fingers straight during the startup calibration.
2. Observe baseline readings over Serial Monitor.
3. Bend one sensor, then confirm the decoded gesture and HTTP status in Serial Monitor.
4. Verify one correctly typed request appears for the mapped patient.
5. Straighten the finger until the reading passes the reset threshold before trying that gesture again.
6. Disconnect and reconnect Wi-Fi and check that delivery failures are visible.
7. Keep the application server running during the test.
8. If the endpoint rejects the request, inspect the Vite/server terminal and confirm the device ID is registered.

A bend produces at most one request until that sensor returns below its reset threshold. The emergency buzzer remains latched until board restart, matching the supplied behavior.

## Safety and verification boundary

This is an assistive communication demonstration, not a validated medical device. Firmware has been added to the repository but has not been compiled against the exact local Arduino setup or tested on the physical glove in this environment. Confirm the board, wiring, sensor calibration, endpoint response, and correct patient mapping before claiming live hardware-to-app operation.
