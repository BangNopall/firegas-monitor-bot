import { Context } from 'telegraf';
import createDebug from 'debug';

import { name, description } from '../../package.json';

const debug = createDebug('bot:start_command');

const start = () => async (ctx: Context) => {
  const firstName = ctx.from?.first_name ?? 'teman';

  const message =
    `Halo ${firstName}!\n\n` +
    `${name}\n${description}\n\n` +
    'Bot ini digunakan untuk memantau sensor gas dan api berbasis ESP32 dan MQTT.\n\n' +
    'Perintah yang tersedia:\n' +
    '/status - Lihat data sensor terbaru\n' +
    '/realtime_on - Nyalakan update realtime\n' +
    '/realtime_on test - Nyalakan update realtime dengan dummy data\n' +
    '/realtime_off - Matikan update realtime\n';

  debug(`Triggered "start" command for user ${ctx.from?.id}`);
  await ctx.reply(message);
};

export { start };
