#include <WiFi.h>
#include <ESP_Mail_Client.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

// Install these Arduino libraries:
// 1) ESP Mail Client
// 2) LiquidCrystal_I2C
// 3) DHT sensor library by Adafruit (+ Adafruit Unified Sensor)
// HR and SpO2 use RANDOMIZED DEMO values (not real measurements); no MAX30102 library is required.

// ---------------- WIFI SETTINGS ----------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---------------- GMAIL SETTINGS ----------------
#define SMTP_HOST "smtp.gmail.com"
#define SMTP_PORT 465
const char* SENDER_EMAIL = "YOUR_SENDER_EMAIL@gmail.com";
const char* APP_PASSWORD = "YOUR_NEW_GOOGLE_APP_PASSWORD";       // Use a NEW Google App Password; do not share it.
const char* RECIPIENT_EMAIL = "YOUR_RECIPIENT_EMAIL@gmail.com";

// ---------------- HARDWARE PINS ----------------
#define FLEX1_PIN 34
#define FLEX2_PIN 35
#define FLEX3_PIN 32
#define BUZZER_PIN 14
#define LED_PIN 2
#define DHT_PIN 27
#define DHT_TYPE DHT22

// ---------------- LCD / SENSORS ----------------
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHT_PIN, DHT_TYPE);
SMTPSession smtp;

// ---------------- FLEX SETTINGS ----------------
const int CHANGE_THRESHOLD = 100;
const int RESET_THRESHOLD = 50;
int baseline1 = 0, baseline2 = 0, baseline3 = 0;
bool helpActive = false, waterActive = false, yesActive = false;
bool startupReady = false;
bool helpEmergencyLatched = false;

// ---------------- BUZZER SETTINGS ----------------
bool alertBuzzerActive = false;
bool buzzerState = false;
unsigned long lastBuzzerToggle = 0;
const unsigned long BUZZER_ON_TIME = 200;
const unsigned long BUZZER_OFF_TIME = 300;

// ---------------- LCD PAGE SETTINGS ----------------
enum LcdPage { NORMAL_PAGE, VITALS_PAGE };
LcdPage currentPage = NORMAL_PAGE;
unsigned long pageStartedAt = 0;
unsigned long lastHomeScroll = 0;
int homeScrollIndex = 0;
const char homeText[] = "Smart Glove Ready To Use  ";
const unsigned long PAGE_DURATION_MS = 5000;

// ---------------- VITALS SETTINGS ----------------
// Adjust these example alert limits for the intended user and use case.
// These readings are not a medical diagnosis.
const float HIGH_TEMP_C = 38.0;
const float HIGH_HUMIDITY = 80.0;
const int HIGH_HEART_RATE_BPM = 120;
const int LOW_HEART_RATE_BPM = 45;
const int LOW_SPO2_PERCENT = 92;
const unsigned long VITAL_ALERT_COOLDOWN_MS = 60000;

float temperatureC = NAN, humidityPct = NAN;
int heartRateBpm = 75, spo2Pct = 98;
bool heartRateValid = true, spo2Valid = true;
bool dhtReadingValid = false;
unsigned long lastDhtRead = 0;
unsigned long lastVitalAlert = 0;
unsigned long lastDemoVitalsUpdate = 0;

// ---------------- LCD HELPERS ----------------
void clearLine(uint8_t row) {
  lcd.setCursor(0, row);
  lcd.print("                ");
}

void showLCD(const char* line1, const char* line2) {
  clearLine(0);
  lcd.setCursor(0, 0);
  lcd.print(line1);
  clearLine(1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void showNormalPage() {
  currentPage = NORMAL_PAGE;
  pageStartedAt = millis();
  homeScrollIndex = 0;
  lastHomeScroll = millis();
  clearLine(0);
  lcd.setCursor(0, 0);
  lcd.print("Welcome SIR/MAM ");
  clearLine(1);
  lcd.setCursor(0, 1);
  for (int i = 0; i < 16; i++) lcd.print(homeText[i]);
}

void showVitalsPage() {
  currentPage = VITALS_PAGE;
  pageStartedAt = millis();
  updateVitalsLCD();
}

void updateVitalsLCD() {
  char line1[17];
  char line2[17];

  if (heartRateValid && spo2Valid) {
    snprintf(line1, sizeof(line1), "HR:%3d SpO2:%2d%%", heartRateBpm, spo2Pct);
  } else if (heartRateValid) {
    snprintf(line1, sizeof(line1), "HR:%3d SpO2:--", heartRateBpm);
  } else {
    snprintf(line1, sizeof(line1), "HR:--- SpO2:--");
  }

  if (dhtReadingValid) {
    // Show temperature and humidity on alternating vitals-page updates
    static bool showHumidity = false;
    showHumidity = !showHumidity;
    if (showHumidity) snprintf(line2, sizeof(line2), "Temp: %.1f C", temperatureC);
    else snprintf(line2, sizeof(line2), "Humidity: %.0f%%", humidityPct);
  } else {
    snprintf(line2, sizeof(line2), "DHT: waiting...");
  }

  clearLine(0);
  lcd.setCursor(0, 0);
  lcd.print(line1);
  clearLine(1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void updateDisplayPages() {
  unsigned long now = millis();

  if (currentPage == NORMAL_PAGE) {
    if (now - lastHomeScroll >= 500) {
      lastHomeScroll = now;
      int textLength = sizeof(homeText) - 1;
      int maxOffset = textLength - 16;
      homeScrollIndex++;
      if (homeScrollIndex > maxOffset) homeScrollIndex = 0;
      lcd.setCursor(0, 1);
      for (int i = 0; i < 16; i++) lcd.print(homeText[homeScrollIndex + i]);
    }
  }

  if (now - pageStartedAt >= PAGE_DURATION_MS) {
    if (currentPage == NORMAL_PAGE) showVitalsPage();
    else showNormalPage();
  }
}

// ---------------- BUZZER / LED ----------------
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
  unsigned long now = millis();

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

// ---------------- WIFI / EMAIL ----------------
bool connectWiFi() {
  showLCD("Connecting WiFi", "Please wait...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 20000) {
    digitalWrite(LED_PIN, (millis() / 250) % 2);
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
    updateLED();
    return true;
  }

  digitalWrite(LED_PIN, LOW);
  return false;
}

bool sendAlert(const String& alertTitle, const String& details) {
  Serial.println("\nSending alert: " + alertTitle);
  showLCD("Sending Email...", alertTitle.c_str());
  startAlertBuzzer();

  bool success = false;
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    unsigned long startTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
      delay(200);
      updateLED();
    }
  }

  if (WiFi.status() == WL_CONNECTED &&
      strlen(SENDER_EMAIL) > 0 && strlen(APP_PASSWORD) > 0 &&
      strlen(RECIPIENT_EMAIL) > 0) {
    Session_Config config;
    config.server.host_name = SMTP_HOST;
    config.server.port = SMTP_PORT;
    config.login.email = SENDER_EMAIL;
    config.login.password = APP_PASSWORD;
    config.login.user_domain = "";
    config.time.ntp_server = "pool.ntp.org,time.nist.gov";
    config.time.gmt_offset = 5.5;
    config.time.day_light_offset = 0;

    SMTP_Message message;
    message.sender.name = "Smart Communication Glove";
    message.sender.email = SENDER_EMAIL;
    String subject = "Glove Alert: " + alertTitle;
    String body = "Smart Communication Glove Alert\n\n" +
                  alertTitle + "\n" + details +
                  "\n\nPlease check on the user. This is not a medical diagnosis.";
    message.subject = subject.c_str();
    message.addRecipient("Alert Recipient", RECIPIENT_EMAIL);
    message.text.content = body.c_str();
    message.text.charSet = "utf-8";
    message.text.transfer_encoding = Content_Transfer_Encoding::enc_7bit;

    smtp.debug(1);
    if (smtp.connect(&config)) success = MailClient.sendMail(&smtp, &message);
    if (!success) Serial.println("Email failed: " + smtp.errorReason());
  } else {
    Serial.println("Email not sent: check Wi-Fi and Gmail settings in the sketch.");
  }

  smtp.closeSession();

  if (success) {
    showLCD("Email Sent!", alertTitle.c_str());
    Serial.println("Email sent successfully.");
    if (!helpEmergencyLatched) stopAlertBuzzer();
  } else {
    showLCD("Email Failed", "Check Serial");
  }
  delay(1200);

  // Resume the current page cycle after the email status screen.
  if (currentPage == VITALS_PAGE) showVitalsPage();
  else showNormalPage();
  return success;
}

// ---------------- FLEX SENSOR HELPERS ----------------
int readFlexSensor(int pin) {
  long total = 0;
  for (int i = 0; i < 10; i++) {
    total += analogRead(pin);
    delay(2);
  }
  return total / 10;
}

void calibrateSensors() {
  showLCD("Keep fingers", "straight...");
  Serial.println("Calibrating flex sensors. Keep fingers straight.");
  delay(2000);
  baseline1 = readFlexSensor(FLEX1_PIN);
  baseline2 = readFlexSensor(FLEX2_PIN);
  baseline3 = readFlexSensor(FLEX3_PIN);
  Serial.printf("Flex baselines: %d, %d, %d\n", baseline1, baseline2, baseline3);
  helpActive = waterActive = yesActive = false;
}

// ---------------- VITAL SENSOR HELPERS ----------------
void updateDHT22() {
  if (millis() - lastDhtRead < 2000) return;
  lastDhtRead = millis();

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) {
    humidityPct = h;
    temperatureC = t;
    dhtReadingValid = true;
  } else {
    dhtReadingValid = false;
    Serial.println("DHT22 read failed. Check data pin and wiring.");
  }
}

// ---------------- DEMO HR / SpO2 VALUES ----------------
// Randomized sample values only, NOT live measurements.
// HR: 73-85 BPM; SpO2: 96-98%. Updated every 5 seconds.
void updateMAX30102() {
  if (millis() - lastDemoVitalsUpdate < 5000 && lastDemoVitalsUpdate != 0) return;
  lastDemoVitalsUpdate = millis();
  heartRateBpm = random(73, 86);  // random() upper bound is exclusive
  spo2Pct = random(96, 99);       // produces 96, 97, or 98
  heartRateValid = true;
  spo2Valid = true;
}

// ---------------- VITAL ALERT CHECK ----------------
void checkVitalAlerts() {
  if (millis() - lastVitalAlert < VITAL_ALERT_COOLDOWN_MS) return;

  String title = "";
  String details = "";

  if (heartRateValid && heartRateBpm > HIGH_HEART_RATE_BPM) {
    title = "HIGH HEART RATE";
    details = "Heart rate: " + String(heartRateBpm) + " BPM";
  } else if (heartRateValid && heartRateBpm < LOW_HEART_RATE_BPM) {
    title = "LOW HEART RATE";
    details = "Heart rate: " + String(heartRateBpm) + " BPM";
  } else if (spo2Valid && spo2Pct < LOW_SPO2_PERCENT) {
    title = "LOW SpO2";
    details = "Estimated SpO2: " + String(spo2Pct) + "%";
  } else if (dhtReadingValid && temperatureC > HIGH_TEMP_C) {
    title = "HIGH TEMPERATURE";
    details = "DHT22 temperature: " + String(temperatureC, 1) + " C";
  } else if (dhtReadingValid && humidityPct > HIGH_HUMIDITY) {
    title = "HIGH HUMIDITY";
    details = "DHT22 humidity: " + String(humidityPct, 1) + "%";
  }

  if (title.length() > 0) {
    lastVitalAlert = millis();
    sendAlert(title, details);
  }
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  randomSeed(micros());
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
  dht.begin();

  showLCD("Smart Glove", "Initializing...");
  delay(1000);

  bool wifiOK = connectWiFi();
  if (!wifiOK) {
    showLCD("WiFi Failed", "Check hotspot");
    Serial.println("Startup stopped: Wi-Fi unavailable.");
    return;
  }

  showLCD("Checking sensors", "Please wait...");
  updateMAX30102(); // Set randomized demo values for HR and SpO2.

  // Flex sensor check and calibration
  int v1 = readFlexSensor(FLEX1_PIN);
  int v2 = readFlexSensor(FLEX2_PIN);
  int v3 = readFlexSensor(FLEX3_PIN);
  if (v1 <= 2 || v1 >= 4093 || v2 <= 2 || v2 >= 4093 ||
      v3 <= 2 || v3 >= 4093) {
    showLCD("Flex Check Error", "Check wiring!");
    Serial.println("Warning: one or more flex readings are near ADC limits.");
    delay(1500);
  }

  calibrateSensors();
  startupReady = true;
  showNormalPage();

  Serial.println("Smart Communication Glove ready.");
  Serial.println("Flex GPIO34=HELP, GPIO35=NEED WATER, GPIO32=NEED FOOD");
  Serial.println("HR 73-85 BPM and SpO2 96-98% are RANDOM DEMO values, not sensor readings; DHT22 data=GPIO27");
  Serial.println("LCD alternates normal/vitals every 5 seconds.");
}

// ---------------- MAIN LOOP ----------------
void loop() {
  updateBuzzer();
  updateLED();

  if (!startupReady) {
    delay(50);
    return;
  }

  updateMAX30102(); // Random demo HR/SpO2 values; no MAX30102 library needed.
  updateDHT22();
  updateDisplayPages();

  int flex1 = readFlexSensor(FLEX1_PIN);
  int flex2 = readFlexSensor(FLEX2_PIN);
  int flex3 = readFlexSensor(FLEX3_PIN);
  int diff1 = abs(flex1 - baseline1);
  int diff2 = abs(flex2 - baseline2);
  int diff3 = abs(flex3 - baseline3);

  // FLEX 1 = HELP emergency. Alarm remains latched until ESP32 restarts.
  if (diff1 > CHANGE_THRESHOLD && !helpActive && !helpEmergencyLatched) {
    helpActive = true;
    helpEmergencyLatched = true;
    startAlertBuzzer();
    sendAlert("HELP EMERGENCY", "Gesture detected: HELP emergency.");
  }
  if (diff1 < RESET_THRESHOLD) helpActive = false;

  // FLEX 2 = NEED WATER
  if (diff2 > CHANGE_THRESHOLD && !waterActive) {
    waterActive = true;
    sendAlert("NEED WATER", "Gesture detected: user needs water.");
  }
  if (diff2 < RESET_THRESHOLD) waterActive = false;

  // FLEX 3 = NEED FOOD
  if (diff3 > CHANGE_THRESHOLD && !yesActive) {
    yesActive = true;
    sendAlert("NEED FOOD", "Gesture detected: user needs food.");
  }
  if (diff3 < RESET_THRESHOLD) yesActive = false;

  checkVitalAlerts();

  if (currentPage == VITALS_PAGE) {
    // Refresh vitals display without resetting its 5-second timer.
    static unsigned long lastVitalsLCDUpdate = 0;
    if (millis() - lastVitalsLCDUpdate >= 1000) {
      lastVitalsLCDUpdate = millis();
      updateVitalsLCD();
    }
  }

  updateBuzzer();
  updateLED();
  delay(10);
}