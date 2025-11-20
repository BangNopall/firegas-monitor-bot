import { Context } from 'telegraf';
import createDebug from 'debug';
import { getLastSensorData } from '../services/mqtt';

const debug = createDebug('bot:realtime_command');

const INTERVAL_MS = Number(1000);
const STALE_TIMEOUT_MS = Number(INTERVAL_MS * 2);
const realtimeIntervals = new Map<number, NodeJS.Timeout>();
const staleChats = new Set<number>();

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
  });
};

export const realtimeOn = () => async (ctx: Context) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  debug(`realtime_on requested by chat ${chatId}`);

  if (realtimeIntervals.has(chatId)) {
    await ctx.reply(
      `ℹ️ Realtime monitoring sudah AKTIF untuk chat ini.\n` +
        `Gunakan /realtime_off untuk mematikannya.`,
    );
    return;
  }

  staleChats.delete(chatId);

  const data = getLastSensorData();

  if (!data) {
    await ctx.reply(
      '✅ Realtime monitoring Diaktifkan.\n' +
        '⚠️ Belum ada data sensor yang diterima dari MQTT.\n\n' +
        'Realtime akan diaktifkan, dan akan mengirim data ketika sensor mulai mengirim ke broker.',
    );
  } else {
    await ctx.reply(
      '✅ Realtime monitoring Diaktifkan.\n' +
        `Interval: setiap ${INTERVAL_MS / 1000} detik.\n` +
        `Jika data sensor berhenti, bot akan pause kirim status dan akan otomatis lanjut lagi saat data kembali.`,
    );
  }

  const timer = setInterval(async () => {
    const latest = getLastSensorData();
    if (!latest) {
      debug('No sensor data yet, skip send for chat: %s', chatId);
      return;
    }

    const now = Date.now();
    const age = now - latest.timestamp;

    if (age > STALE_TIMEOUT_MS) {
      if (!staleChats.has(chatId)) {
        staleChats.add(chatId);

        debug(
          'Sensor data is stale for chat %s (age=%d ms), pausing realtime messages',
          chatId,
          age,
        );

        try {
          await ctx.telegram.sendMessage(
            chatId,
            '⏸ Realtime monitoring *pause*.\n' +
              `Tidak ada data baru dari sensor lebih dari ${Math.round(
                STALE_TIMEOUT_MS / 1000,
              )} detik.\n\n` +
              'Bot akan otomatis melanjutkan kirim status ketika data sensor kembali.',
          );
        } catch (err) {
          debug('Failed to send stale warning to %s: %O', chatId, err);
        }
      }
      return;
    }
    if (staleChats.has(chatId)) {
      staleChats.delete(chatId);

      try {
        await ctx.telegram.sendMessage(
          chatId,
          '▶️ Data sensor sudah *aktif kembali*.\n' +
            'Bot akan melanjutkan kirim status realtime.',
        );
      } catch (err) {
        debug('Failed to send resume message to %s: %O', chatId, err);
      }
    }

    const gasStatus = latest.gasDanger ? '🚨 *BAHAYA*' : '✅ Aman';
    const fireStatus = latest.fireDetected
      ? '🔥 *Api terdeteksi*'
      : '✅ Tidak terdeteksi';

    const message =
      '📡 *Realtime Status Sensor*\n\n' +
      `MQ2: *${latest.mq2}* (nilai ADC)\n` +
      `Flame: *${latest.flame}* (nilai ADC)\n\n` +
      `Gas: ${gasStatus}\n` +
      `Api: ${fireStatus}\n\n` +
      `Diterima pada: _${formatDate(latest.timestamp)}_`;

    try {
      await ctx.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });
    } catch (err) {
      debug('Failed to send realtime message to %s: %O', chatId, err);
    }
  }, INTERVAL_MS);

  realtimeIntervals.set(chatId, timer);
};

export const realtimeOff = () => async (ctx: Context) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  debug(`realtime_off requested by chat ${chatId}`);

  const timer = realtimeIntervals.get(chatId);
  if (!timer) {
    await ctx.reply('ℹ️ Realtime monitoring belum aktif untuk chat ini.');
    return;
  }

  clearInterval(timer);
  realtimeIntervals.delete(chatId);
  staleChats.delete(chatId);

  await ctx.reply('🛑 Realtime monitoring DIMATIKAN untuk chat ini.');
};
