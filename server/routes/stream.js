/*
 * stream.js — media streaming proxy with range request support.
 * streams plex media part files so the browser's <video> element can
 * play and seek directly, with the token kept server-side.
 */

import { Router } from 'express';
import axios from 'axios';
import config from '../config.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    let { key } = req.query;
    if (!key) {
      return res.status(400).json({ error: 'missing_key', message: 'key query parameter is required' });
    }

    // safety: strip any token from the key and require a plex-relative path
    key = key.replace(/[?&]X-Plex-Token=[^&]*/gi, '');
    if (!key.startsWith('/')) {
      return res.status(400).json({ error: 'bad_key', message: 'key must be a plex-relative path' });
    }

    const headers = {
      'X-Plex-Token': config.plexToken,
    };
    // forward the range header so seeking works
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const upstream = await axios.get(`${config.plexServerUrl}${key}`, {
      headers,
      responseType: 'stream',
      // media requests can run for the length of the playback session
      timeout: 0,
      validateStatus: (s) => s < 500,
    });

    // pass through status (200 or 206 partial content) and media headers
    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      if (upstream.headers[h]) res.set(h, upstream.headers[h]);
    }
    if (!upstream.headers['accept-ranges']) {
      res.set('Accept-Ranges', 'bytes');
    }

    upstream.data.pipe(res);

    // stop pulling from plex if the client disconnects (e.g. seeking)
    res.on('close', () => {
      upstream.data.destroy();
    });
  } catch (err) {
    next(err);
  }
});

export default router;
