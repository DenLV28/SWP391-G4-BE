/**
 * ParkFlow Gate Controller — ESP32
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Sơ đồ kết nối:
 * ┌──────────────┬───────────┬──────────────────────────────────────────┐
 * │ Linh kiện    │ Chân ESP32│ Ghi chú                                  │
 * ├──────────────┼───────────┼──────────────────────────────────────────┤
 * │ MFRC522 SDA  │ GPIO  5   │ SS / Chip Select                         │
 * │ MFRC522 SCK  │ GPIO 18   │ SPI Clock                                │
 * │ MFRC522 MOSI │ GPIO 23   │ SPI MOSI                                 │
 * │ MFRC522 MISO │ GPIO 19   │ SPI MISO                                 │
 * │ MFRC522 RST  │ GPIO 27   │ Reset                                    │
 * │ MFRC522 3.3V │ 3.3V      │                                          │
 * │ MFRC522 GND  │ GND       │                                          │
 * ├──────────────┼───────────┼──────────────────────────────────────────┤
 * │ Servo Signal │ GPIO 13   │ Qua điện trở 1kΩ (bảo vệ GPIO)          │
 * │ Servo VCC    │ 5V ngoài  │ Dùng nguồn riêng 5V/2A, GND chung ESP32 │
 * │ Servo GND    │ GND       │ Nối chung với GND ESP32                  │
 * ├──────────────┼───────────┼──────────────────────────────────────────┤
 * │ LED xanh (+) │ GPIO  2   │ Built-in LED (active-LOW trên hầu hết   │
 * │              │           │ board ESP32) hoặc LED ngoài + 220Ω      │
 * │ LED đỏ  (+)  │ GPIO  4   │ LED ngoài + điện trở 220Ω               │
 * └──────────────┴───────────┴──────────────────────────────────────────┘
 *
 * Luồng hoạt động:
 *   1. Quẹt thẻ RFID → đọc UID (hex, chữ hoa)
 *   2. POST /api/iot/rfid-tap { rfidUid, gateId, direction }
 *   3. Backend tra dbo.vehicles:
 *        - Đã đăng ký → openBarrier=true  → servo mở 90° + LED xanh 5s
 *        - Chưa đăng ký → openBarrier=false → LED đỏ nhấp nháy 3 lần
 *   4. Song song: poll GET /api/iot/gate-command/GATE_ID mỗi 1 giây
 *        - Staff bấm "Mở rào" / "Đóng rào" trên web → servo nhận lệnh ngay
 *
 * Thư viện (cài qua Arduino Library Manager):
 *   • MFRC522         by GithubCommunity
 *   • ESP32Servo      by Kevin Harrington / John K. Bennett
 *   • ArduinoJson     by Benoit Blanchon  (version ≥ 6)
 *
 * Board: "ESP32 Dev Module" (hoặc tương đương) trong Arduino IDE
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

// ─── ⚙️  Cấu hình — THAY BẰNG THÔNG TIN THỰC TẾ ─────────────────────────────
const char* WIFI_SSID  = "TEN_WIFI";          // Tên WiFi
const char* WIFI_PASS  = "MAT_KHAU_WIFI";     // Mật khẩu WiFi
// IP máy chạy backend Node.js (server.js) trong cùng mạng LAN
// Lấy lại bằng lệnh `ipconfig` nếu IP thay đổi (dòng IPv4 Address)
const char* BACKEND    = "http://192.168.1.4:4000";
const char* GATE_ID    = "A1";      // Mã cổng — phải khớp với gateId trong web
const char* DIRECTION  = "entry";   // "entry" (xe vào) | "exit" (xe ra)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Chân GPIO (khớp với sơ đồ thực tế của bạn) ────────────────────────────
#define RFID_SS    5
#define RFID_RST  22   // RST của RC522
#define SERVO_PIN 27   // Signal servo
#define LED_GREEN  2   // Built-in LED — active LOW trên hầu hết board ESP32
#define LED_RED    4   // LED đỏ ngoài — active HIGH

// ─── Thông số servo / cổng ───────────────────────────────────────────────────
#define SERVO_CLOSED    0    // Góc độ: rào đóng
#define SERVO_OPEN     90    // Góc độ: rào mở
#define GATE_OPEN_MS 5000    // Giữ rào mở 5 giây rồi tự đóng

// ─── Objects & state ─────────────────────────────────────────────────────────
MFRC522       rfid(RFID_SS, RFID_RST);
Servo         gateServo;

String        lastUid       = "";
unsigned long lastTapMs     = 0;
bool          gateIsOpen    = false;
unsigned long gateOpenedAt  = 0;
unsigned long lastPollMs    = 0;

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════

String uidToHex(MFRC522::Uid& uid) {
  String s = "";
  for (byte i = 0; i < uid.size; i++) {
    if (uid.uidByte[i] < 0x10) s += "0";
    s += String(uid.uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

// LED xanh: active-LOW trên board thường dùng (built-in LED đảo chiều)
void ledGreen(bool on) { digitalWrite(LED_GREEN, on ? LOW : HIGH); }
void ledRed(bool on)   { digitalWrite(LED_RED,   on ? HIGH : LOW); }

void blinkDenied() {
  for (int i = 0; i < 3; i++) {
    ledRed(true);  delay(200);
    ledRed(false); delay(200);
  }
}

void openGate() {
  gateServo.write(SERVO_OPEN);
  gateIsOpen   = true;
  gateOpenedAt = millis();
  ledGreen(true);
  Serial.println("GATE OPEN");
}

void closeGate() {
  gateServo.write(SERVO_CLOSED);
  gateIsOpen = false;
  ledGreen(false);
  Serial.println("GATE CLOSED");
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 12000) {
    delay(400); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK  IP: " + WiFi.localIP().toString());
  } else {
    Serial.println(" TIMEOUT");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/iot/rfid-tap
//   Gửi UID lên backend. Backend trả về openBarrier=true nếu thẻ đã đăng ký.
// ═════════════════════════════════════════════════════════════════════════════
bool sendRfidTap(const String& uid, bool* outOpen) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(String(BACKEND) + "/api/iot/rfid-tap");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  // Tạo JSON body thủ công (tránh cấp phát động)
  String body = "{\"rfidUid\":\"" + uid
    + "\",\"gateId\":\""   + String(GATE_ID)
    + "\",\"direction\":\"" + String(DIRECTION) + "\"}";

  int code = http.POST(body);
  bool ok  = false;

  if (code == 200) {
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, http.getString())) {
      *outOpen = doc["openBarrier"] | false;
      ok = true;
      Serial.printf("[RFID-TAP] openBarrier=%s  vehicle=%s\n",
        *outOpen ? "YES" : "NO",
        doc["vehicle"]["licensePlate"] | "—");
    }
  } else {
    Serial.printf("[RFID-TAP] HTTP %d\n", code);
  }

  http.end();
  return ok;
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/iot/gate-command/:gateId
//   Poll mỗi 1 giây để nhận lệnh "open" / "close" từ staff dashboard.
//   Backend xóa lệnh ngay sau khi trả về (consume-once).
// ═════════════════════════════════════════════════════════════════════════════
void pollGateCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(BACKEND) + "/api/iot/gate-command/" + String(GATE_ID));
  http.setTimeout(3000);
  int code = http.GET();

  if (code == 200) {
    StaticJsonDocument<64> doc;
    if (!deserializeJson(doc, http.getString())) {
      const char* cmd = doc["command"];
      if (cmd) {
        String c = String(cmd);
        Serial.println("[CMD] " + c);
        if (c == "open")  openGate();
        if (c == "close") closeGate();
      }
    }
  }
  http.end();
}

// ═════════════════════════════════════════════════════════════════════════════
// setup & loop
// ═════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED,   OUTPUT);
  ledGreen(false);
  ledRed(false);

  SPI.begin();
  rfid.PCD_Init();

  gateServo.attach(SERVO_PIN);
  gateServo.write(SERVO_CLOSED);

  connectWifi();
  Serial.println("=== ParkFlow Gate Controller READY ===");
}

void loop() {
  // 1. Giữ kết nối WiFi
  if (WiFi.status() != WL_CONNECTED) connectWifi();

  // 2. Tự động đóng rào sau GATE_OPEN_MS
  if (gateIsOpen && (millis() - gateOpenedAt >= GATE_OPEN_MS)) {
    closeGate();
  }

  // 3. Poll lệnh thủ công từ staff dashboard mỗi 1 giây
  if (millis() - lastPollMs >= 1000) {
    lastPollMs = millis();
    pollGateCommand();
  }

  // 4. Đọc thẻ RFID
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = uidToHex(rfid.uid);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Debounce: bỏ qua cùng thẻ trong 3 giây
  if (uid == lastUid && millis() - lastTapMs < 3000) return;
  lastUid   = uid;
  lastTapMs = millis();

  Serial.println("[RFID] " + uid);

  bool openBarrier = false;
  if (sendRfidTap(uid, &openBarrier)) {
    if (openBarrier) {
      openGate();
    } else {
      // Thẻ chưa đăng ký trong hệ thống
      Serial.println("[RFID] DENIED — chua dang ky");
      blinkDenied();
    }
  } else {
    // Không liên lạc được backend → fail-closed (an toàn hơn)
    Serial.println("[RFID] BACKEND UNREACHABLE — fail-closed");
    blinkDenied();
  }
}
