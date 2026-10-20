# ESP32 Smart Glove — DHT22 and Email Alert Variant

This is a second ESP32 firmware variant added from the uploaded sketch. It retains the supplied glove gesture alerts, DHT22 temperature/humidity reading, LCD display, buzzer, and Gmail SMTP alert flow.

## Hardware and pin map

| Component | ESP32 GPIO / setting | Function |
| --- | ---: | --- |
| Flex sensor 1 | GPIO 34 | HELP / emergency |
| Flex sensor 2 | GPIO 35 | Need water |
| Flex sensor 3 | GPIO 32 | Need food |
| Buzzer | GPIO 14 | Local alert sound |
| Status LED | GPIO 2 | Wi-Fi status |
| DHT22 data | GPIO 27 | Temperature and humidity |
| I2C LCD SDA | GPIO 21 | Display data |
| I2C LCD SCL | GPIO 22 | Display clock |
| LCD I2C address | 0x27 | 16×2 LCD |

Verify the pin map against the assembled hardware and use appropriate voltage-divider wiring for flex sensors. Do not exceed ESP32 input voltage limits.

## Arduino setup

Select **ESP32 Dev Module** in Arduino IDE. Install these libraries:
- ESP Mail Client
- LiquidCrystal_I2C
- DHT sensor library by Adafruit
- Adafruit Unified Sensor

The Wi-Fi library, Wire, and ESP32 analogRead support come from the ESP32 Arduino core.

## Configure credentials privately

1. Copy `secrets.example.h` to `secrets.h` in this directory.
2. Fill in the Wi-Fi SSID/password, sender Gmail address, Google App Password, and recipient address.
3. Keep `secrets.h` local. The repository .gitignore excludes it.
4. Use a newly generated Google App Password. Never put real credentials directly in the public `.ino` file.

Because credentials were present in the uploaded sketch, revoke the exposed Google App Password and replace the Wi-Fi password too if it is an active credential.

## Behavior and limits

- The flex-sensor gesture events are **HELP EMERGENCY**, **NEED WATER**, and **NEED FOOD**.
- DHT22 readings are physical temperature and humidity values when the sensor is connected and working.
- Heart-rate (HR) and SpO2 values are generated randomly for demonstration purposes; this sketch has no MAX30102 sensor input. They are **not real measurements** and must never be presented as clinically accurate.
- Example alert thresholds are demonstration settings only, not diagnosis or medical advice.
- Email alerts depend on Wi-Fi, valid Gmail SMTP configuration, and network access on port 465.
- The emergency buzzer remains latched until the ESP32 restarts.

## Upload and test

1. Copy `secrets.example.h` to `secrets.h` and enter credentials.
2. Select the correct COM port and board.
3. Upload `smart_glove_dht22_demo.ino`.
4. Open Serial Monitor at 115200 baud.
5. Keep fingers straight during startup calibration.
6. Confirm the three flex sensor baselines, DHT22 readings, and Wi-Fi connection.
7. Test one sensor bend at a time and verify the expected LCD/Serial output and email delivery.

This is a demonstration sketch, not a validated medical device. It has been added to GitHub but has not been compiled against the user's exact Arduino environment or physically tested here.
