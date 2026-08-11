/*
 * config.js — read and validate environment configuration.
 */

import 'dotenv/config';

const config = {
  port: parseInt(process.env.PORT, 10) || 3478,
  plexServerUrl: (process.env.PLEX_SERVER_URL || '').replace(/\/+$/, ''),
  plexToken: process.env.PLEX_TOKEN || '',
};

if (!config.plexServerUrl) {
  console.error('PLEX_SERVER_URL is required. set it in .env');
  process.exit(1);
}

if (!config.plexToken || config.plexToken === 'your-plex-token-here') {
  console.error('PLEX_TOKEN is required. set it in .env');
  process.exit(1);
}

export default config;
