/*
 * index.js — express application entry point.
 * serves the frontend and mounts api proxy routes.
 */

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import config from './config.js';
import plexRoutes from './routes/plex.js';
import imageRoutes from './routes/image.js';
import streamRoutes from './routes/stream.js';
import matchRoutes from './routes/match.js';
import recommendationRoutes from './routes/recommendations.js';
import errorHandler from './middleware/error-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

const app = express();

// serve static frontend files
app.use(express.static(publicDir));

// api routes
app.get('/api/config', async (_req, res, next) => {
  try {
    // import plex-client lazily to avoid circular dependency with config
    const { default: plexClient } = await import('./services/plex-client.js');
    const { data } = await plexClient.get('/library/sections');
    const sections = (data.MediaContainer?.Directory || []).map(s => ({
      key: s.key,
      title: s.title,
      type: s.type,
    }));

    // fetch the server machine identifier for building plex web deep links
    let machineIdentifier = null;
    try {
      const identity = await plexClient.get('/identity');
      machineIdentifier = identity.data.MediaContainer?.machineIdentifier || null;
    } catch {
      // deep links will fall back to the app.plex.tv search page
    }

    res.json({
      sections,
      machineIdentifier,
      plexServerUrl: config.plexServerUrl,
      maxTextureDimension: 512,
      concurrentLoads: 4,
      shelfColumns: 6,
    });
  } catch (err) {
    next(err);
  }
});

app.use('/api/plex/matches', matchRoutes);
app.use('/api/plex', plexRoutes);
app.use('/image', imageRoutes);
app.use('/stream', streamRoutes);
app.use('/api/recommendations', recommendationRoutes);

// error handling
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`hollywodplex running at http://localhost:${config.port}`);
  console.log(`plex server: ${config.plexServerUrl}`);
});
