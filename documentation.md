

---

# FireGas Monitor Bot – Dokumentasi Proyek

## 1. Gambaran Umum Proyek

Proyek ini adalah **Telegram Bot** berbasis **Node.js + TypeScript** yang digunakan untuk:

* Memantau **sensor gas (MQ2)** dan **sensor api (flame)** pada **ESP32**
* Komunikasi data dari ESP32 ke backend menggunakan **MQTT (HiveMQ Cloud)**
* Mengirim informasi dan status sensor ke **Telegram** melalui beberapa perintah bot.

Flow sederhananya:

1. **ESP32** membaca data sensor (MQ2 & flame)
2. ESP32 mengirim data JSON ke **MQTT broker HiveMQ Cloud** pada topik:

   * `/firegasmnmkel6/monitoring/sensor`
3. Backend Node.js berlangganan (subscribe) ke topik tersebut dengan **MQTT.js**
4. Data yang diterima disimpan sebagai data sensor terakhir (`lastSensorData`)
5. Bot Telegram (pakai **Telegraf**) membaca `lastSensorData` dan mengirim ke user ketika:

   * user mengetik `/status`
   * user mengaktifkan `/realtime_on` (update berkala)

Format data JSON yang dikirim ESP32:

```json
{"mq2":445,"flame":1383,"gasDanger":false,"fireDetected":true}
```

* `mq2` → nilai ADC sensor gas
* `flame` → nilai ADC sensor api
* `gasDanger` → `true` jika gas di atas batas aman
* `fireDetected` → `true` jika api terdeteksi

---

## 2. Struktur Folder & File

Struktur utama proyek (dari zip):

```text
.
├── .env                 # Konfigurasi environment (token bot, MQTT, dll.)
├── .env-sample          # Contoh isi .env
├── README.md            # Readme bawaan boilerplate Vercel
├── package.json         # Informasi project, dependencies, dan scripts
├── api/
│   └── index.ts         # Endpoint Vercel: masuknya webhook Telegram (mode production)
└── src/
    ├── index.ts         # Entry utama
    ├── commands/
    │   ├── index.ts     # Export semua command
    │   ├── start.ts     # Command /start
    │   ├── status.ts    # Command /status
    │   └── realtime.ts  # Command /realtime_on dan /realtime_off
    ├── services/
    │   └── mqtt.ts      # Modul koneksi MQTT dan penyimpanan data sensor terakhir
```

---

## 3. Konfigurasi Environment (`.env`)

Sebelum menjalankan, isi file `.env` berdasarkan `.env-sample`.

Variabel penting:

```env
BOT_TOKEN="8410xxxxx:xxxxxxxx"   # Token bot Telegram dari BotFather

# Koneksi ke HiveMQ Cloud
MQTT_URL="mqtts://xxxxx.s1.eu.hivemq.cloud:8883"
MQTT_USERNAME="username_hivemq"
MQTT_PASSWORD="password_hivemq"
MQTT_TOPIC_SENSOR="/firegasmnmkel6/monitoring/sensor"
```

> **Catatan:**
>
> * `BOT_TOKEN` → wajib diisi supaya bot bisa connect ke Telegram
> * `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` → disesuaikan dengan akun HiveMQ Cloud kalian
> * `MQTT_TOPIC_SENSOR` → topik yang dipakai ESP32 saat publish data

---

## 4. `package.json` – Dependencies & Scripts

### Dependencies utama:

* **telegraf**
  Framework untuk membuat Telegram Bot.
* **mqtt**
  Library untuk koneksi ke MQTT broker (HiveMQ Cloud).
* **@vercel/node**
  Adapter agar bot bisa dijalankan di serverless Vercel.
* **dotenv-cli**
  Untuk menjalankan script dengan membaca variabel `.env`.
* **debug**
  Untuk logging (console log) dengan namespace tertentu, misal `bot:mqtt`, `bot:status_command`.

### Dev dependencies:

* **typescript**, **ts-node**, **nodemon**
  Untuk development dengan TypeScript dan auto-reload saat file berubah.
* **prettier**
  Untuk formatting code.

### Script penting:

```json
"scripts": {
  "dev": "DEBUG=bot* dotenv -- nodemon -e ts -x ts-node src/index.ts",
  "devWindows": "@powershell -Command $env:DEBUG='bot*';dotenv -- -- nodemon -e ts -x ts-node src/index.ts",
  "build": "ncc build src/index.ts -o public -m",
  "prettier": "prettier --write 'src/**/*.ts'",
  "lint": "tsc --noemit"
}
```

* `yarn dev` → menjalankan bot di mode development (polling, langsung connect ke Telegram)
* `yarn build` → membundel kode untuk Vercel (output di `public/`)

---

## 5. Modul MQTT – `src/services/mqtt.ts`

File ini mengurus **koneksi ke MQTT broker** dan **menyimpan data sensor terbaru**.

### Interface `SensorData`

```ts
export interface SensorData {
  mq2: number;
  flame: number;
  gasDanger: boolean;
  fireDetected: boolean;
  timestamp: number;
}
```

* `mq2` → nilai ADC gas
* `flame` → nilai ADC flame
* `gasDanger` → status boolean bahaya gas
* `fireDetected` → status boolean api terdeteksi
* `timestamp` → waktu (milidetik) saat data diterima di backend

### Konfigurasi dari `.env`

```ts
const MQTT_URL = process.env.MQTT_URL || '';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const MQTT_TOPIC_SENSOR =
  process.env.MQTT_TOPIC_SENSOR || '/firegasmnmkel6/monitoring/sensor';
```

### Fungsi `initMqtt()`

```ts
let client: MqttClient | null = null;
let lastSensorData: SensorData | null = null;

export const initMqtt = () => {
  if (client || !MQTT_URL) return;

  client = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  client.on('connect', () => {
    client?.subscribe(MQTT_TOPIC_SENSOR, { qos: 1 }, ...);
  });

  client.on('message', (topic, payload) => {
    if (topic !== MQTT_TOPIC_SENSOR) return;
    const json = JSON.parse(payload.toString());
    lastSensorData = {
      ...json,
      timestamp: Date.now(),
    };
  });
};
```

Tugas:

* Connect ke HiveMQ Cloud dengan username & password
* Subscribe ke topik `/firegasmnmkel6/monitoring/sensor`
* Setiap ada pesan masuk → parse JSON → simpan ke `lastSensorData`

### Fungsi `getLastSensorData()`

```ts
export const getLastSensorData = (): SensorData | null => lastSensorData;
```

Digunakan oleh command `/status` dan `/realtime_on` untuk membaca data sensor terakhir.

---

## 6. Command `/start` – `src/commands/start.ts`

Command ini adalah **salam awal** ketika user mengetik `/start`.

```ts
const start = () => async (ctx: Context) => {
  const firstName = ctx.from?.first_name ?? 'teman';

  const message =
    `Halo ${firstName}!\n\n` +
    `${name}\n${description}\n\n` +
    'Bot ini digunakan untuk memantau sensor gas dan api berbasis ESP32 dan MQTT.\n\n' +
    'Perintah yang tersedia:\n' +
    '/status - Lihat data sensor terbaru\n' +
    '/realtime_on - Nyalakan update realtime\n' +
    '/realtime_off - Matikan update realtime\n';

  await ctx.reply(message);
};
```

Penjelasan:

* `ctx.from.first_name` → untuk menyapa user berdasarkan nama depan
* Mengambil `name` dan `description` dari `package.json`
* Menjelaskan fungsi bot dan daftar perintah utama

---

## 7. Command `/status` – `src/commands/status.ts`

Command ini menampilkan **status sensor terbaru** berdasarkan data dari MQTT.

Alur:

1. Memanggil `getLastSensorData()`
2. Kalau `null` → artinya belum ada data masuk
3. Kalau ada → di-format menjadi teks yang rapi (pakai emoji)

Potongan penting:

```ts
const data = getLastSensorData();

if (!data) {
  await ctx.reply(
    '⚠️ Belum ada data sensor yang diterima dari MQTT.\n\n' +
      'Pastikan ESP32 sudah terkoneksi ke broker dan mengirim data ke topic:\n' +
      '`/firegasmnmkel6/monitoring/sensor`',
    { parse_mode: 'Markdown' }
  );
  return;
}

const gasStatus = data.gasDanger ? '🚨 *BAHAYA*' : '✅ Aman';
const fireStatus = data.fireDetected
  ? '🔥 *Api terdeteksi*'
  : '✅ Tidak terdeteksi';

const message =
  '📊 *Status Sensor Terbaru*\n\n' +
  `MQ2: *${data.mq2}* (nilai ADC)\n` +
  `Flame: *${data.flame}* (nilai ADC)\n\n` +
  `Gas: ${gasStatus}\n` +
  `Api: ${fireStatus}\n\n` +
  `Diterima pada: _${formatDate(data.timestamp)}_`;

await ctx.reply(message, { parse_mode: 'Markdown' });
```

Fungsi `formatDate` mengubah timestamp ke tanggal & jam format Indonesia (`Asia/Jakarta`).

---

## 8. Command `/realtime_on` & `/realtime_off` – `src/commands/realtime.ts`

Command ini dipakai untuk **monitoring realtime**: bot akan mengirim status sensor secara periodik.

### Variabel & Konfigurasi

```ts
const INTERVAL_MS = Number(1000);         // interval kirim pesan (ms) – di sini 1 detik
const STALE_TIMEOUT_MS = Number(INTERVAL_MS * 2); // batas data dianggap "mati"
const realtimeIntervals = new Map<number, NodeJS.Timeout>();
const staleChats = new Set<number>();
```

* `realtimeIntervals` → menyimpan timer `setInterval` per `chatId`
* `staleChats` → menyimpan chat yang sementara dianggap “pause” karena data sensor berhenti

### `/realtime_on`

* Mengecek apakah chat ini sudah aktif realtime
* Kalau belum:

  * memberi informasi ke user
  * membuat `setInterval` yang setiap `INTERVAL_MS` detik:

    * baca `getLastSensorData()`
    * cek apakah data **fresh** atau sudah **stale**
    * kalau fresh → kirim status sensor
    * kalau stale → kirim pesan “pause” sekali lalu berhenti mengirim sampai data baru muncul lagi

Logika utama di interval:

* Kalau **belum ada data sama sekali** → skip (tidak kirim apa-apa)
* Kalau `now - latest.timestamp > STALE_TIMEOUT_MS` → data dianggap **berhenti**
* Kalau sebelumnya stale tapi sekarang data sudah fresh lagi → kirim pesan “data aktif kembali” dan lanjut kirim status

### `/realtime_off`

* Mencari timer di `realtimeIntervals` berdasarkan `chatId`
* Jika ada:

  * `clearInterval`
  * menghapus dari map & dari `staleChats`
  * mengirim pesan: `Realtime monitoring DIMATIKAN`

---

## 9. Entry Bot & Mode Running

### 9.1 `src/index.ts`

File ini adalah entry yang dipakai oleh script `yarn dev`:

```ts
import { Telegraf, Context } from 'telegraf';
import type { Update } from 'telegraf/types';
import createDebug from 'debug';

import { start, status, realtimeOff, realtimeOn } from './commands';
import { initMqtt } from './services/mqtt';

const debug = createDebug('bot:dev');
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const bot = new Telegraf(BOT_TOKEN);

initMqtt();

bot.start(start());
bot.command('status', status());
// (lanjutan: binding /realtime_on dan /realtime_off, lalu startbot(bot))
```

Lalu ada fungsi `startbot` yang:

* memanggil `bot.telegram.getMe()` untuk mendapatkan username bot
* memulai polling dengan `bot.launch()`
* handle sinyal `SIGINT` dan `SIGTERM` untuk stop bot dengan rapi

---

## 10. Alur Kerja Lengkap (End-to-End)

1. **ESP32** membaca sensor MQ2 & flame → bentuk JSON seperti:

   ```json
   {"mq2":445,"flame":1383,"gasDanger":false,"fireDetected":true}
   ```
2. ESP32 publish JSON itu ke MQTT topik:
   `/firegasmnmkel6/monitoring/sensor`
3. Backend (Node.js) sudah menjalankan `initMqtt()`:

   * connect ke HiveMQ Cloud
   * subscribe ke topik tersebut
4. Saat ada pesan:

   * `mqtt.ts` parse payload → simpan ke `lastSensorData`
5. User di Telegram:

   * `/status` → baca `lastSensorData` → kirim status sekali
   * `/realtime_on` → buat interval per chat → kirim status berkala
   * `/realtime_off` → berhenti kirim status

---

## 11. Cara Menjalankan Bot

1. Isi `.env`

2. Install dependencies:

   ```bash
   npm install
   ```

3. Jalankan bot:

   ```bash
   npm run dev
   ```

4. Buka Telegram → chat ke bot → coba:

   * `/start`
   * `/status`
   * `/realtime_on`
   * `/realtime_off`

---

## 12. Catatan untuk Anggota Kelompok

* Kalau kamu ingin paham alurnya, fokus baca:

  * `src/services/mqtt.ts` → dari MQTT ke `lastSensorData`
  * `src/commands/status.ts` → cara baca dan menampilkan data
  * `src/commands/realtime.ts` → cara kirim realtime dan logika pause kalau data mati
  * `src/index.ts` → bagaimana bot diinisialisasi dan command didaftarkan
* Kalau mau menambah fitur baru, cukup:

  1. Buat file baru di `src/commands/`
  2. Export dari `src/commands/index.ts`
  3. Daftarkan `bot.command('nama_command', handler())` di entry (`index.ts`)

---