/*
 * Аристократ — ПАРКИНГ 2 (ворота, 1 реле)
 *
 * Плата: ESP32 Dev Module. Библиотека: PubSubClient (Nick O'Leary).
 * Заполните блок НАСТРОЙКИ и загрузите. В Serial Monitor (115200) должно быть "[mqtt] connected".
 *
 * Подключение:  GPIO 2 -> реле ворот
 * Топик:        aristokrat/parking2/gate/cmd
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// ======================= НАСТРОЙКИ =======================
const char* WIFI_SSID     = "ИМЯ_WIFI";        // только 2.4 ГГц
const char* WIFI_PASSWORD = "ПАРОЛЬ_WIFI";

const char* MQTT_HOST     = "broker.emqx.io";  // публичный брокер EMQX (тест, без защиты)
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "esp-parking";
const char* MQTT_PASSWORD = "";               // публичному брокеру пароль не нужен
const char* MQTT_PREFIX   = "aristokrat";

const int  PIN_GATE         = 2;     // реле ворот
const bool RELAY_ACTIVE_LOW = true;  // если реле щёлкает «наоборот» — поставьте false
const uint32_t PULSE_MS     = 1000;  // длительность импульса
// =========================================================

const char* DEVICE = "parking2";

// Корневые сертификаты TLS: ISRG Root X1 (Let's Encrypt, HiveMQ Cloud) и DigiCert Global Root G2 (EMQX)
const char ROOT_CA[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)PEM";

struct Relay {
  const char* name;
  int pin;
  bool on;
  uint32_t offAt;
  char lastId[32];
};

Relay relays[] = {
  {"gate", PIN_GATE, false, 0, ""},
};
const size_t RELAY_COUNT = sizeof(relays) / sizeof(relays[0]);

WiFiClientSecure net;
PubSubClient mqtt(net);

char topicStatus[64];
char topicInfo[64];
uint32_t lastMqttTry = 0;
uint32_t mqttRetryMs = 2000;
uint32_t lastWifiTry = 0;
uint32_t lastInfo = 0;

// ------------------------------------------------------------ реле

uint8_t levelFor(bool on) {
  return (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW;
}

void publishRelayState(Relay& r) {
  char t[96];
  snprintf(t, sizeof(t), "%s/%s/%s/state", MQTT_PREFIX, DEVICE, r.name);
  mqtt.publish(t, r.on ? "1" : "0");
}

void relaySet(Relay& r, bool on) {
  r.on = on;
  digitalWrite(r.pin, levelFor(on));
  if (mqtt.connected()) publishRelayState(r);
}

void relaysLoop() {
  uint32_t now = millis();
  for (size_t i = 0; i < RELAY_COUNT; i++) {
    Relay& r = relays[i];
    if (r.on && (int32_t)(now - r.offAt) >= 0) relaySet(r, false);
  }
}

bool anyRelayOn() {
  for (size_t i = 0; i < RELAY_COUNT; i++) if (relays[i].on) return true;
  return false;
}

// ------------------------------------------------------------ MQTT

void onMessage(char* topic, byte* payload, unsigned int len) {
  for (size_t i = 0; i < RELAY_COUNT; i++) {
    Relay& r = relays[i];
    char expect[96];
    snprintf(expect, sizeof(expect), "%s/%s/%s/cmd", MQTT_PREFIX, DEVICE, r.name);
    if (strcmp(topic, expect) != 0) continue;

    char id[32];
    size_t n = len < sizeof(id) - 1 ? len : sizeof(id) - 1;
    memcpy(id, payload, n);
    id[n] = '\0';

    // QoS 1 может доставить команду дважды — тот же id второй раз не открывает
    bool duplicate = n > 0 && strcmp(id, r.lastId) == 0;
    if (!duplicate) {
      strncpy(r.lastId, id, sizeof(r.lastId) - 1);
      r.offAt = millis() + PULSE_MS;
      if (!r.on) relaySet(r, true);
      Serial.printf("[cmd] %s id=%s\n", r.name, id);
    }

    // подтверждение приложению: команда получена
    char ack[96];
    snprintf(ack, sizeof(ack), "%s/%s/%s/ack", MQTT_PREFIX, DEVICE, r.name);
    mqtt.publish(ack, id);
    return;
  }
}

void publishInfo() {
  char json[128];
  snprintf(json, sizeof(json), "{\"rssi\":%d,\"uptime\":%lu,\"ip\":\"%s\"}",
           WiFi.RSSI(), (unsigned long)(millis() / 1000), WiFi.localIP().toString().c_str());
  mqtt.publish(topicInfo, json, true);
}

void mqttConnect() {
  char clientId[48];
  snprintf(clientId, sizeof(clientId), "aristokrat-%s-%06lx", DEVICE,
           (unsigned long)(ESP.getEfuseMac() & 0xFFFFFF));

  Serial.printf("[mqtt] connecting to %s:%d ...\n", MQTT_HOST, MQTT_PORT);
  // LWT: если ESP пропадёт, брокер сам опубликует "offline"
  if (!mqtt.connect(clientId, MQTT_USER, MQTT_PASSWORD, topicStatus, 1, true, "offline")) {
    Serial.printf("[mqtt] failed, state=%d\n", mqtt.state());
    mqttRetryMs = mqttRetryMs < 30000 ? mqttRetryMs * 2 : 30000;
    return;
  }
  Serial.println("[mqtt] connected");
  mqttRetryMs = 2000;

  mqtt.publish(topicStatus, "online", true);
  for (size_t i = 0; i < RELAY_COUNT; i++) {
    char t[96];
    snprintf(t, sizeof(t), "%s/%s/%s/cmd", MQTT_PREFIX, DEVICE, relays[i].name);
    mqtt.subscribe(t, 1);
    publishRelayState(relays[i]);
  }
  publishInfo();
}

// ------------------------------------------------------------ setup / loop

void setup() {
  // сначала уровень «выключено», потом OUTPUT — чтобы реле не щёлкнуло при старте
  for (size_t i = 0; i < RELAY_COUNT; i++) {
    digitalWrite(relays[i].pin, levelFor(false));
    pinMode(relays[i].pin, OUTPUT);
  }

  Serial.begin(115200);
  delay(100);
  Serial.printf("\nAristokrat %s\n", DEVICE);

  snprintf(topicStatus, sizeof(topicStatus), "%s/%s/status", MQTT_PREFIX, DEVICE);
  snprintf(topicInfo, sizeof(topicInfo), "%s/%s/info", MQTT_PREFIX, DEVICE);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  net.setCACert(ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setKeepAlive(20);
  mqtt.setSocketTimeout(10);
  mqtt.setBufferSize(512);
}

void loop() {
  relaysLoop();  // реле выключается по таймеру даже без интернета

  uint32_t now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiTry > 15000) {
      lastWifiTry = now;
      Serial.println("[wifi] reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    delay(10);
    return;
  }

  if (!mqtt.connected()) {
    // TLS-подключение блокирует loop на несколько секунд — не начинаем его, пока реле замкнуто
    if (!anyRelayOn() && now - lastMqttTry > mqttRetryMs) {
      lastMqttTry = now;
      mqttConnect();
    }
  } else {
    mqtt.loop();
    if (now - lastInfo > 60000) {
      lastInfo = now;
      publishInfo();
    }
  }
  delay(5);
}

