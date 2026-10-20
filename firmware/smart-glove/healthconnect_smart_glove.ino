/*
 * HealthConnect Smart Glove — ESP32 Dev Module
 *
 * Flex sensor mapping from the supplied glove sketch:
 * GPIO 34 -> HELP / EMERGENCY; GPIO 35 -> WATER; GPIO 32 -> FOOD.
 * This version sends app events to HealthConnect's POST /api/patient-events.
 * Gmail SMTP is intentionally omitted for now.
 *
 * Copy secrets.example.h to secrets.h and enter Wi-Fi credentials locally.
 * Do not commit secrets.h. Configure LOCAL_SERVER_IP or the Cloudflare URL below.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <math.h>
#include "secrets.h"

// ---------------- APP CONNECTION ----------------
#define USE_CLOUDFLARE_TUNNEL 0
const char* LOCAL_SERVER_IP = "192.168.1.100"; // CHANGE to laptop IPv4 address
const uint16_t LOCAL_SERVER_PORT = 3001;
const char* CLOUDFLARE_BASE_URL = "https://YOUR-TUNNEL.trycloudflare.com";
const char* PATIENT_EVENTS_PATH = "/api/patient-events";
const char* DEVICE_ID = "GLOVE-ESP32-DEV01";

// ---------------- HARDWARE PINS ----------------
#define FLEX1_PIN 34
#define FLEX2_PIN 35
#define FLEX3_PIN 32
#define BUZZER_PIN 14
#define LED_PIN 2

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------- FLEX CALIBRATION ----------------
const int CHANGE_THRESHOLD = 100;
const int RESET_THRESHOLD = 50;
int baseline1 = 0, baseline2 = 0, baseline3 = 0;
bool helpActive = false, waterActive = false, foodActive = false;
bool startupReady = false;
// Emergency buzzer remains latched until the ESP32 restarts.
bool helpEmergencyLatched = false;

// ---------------- BUZZER SETTINGS ----------------
bool alertBuzzerActive = false, buzzerState = false;
unsigned long lastBuzzerToggle = 0;
const unsigned long BUZZER_ON_TIME = 200;
const unsigned long BUZZER_OFF_TIME = 300;

// ---------------- LCD HOMEPAGE ----------------
bool homeScreenActive = false;
unsigned long lastHomeScroll = 0;
int homeScrollIndex = 0;
const char homeText[] = "HealthConnect Glove Ready  ";

void showLCD(const char* line1, const char* line2) {
  homeScreenActive = false;
  lcd.setCursor(0, 0); lcd.print("                ");
  lcd.setCursor(0, 0); lcd.print(line1);
  lcd.setCursor(0, 1); lcd.print("                ");
  lcd.setCursor(0, 1); lcd.print(line2);
}

void showHomePage() {
  homeScreenActive = true;
  homeScrollIndex = 0;
  lastHomeScroll = millis();
  lcd.setCursor(0, 0); lcd.print("HealthConnect   ");
  lcd.setCursor(0, 1);
  for (int i = 0; i < 16; i++) lcd.print(homeText[i]);
}

void updateHomePage() {
  if (!homeScreenActive || millis() - lastHomeScroll < 500) return;
  lastHomeScroll = millis();
  const int textLength = sizeof(homeText) - 1;
  const int maxOffset = textLength > 16 ? textLength - 16 : 0;
  homeScrollIndex = (homeScrollIndex + 1) > maxOffset ? 0 : homeScrollIndex + 1;
  lcd.setCursor(0, 1);
  for (int i = 0; i < 16; i++) lcd.print(homeText[homeScrollIndex + i]);
}

void startAlertBuzzer() {
  alertBuzzerActive = true;
  buzzerState = true;
  lastBuzzerToggle = millis();
  digitalWrite(BUZZER_PIN, HIGH);
}

void stopAlertBuzzer() {
  if (helpEmergencyLatched) return;
  alertBuzzerActive = false;
  buzzerState = false;
  digitalWrite(BUZZER_PIN, LOW);
}

void updateBuzzer() {
  if (!alertBuzzerActive) return;
  const unsigned long now = millis();
  if (buzzerState && now - lastBuzzerToggle >= BUZZER_ON_TIME) {
    buzzerState = false;
    lastBuzzerToggle = now;
    digitalWrite(BUZZER_PIN, LOW);
  } else if (!buzzerState && now - lastBuzzerToggle >= BUZZER_OFF_TIME) {
    buzzerState = true;
    lastBuzzerToggle = now;
    digitalWrite(BUZZER_PIN, HIGH);
  }
}

void updateLED() {
  digitalWrite(LED_PIN, WiFi.status() == WL_CONNECTED ? HIGH : LOW);
}

bool connectWiFi() {
  showLCD("Connecting WiFi", "Please wait...");
  Serial.println("[WiFi] Connecting...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 20000) {
    updateLED();
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected. ESP32 IP: ");
    Serial.println(WiFi.localIP());
    updateLED();
    return true;
  }
  Serial.println("[WiFi] Connection failed.");
  digitalWrite(LED_PIN, LOW);
  return false;
}

bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("[WiFi] Reconnecting...");
  showLCD("WiFi reconnect", "Please wait...");
  WiFi.reconnect();
  const unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
    updateLED();
    delay(200);
  }
  updateLED();
  return WiFi.status() == WL_CONNECTED;
}

int readFlexSensor(int pin) {
  long total = 0;
  for (int i = 0; i < 10; i++) {
    total += analogRead(pin);
    delay(2);
  }
  return static_cast<int>(total / 10);
}

bool checkRequirements() {
  showLCD("Initializing...", "Checking sensors");
  const int value1 = readFlexSensor(FLEX1_PIN);
  const int value2 = readFlexSensor(FLEX2_PIN);
  const int value3 = readFlexSensor(FLEX3_PIN);
  Serial.println("----- STARTUP CHECK -----");
  Serial.printf("Flex 1: %d\nFlex 2: %d\nFlex 3: %d\n", value1, value2, value3);

  const bool sensorsOK =
      value1 > 2 && value1 < 4093 &&
      value2 > 2 && value2 < 4093 &&
      value3 > 2 && value3 < 4093;
  const bool wifiOK = WiFi.status() == WL_CONNECTED;
  Serial.printf("Flex sensor check: %s\n", sensorsOK ? "PASSED" : "FAILED");
  Serial.printf("Wi-Fi check: %s\n", wifiOK ? "PASSED" : "FAILED");

  if (!sensorsOK) { showLCD("Sensor Check", "Check wiring!"); return false; }
  if (!wifiOK) { showLCD("WiFi Not Ready", "Check network"); return false; }
  showLCD("Checks Passed", "Calibrating...");
  delay(1000);
  return true;
}

void calibrateSensors() {
  showLCD("Keep fingers", "straight...");
  Serial.println("[Sensor] Calibrating. Keep fingers straight.");
  delay(2000);
  baseline1 = readFlexSensor(FLEX1_PIN);
  baseline2 = readFlexSensor(FLEX2_PIN);
  baseline3 = readFlexSensor(FLEX3_PIN);
  Serial.printf("Baseline 1: %d\nBaseline 2: %d\nBaseline 3: %d\n",
                baseline1, baseline2, baseline3);
  helpActive = waterActive = foodActive = false;
}

String makeEventUrl() {
#if USE_CLOUDFLARE_TUNNEL
  return String(CLOUDFLARE_BASE_URL) + PATIENT_EVENTS_PATH;
#else
  return String("http://") + LOCAL_SERVER_IP + ":" +
         String(LOCAL_SERVER_PORT) + PATIENT_EVENTS_PATH;
#endif
}

template <typename TClient>
bool postGestureEvent(TClient& client, const String& url, const char* gesture) {
  HTTPClient http;
  http.setTimeout(6000);
  if (!http.begin(client, url)) {
    Serial.println("[App] ERROR: Could not initialize HTTP request.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Accept", "application/json");
  const String payload = String("{\"deviceId\":\"") + DEVICE_ID +
                         "\",\"gesture\":\"" + gesture + "\"}";

  Serial.print("[App] POST "); Serial.println(url);
  Serial.print("[App] Payload: "); Serial.println(payload);
  const int statusCode = http.POST(payload);
  const String responseBody = statusCode > 0 ? http.getString() : "";
  http.end();

  Serial.printf("[App] HTTP status: %d\n", statusCode);
  if (responseBody.length()) { Serial.print("[App] Response: "); Serial.println(responseBody); }
  return statusCode >= 200 && statusCode < 300;
}

bool sendAppEvent(const char* gesture, const char* lcdLabel) {
  Serial.println();
  Serial.println("==============================");
  Serial.print("[Gesture] Detected: "); Serial.println(gesture);
  showLCD("Sending request", lcdLabel);
  startAlertBuzzer();

  if (!ensureWiFi()) {
    Serial.println("[App] FAILED: Wi-Fi unavailable.");
    showLCD("Request failed", "WiFi unavailable");
    delay(1200);
    showHomePage();
    return false;
  }

  const String url = makeEventUrl();
  bool success = false;
#if USE_CLOUDFLARE_TUNNEL
  // DEMO ONLY: this bypasses certificate validation; not production-safe.
  WiFiClientSecure client;
  client.setInsecure();
  success = postGestureEvent(client, url, gesture);
#else
  WiFiClient client;
  success = postGestureEvent(client, url, gesture);
#endif

  if (success) {
    Serial.println("[App] Request accepted by HealthConnect.");
    showLCD("App notified!", lcdLabel);
    if (!helpEmergencyLatched) stopAlertBuzzer();
  } else {
    Serial.println("[App] FAILED: Request was not accepted. Check endpoint/server.");
    showLCD("App request failed", "Check connection");
    // Keep buzzer active if delivery fails so the event is not silently lost.
  }

  delay(1200);
  showHomePage();
  Serial.println("==============================");
  return success;
}

void setup() {
  Serial.begin(115200);
  pinMode(FLEX1_PIN, INPUT);
  pinMode(FLEX2_PIN, INPUT);
  pinMode(FLEX3_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  analogReadResolution(12);
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  showLCD("HealthConnect", "Initializing...");
  delay(1000);

  if (!connectWiFi()) {
    showLCD("WiFi Failed", "Check secrets.h");
    Serial.println("[Startup] Failed: Wi-Fi unavailable.");
    return;
  }
  if (!checkRequirements()) {
    Serial.println("[Startup] Sensor/network check failed.");
    return;
  }

  calibrateSensors();
  startupReady = true;
  showHomePage();
  Serial.println();
  Serial.println("HealthConnect Smart Glove Ready.");
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.println("GPIO 34 = HELP / EMERGENCY");
  Serial.println("GPIO 35 = WATER");
  Serial.println("GPIO 32 = FOOD");
  Serial.print("Endpoint: "); Serial.println(makeEventUrl());
}

void loop() {
  updateBuzzer();
  updateLED();
  if (!startupReady) { delay(50); return; }
  updateHomePage();

  const int flex1 = readFlexSensor(FLEX1_PIN);
  const int flex2 = readFlexSensor(FLEX2_PIN);
  const int flex3 = readFlexSensor(FLEX3_PIN);
  const int diff1 = abs(flex1 - baseline1);
  const int diff2 = abs(flex2 - baseline2);
  const int diff3 = abs(flex3 - baseline3);

  Serial.printf("F1: %d  F2: %d  F3: %d\n", flex1, flex2, flex3);

  // Flex 1 = HELP / EMERGENCY. One emergency is latched per board boot.
  if (diff1 > CHANGE_THRESHOLD && !helpActive && !helpEmergencyLatched) {
    helpActive = true;
    helpEmergencyLatched = true;
    startAlertBuzzer();
    sendAppEvent("EMERGENCY", "HELP EMERGENCY");
  }
  if (diff1 < RESET_THRESHOLD) helpActive = false;

  // Flex 2 = WATER. One request per bend until the sensor returns to baseline.
  if (diff2 > CHANGE_THRESHOLD && !waterActive) {
    waterActive = true;
    sendAppEvent("WATER", "NEED WATER");
  }
  if (diff2 < RESET_THRESHOLD) waterActive = false;

  // Flex 3 = FOOD. One request per bend until the sensor returns to baseline.
  if (diff3 > CHANGE_THRESHOLD && !foodActive) {
    foodActive = true;
    sendAppEvent("FOOD", "NEED FOOD");
  }
  if (diff3 < RESET_THRESHOLD) foodActive = false;

  updateBuzzer();
  updateLED();
  updateHomePage();
  delay(50);
}
