import { Context } from 'telegraf';
import createDebug from 'debug';
import { getLastSensorData } from '../services/mqtt';

const debug = createDebug('bot:status_command');

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
  });
};

export const status = () => async (ctx: Context) => {
  debug(`Triggered "status" command from ${ctx.from?.id}`);

  const data = getLastSensorData();

  if (!data) {
    await ctx.reply(
      '⚠️ Belum ada data sensor yang diterima dari MQTT.\n\n' +
        'Pastikan ESP32 sudah terkoneksi ke broker dan mengirim data ke topic:\n' +
        '`/firegasmnmkel6/monitoring/sensor`',
      { parse_mode: 'Markdown' },
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
};
