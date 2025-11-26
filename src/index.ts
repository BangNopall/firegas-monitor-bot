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
bot.command('realtime_on', realtimeOn());
bot.command('realtime_off', realtimeOff());

const startbot = async (bot: Telegraf<Context<Update>>) => {
  const botInfo = (await bot.telegram.getMe()).username;

  debug('Bot runs');
  debug(`${botInfo} starting bot...`);

  await bot.launch();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};


startbot(bot);
