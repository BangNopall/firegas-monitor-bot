#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ================== WIFI & MQTT (HiveMQ Cloud) ==================
const char* WIFI_SSID     = "modalta";
const char* WIFI_PASSWORD = "nopal1234";

const char* MQTT_HOST     = "ef8001243aab4e788208799a8704d371.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;

const char* MQTT_USER     = "hivemq.webclient.1763498865659";
const char* MQTT_PASSWORD = "5c>H%98pCwU.2JAqfd#B";

// Topik MQTT
const char* topic_sensor  = "/firegasmnmkel6/monitoring/sensor";  // data sensor SAAT ALERT
const char* topic_alert   = "/firegasmnmkel6/monitoring/alert";   // alert teks / JSON

WiFiClientSecure espClient;
PubSubClient client(espClient);

// ================== PIN SENSOR & AKTUATOR ==================
#define MQ2_PIN     35
#define FLAME_PIN   34
#define BUZZER_PIN  14

// === PWM BUZZER ESP32 ===
#define PWM_CHANNEL 0
#define PWM_FREQ    2500
#define PWM_RES     8

// === OLED ===
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// === THRESHOLD ===
int MQ2_THRESHOLD   = 800;   // Gas bahaya jika > 800
int FLAME_THRESHOLD = 2000;  // Ada api jika < 2000

// === STATUS SEBELUMNYA (untuk deteksi perubahan) ===
bool lastGasBahaya     = false;
bool lastApiTerdeteksi = false;

// ================== WIFI & MQTT FUNCTION ==================

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Pesan masuk [");
  Serial.print(topic);
  Serial.print("]: ");
  for (unsigned int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}

void mqttReconnect() {
  while (!client.connected()) {
    Serial.print("Menghubungkan ke MQTT... ");

    String clientId = "ESP32-GasFlame-";
    clientId += String((uint32_t)ESP.getEfuseMac(), HEX);

    if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("CONNECTED");
    } else {
      Serial.print("Gagal, rc=");
      Serial.print(client.state());
      Serial.println(" coba lagi dalam 5 detik");
      delay(5000);
    }
  }
}

// ================== SETUP ==================

void setup() {
  Serial.begin(115200);

  // Buzzer: PWM
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RES);
  ledcAttachPin(BUZZER_PIN, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED Failed");
    while (1);
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Starting System...");
  display.display();
  delay(1500);

  // WiFi
  setup_wifi();

  // TLS: tanpa CA (tidak verifikasi sertifikat)
  espClient.setInsecure();

  // MQTT
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setCallback(mqttCallback);
}

// ================== LOOP ==================

void loop() {
  // Jaga WiFi tetap konek
  if (WiFi.status() != WL_CONNECTED) {
    setup_wifi();
  }

  // Jaga MQTT tetap konek
  if (!client.connected()) {
    mqttReconnect();
  }
  client.loop();

  // === BACA SENSOR ===
  int mq2_raw   = analogRead(MQ2_PIN);
  int flame_raw = analogRead(FLAME_PIN);

  Serial.print("MQ2=");
  Serial.print(mq2_raw);
  Serial.print(" | Flame=");
  Serial.println(flame_raw);

  // === LOGIKA DETEKSI ===
  bool gasBahaya     = mq2_raw > MQ2_THRESHOLD;
  bool apiTerdeteksi = flame_raw < FLAME_THRESHOLD;

  // === BUZZER ===
  if (gasBahaya || apiTerdeteksi) {
    ledcWrite(PWM_CHANNEL, 255);  // nyaring
  } else {
    ledcWrite(PWM_CHANNEL, 0);    // mati
  }

  // === OLED DISPLAY ===
  display.clearDisplay();
  display.setCursor(0, 0);

  display.println("=== SENSOR STATUS ===");
  display.print("MQ2  : ");
  display.println(mq2_raw);

  display.print("Flame: ");
  display.println(flame_raw);

  display.println("---------------------");

  if (gasBahaya)          display.println("!! GAS TERDETEKSI !!");
  if (apiTerdeteksi)      display.println("!! API TERDETEKSI !!");
  if (!gasBahaya && !apiTerdeteksi) display.println("Aman ✓");

  display.display();

  // === KIRIM MQTT HANYA SAAT MASUK KONDISI BAHAYA ===
  bool alertNow    = gasBahaya || apiTerdeteksi;

  if (alertNow) {
    // 1) Payload JSON untuk bot (/status & realtime)
    char payload[200];
    snprintf(
      payload,
      sizeof(payload),
      "{\"mq2\":%d,\"flame\":%d,\"gasDanger\":%s,\"fireDetected\":%s}",
      mq2_raw,
      flame_raw,
      gasBahaya ? "true" : "false",
      apiTerdeteksi ? "true" : "false"
    );

    Serial.print("Publish SENSOR ALERT: ");
    Serial.println(payload);
    client.publish(topic_sensor, payload);  // bot baca ini

    // 2) Pesan alert lebih human-readable (boleh juga dijadikan JSON kalau mau)
    String alertMsg = "ALERT: ";
    if (gasBahaya)     alertMsg += "Gas berbahaya ";
    if (apiTerdeteksi) alertMsg += "Api terdeteksi ";
    alertMsg += "di lokasi!";

    Serial.print("Publish ALERT TEXT: ");
    Serial.println(alertMsg);
    client.publish(topic_alert, alertMsg.c_str());
  }

  // Simpan status untuk perbandingan loop berikutnya
  lastGasBahaya     = gasBahaya;
  lastApiTerdeteksi = apiTerdeteksi;

  delay(700);
}
