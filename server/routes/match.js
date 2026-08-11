/*
 * match.js — fix-match routes.
 * lets the client search plex's metadata agent for candidate matches
 * for a film (useful when a file was never matched and shows its
 * filename as the title) and apply the chosen one.
 */

import { Router } from 'express';
import plexClient from '../services/plex-client.js';
import cache from '../services/plex-cache.js';

const router = Router();

/*
 * GET /api/plex/matches/:ratingKey?title=&year=
 * search the agent for match candidates. with a title this is a manual
 * search; without one plex guesses from the filename.
 */
router.get('/:ratingKey', async (req, res, next) => {
  try {
    const { ratingKey } = req.params;
    const { title, year } = req.query;

    const params = {};
    if (title) {
      params.manual = 1;
      params.title = title;
      if (year) params.year = year;
    }

    const { data } = await plexClient.get(`/library/metadata/${ratingKey}/matches`, { params });
    const raw = data.MediaContainer?.SearchResult || [];
    const matches = (Array.isArray(raw) ? raw : [raw]).map(m => ({
      guid: m.guid,
      name: m.name,
      year: m.year ? parseInt(m.year, 10) : null,
      score: m.score != null ? Number(m.score) : null,
      summary: m.summary || null,
    })).filter(m => m.guid && m.name);

    res.json({ matches });
  } catch (err) {
    next(err);
  }
});

/*
 * POST /api/plex/matches/:ratingKey?guid=&name=
 * apply a match. plex re-pulls metadata and provider artwork, so the
 * cached metadata entry for this item is dropped to serve fresh data.
 */
router.post('/:ratingKey', async (req, res, next) => {
  try {
    const { ratingKey } = req.params;
    const { guid, name } = req.query;
    if (!guid || !name) {
      return res.status(400).json({ error: 'bad_request', message: 'guid and name query parameters are required' });
    }

    await plexClient.put(`/library/metadata/${ratingKey}/match`, null, {
      params: { guid, name },
    });

    cache.delete(cache.constructor.key('GET', `/library/metadata/${ratingKey}`));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
