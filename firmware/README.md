# Smart Glove Firmware (ESP32 Dev Module)

This folder contains an app-notification version of the supplied three-flex-sensor glove sketch. Gmail SMTP is omitted for now; gesture events are sent to HealthConnect's HTTP ingestion endpoint.

## Hardware mapping from the supplied sketch

| Input/output | ESP32 GPIO | Function |
| --- | ---: | --- |
| Flex sensor 1 | 34 | HELP / EMERGENCY |
| Flex sensor 2 | 35 | WATER |
| Flex sensor 3 | 32 | FOOD |
| Buzzer | 14 | Local audible alert |
| LED | 2 | Wi-Fi status |
| I2C LCD SDA | 21 | LCD data |
| I2C LCD SCL | 22 | LCD clock |
| I2C LCD | 0x27 | 16×2 display |

These pin assignments come from the supplied sketch. Confirm them against the physical wiring before powering the glove. Flex sensors need suitable voltage-divider wiring; never exceed ESP32 input-voltage limits.

## Libraries

- ESP32 Arduino board package; select ESP32 Dev Module.
- LiquidCrystal_I2C.
- WiFi, HTTPClient, WiFiClientSecure and Wire from the ESP32 board package.

## Configure Wi-Fi credentials

1. Copy secrets.example.h to secrets.h in this folder.
2. Edit secrets.h with the 2.4 GHz Wi-Fi SSID and password.
3. secrets.h is excluded by .gitignore; do not force-add it.
4. Select the correct COM port and upload the sketch.

## HealthConnect endpoint

The firmware sends:

```http
POST /api/patient-events
Content-Type: application/json

{"deviceId":"GLOVE-ESP32-DEV01","gesture":"WATER"}
```

The payload follows the event shape documented for the current ingestion handler. The app's server-side device mapping must contain the same deviceId.

### Same local Wi-Fi (recommended for the first test)

1. Start HealthConnect on the laptop at port 3001, with the /api/patient-events route enabled.
2. Find the laptop's Wi-Fi IPv4 address by running ipconfig.
3. Edit LOCAL_SERVER_IP in the sketch (default placeholder: 192.168.1.100).
4. Leave USE_CLOUDFLARE_TUNNEL set to 0.
5. Allow the application port through Windows Firewall if required.
6. Keep the laptop awake and the app server running while testing.

Do not enter localhost in the ESP32 sketch: on the ESP32, localhost refers to the ESP32 itself.

### Remote network through a Cloudflare Quick Tunnel

1. Start HealthConnect and start the Cloudflare tunnel.
2. Copy the current HTTPS tunnel URL into CLOUDFLARE_BASE_URL.
3. Set USE_CLOUDFLARE_TUNNEL to 1.
4. The ESP32 must have internet access and POST to the public endpoint. Restarting a Quick Tunnel can change the hostname, so the firmware may need updating.
5. Tunnel mode calls WiFiClientSecure.setInsecure(), which bypasses server certificate validation. This is demo-only and not safe for production or real patient data.

Sharing a browser URL alone does not connect the hardware: the firmware must send a request to the endpoint and the server must be running and reachable.

## Test procedure

1. Open Serial Monitor at 115200 baud.
2. Keep fingers straight during startup calibration.
3. Check the printed baseline and endpoint.
4. Bend one sensor beyond its calibrated threshold and verify the gesture in Serial Monitor.
5. Verify one matching request appears in HealthConnect:
   - GPIO 34 -> EMERGENCY
   - GPIO 35 -> WATER
   - GPIO 32 -> FOOD
6. Straighten the finger below the reset threshold before testing it again.
7. Verify the Doctor and Attender views receive the request.
8. Reconnect Wi-Fi and confirm the system does not create duplicate requests.

The emergency buzzer remains latched until the ESP32 restarts, preserving the original sketch's behavior.

## Physical-glove scope

This sketch has three physical gesture inputs and sends EMERGENCY, WATER, and FOOD. The web application may support additional request types in software, but MEDICINE and NURSE are not implemented by these three sensor mappings. Add and calibrate explicit gestures before claiming them as physical-glove features.

This firmware was added from the prior shared sketch and adapted for application events, but it has not been compiled against the exact local Arduino installation or physically tested on the assembled board in this environment. Validate on the actual ESP32 and check the HTTP response before claiming end-to-end hardware verification.
