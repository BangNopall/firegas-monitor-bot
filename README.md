# 🔥 FireGas Monitor Bot (ESP32 + MQTT + Telegram Bot)

FireGas Monitor Bot adalah sistem monitoring **sensor Gas (MQ2)** dan **sensor Api (Flame Sensor)** berbasis **ESP32**, **MQTT HiveMQ Cloud**, dan **Telegram Bot (Telegraf.js)**.
Proyek ini dibuat untuk kebutuhan **proyek akhir mata kuliah Mikroprosesor & Mikrokontroler**.

Bot dapat:

* Menampilkan status sensor terkini
* Mengirim data secara realtime ke Telegram
* Menjalankan mode TEST (simulasi data random)
* Pause otomatis bila sensor berhenti mengirim data
* Resume otomatis bila sensor kembali aktif

---

## 🚀 Fitur Utama

### ✔ `/start`

Menampilkan informasi dasar bot dan daftar perintah.

### ✔ `/status`

Menampilkan data sensor terbaru dari MQTT:

* Nilai MQ2 (gas)
* Nilai flame (api)
* Status bahaya gas
* Status api terdeteksi
* Timestamp saat data diterima

### ✔ `/realtime_on`

Mengaktifkan mode pengiriman status realtime setiap detik:

* Pause otomatis bila data sensor berhenti
* Resume otomatis bila data kembali aktif
* Tidak perlu menulis `/realtime_on` ulang

### ✔ `/realtime_on test`

Mode khusus untuk simulasi:

* Bot mengirim data sensor random ke MQTT setiap 5 detik
* Cocok untuk uji sistem tanpa ESP32

### ✔ `/realtime_off`

Mematikan realtime & mematikan mode test jika sedang aktif.

---

## 📡 Arsitektur Sistem

```
ESP32 (MQ2 + Flame)
        │
   Publikasi MQTT (JSON)
        │
  HiveMQ Cloud Broker
        │
Node.js Bot Subscriber
        │
   Telegram Bot (Telegraf)
```

Format JSON dari ESP32:

```json
{"mq2":445,"flame":1383,"gasDanger":false,"fireDetected":true}
```

---

## 📁 Struktur Direktori

```
.
├── .env
├── README.md
├── package.json
└── src/
    ├── index.ts               # Entry development (polling)
    ├── commands/
    │   ├── start.ts           # /start
    │   ├── status.ts          # /status
    │   └── realtime.ts        # /realtime_on, /realtime_off, test mode
    ├── services/
    │   └── mqtt.ts            # Koneksi MQTT & data sensor terakhir
```

---

## ⚙️ Setup Environment

Buat file `.env` seperti berikut:

```env
BOT_TOKEN="isi_token_bot"

MQTT_URL="mqtts://xxxx.s1.eu.hivemq.cloud:8883"
MQTT_USERNAME="username"
MQTT_PASSWORD="password"
MQTT_TOPIC_SENSOR="/firegasmnmkel6/monitoring/sensor"

REALTIME_INTERVAL_MS=1000
REALTIME_STALE_MS=2000
```

---

## 🧩 Instalasi

```bash
npm install
```

atau

```bash
yarn
```

---

## 🛠 Menjalankan Bot (Development)

Mode polling:

```bash
npm run dev
```

Bot akan:

* Connect ke MQTT
* Menjalankan polling update Telegram
* Mencetak log debug ke terminal

---

## 🚀 Menjalankan Bot di PM2 (VPS)

Jalankan:

```bash
pm2 start npm --name firegas-bot -- run start
```

Cek log:

```bash
pm2 logs firegas-bot
```

Restart:

```bash
pm2 restart firegas-bot
```

Stop:

```bash
pm2 stop firegas-bot
```

---

## 🏗 Script `start` untuk PM2

Di `package.json` sudah disiapkan:

```json
"start": "NODE_ENV=production DEBUG=bot* dotenv -- node -r ts-node/register src/index.ts"
```

---

## 🧪 Mode TEST (simulasi data sensor)

Jalankan:

```
/realtime_on test
```

Fitur:

* Bot mengirim data random ke MQTT setiap 5 detik
* Data otomatis diterima bot melalui subscribe
* Cocok untuk uji sistem tanpa ESP32

Contoh data random:

```json
{"mq2":950,"flame":1200,"gasDanger":true,"fireDetected":false}
```

Stop test:

```
/realtime_off
```

---

## 📡 Realtime dengan Pause & Resume Cerdas

Bot dilengkapi fitur cerdas:

* STOP mengirim realtime bila data MQTT **tidak berubah**
* KIRIM pesan “Pause” sekali saja
* OTOMATIS resume jika data sensor kembali berubah
* Realtime tetap aktif tanpa user mengetik `/realtime_on` lagi

---

## 🔧 Teknologi yang Digunakan

| Komponen      | Teknologi                             |
| ------------- | ------------------------------------- |
| IoT           | ESP32 + MQ2 Gas Sensor + Flame Sensor |
| Messaging     | Telegram Bot API (Telegraf.js)        |
| Backend       | Node.js + TypeScript                  |
| IoT Messaging | MQTT.js + HiveMQ Cloud                |
| Deployment    | PM2 / Vercel                          |
| Logging       | debug module                          |

---

## 👨‍💻 Tim Pengembang

Proyek ini dikembangkan oleh **Kelompok 6 (MNMKEL6)**
untuk tugas akhir **Mikroprosesor & Mikrokontroler**.

---

## 📄 Lisensi

Project ini digunakan untuk tujuan pembelajaran dan pengembangan sistem IoT.