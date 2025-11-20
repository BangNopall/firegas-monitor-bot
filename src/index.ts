import { Telegraf } from 'telegraf';

import { start, status, realtimeOff, realtimeOn } from './commands';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import { initMqtt } from './services/mqtt';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

const bot = new Telegraf(BOT_TOKEN);

initMqtt();

bot.start(start());
bot.command('status', status());
bot.command('realtime_on', realtimeOn());
bot.command('realtime_off', realtimeOff());

//production mode
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};
//development mode
ENVIRONMENT !== 'production' && development(bot);
