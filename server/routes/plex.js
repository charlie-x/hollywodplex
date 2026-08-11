/*
 * plex.js — proxy routes for the plex api.
 * all responses are transformed from the raw plex json into a cleaner shape
 * with artwork urls rewritten to go through our image proxy.
 */

import { Router } from 'express';
import plexClient from '../services/plex-client.js';
import cache from '../services/plex-cache.js';
import { makeSearchIndex } from '../services/search-index.js';

const router = Router();
const searchIndex = makeSearchIndex(plexClient);

/*
 * rewrite a plex artwork path to go through our image proxy.
 * plex-relative paths like /library/metadata/123/thumb are converted.
 * fully-qualified https urls (e.g. actor photos from metadata-static.plex.tv)
 * are left as-is since they are publicly accessible.
 */
function rewriteArtworkUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `/image?url=${encodeURIComponent(path)}`;
}

/*
 * transform a single plex metadata object into our cleaner item shape.
 */
function transformItem(meta) {
  if (!meta) return null;

  const item = {
    ratingKey: meta.ratingKey,
    key: meta.key,
    guid: meta.guid,
    title: meta.title,
    titleSort: meta.titleSort,
    year: meta.year ? parseInt(meta.year, 10) : null,
    index: meta.index != null ? parseInt(meta.index, 10) : null,
    parentTitle: meta.parentTitle || null,
    grandparentTitle: meta.grandparentTitle || null,
    leafCount: meta.leafCount != null ? parseInt(meta.leafCount, 10) : null,
    slug: meta.slug,
    studio: meta.studio || null,
    type: meta.type,
    contentRating: meta.contentRating || null,
    summary: meta.summary || '',
    tagline: meta.tagline || '',
    rating: meta.rating ? parseFloat(meta.rating) : null,
    audienceRating: meta.audienceRating ? parseFloat(meta.audienceRating) : null,
    duration: meta.duration ? parseInt(meta.duration, 10) : null,
    originallyAvailableAt: meta.originallyAvailableAt || null,
    addedAt: meta.addedAt ? parseInt(meta.addedAt, 10) : null,
    updatedAt: meta.updatedAt ? parseInt(meta.updatedAt, 10) : null,
    viewCount: meta.viewCount ? parseInt(meta.viewCount, 10) : 0,
    viewOffset: meta.viewOffset ? parseInt(meta.viewOffset, 10) : null,
    lastViewedAt: meta.lastViewedAt ? parseInt(meta.lastViewedAt, 10) : null,
    thumb: rewriteArtworkUrl(meta.thumb),
    art: rewriteArtworkUrl(meta.art),
  };

  // extract tag arrays for genres, directors, actors, etc.
  const tagFields = ['Genre', 'Director', 'Writer', 'Producer', 'Country', 'Role', 'Collection'];
  for (const field of tagFields) {
    const raw = meta[field];
    if (!raw) continue;
    const list = Array.isArray(raw) ? raw : [raw];
    const key = field === 'Role' ? 'actors' : field.toLowerCase() + 's';
    if (field === 'Role') {
      item[key] = list.map(r => ({
        id: r.id,
        tag: r.tag,
        role: r.role || null,
        thumb: r.thumb ? rewriteArtworkUrl(r.thumb) : null,
      }));
    } else {
      item[key] = list.map(r => ({ id: r.id, tag: r.tag }));
    }
  }

  // media info
  if (meta.Media) {
    const mediaList = Array.isArray(meta.Media) ? meta.Media : [meta.Media];
    item.media = mediaList.map(m => ({
      id: m.id,
      duration: m.duration ? parseInt(m.duration, 10) : null,
      bitrate: m.bitrate ? parseInt(m.bitrate, 10) : null,
      width: m.width ? parseInt(m.width, 10) : null,
      height: m.height ? parseInt(m.height, 10) : null,
      aspectRatio: m.aspectRatio || null,
      audioChannels: m.audioChannels ? parseInt(m.audioChannels, 10) : null,
      audioCodec: m.audioCodec || null,
      videoCodec: m.videoCodec || null,
      videoResolution: m.videoResolution || null,
      container: m.container || null,
      videoFrameRate: m.videoFrameRate || null,
      Part: m.Part ? (Array.isArray(m.Part) ? m.Part : [m.Part]).map(p => ({
        id: p.id,
        key: p.key,
        duration: p.duration ? parseInt(p.duration, 10) : null,
        file: p.file || null,
        size: p.size ? parseInt(p.size, 10) : null,
      })) : [],
    }));
  }

  // extras (trailers, featurettes) — the json api nests them under Metadata
  if (meta.Extras && meta.Extras.Metadata) {
    const extrasList = Array.isArray(meta.Extras.Metadata)
      ? meta.Extras.Metadata
      : [meta.Extras.Metadata];
    item.extras = extrasList.map(transformItem).filter(Boolean);
  }

  return item;
}

/*
 * transform a plex media container response into a paged items response.
 */
function transformContainer(data) {
  const container = data.MediaContainer;
  if (!container) return { items: [], totalSize: 0, offset: 0 };

  const rawItems = container.Metadata || [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems])
    .map(transformItem)
    .filter(Boolean);

  return {
    items,
    totalSize: container.totalSize || items.length,
    offset: container.offset || 0,
    allowSync: container.allowSync,
    identifier: container.identifier,
    librarySectionID: container.librarySectionID,
    librarySectionTitle: container.librarySectionTitle,
    title1: container.title1,
    title2: container.title2,
    viewGroup: container.viewGroup,
    viewMode: container.viewMode,
  };
}

/*
 * GET /api/plex/sections
 * list all plex libraries.
 */
router.get('/sections', async (_req, res, next) => {
  try {
    const cacheKey = cache.constructor.key('GET', '/library/sections');
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await plexClient.get('/library/sections');
    const sections = (data.MediaContainer?.Directory || []).map(s => ({
      key: s.key,
      title: s.title,
      type: s.type,
      agent: s.agent || null,
      scanner: s.scanner || null,
      language: s.language || null,
      thumb: rewriteArtworkUrl(s.thumb),
      art: rewriteArtworkUrl(s.art),
      composite: rewriteArtworkUrl(s.composite),
      refreshedAt: s.refreshedAt ? parseInt(s.refreshedAt, 10) : null,
      updatedAt: s.updatedAt ? parseInt(s.updatedAt, 10) : null,
    }));

    const result = { sections };
    cache.setWithCategory(cacheKey, result, 'list');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/*
 * GET /api/plex/sections/:id/items
 * get items from a library section, with paging.
 */
router.get('/sections/:id/items', async (req, res, next) => {
  try {
    const { id } = req.params;
    const start = parseInt(req.query.start, 10) || 0;
    const size = parseInt(req.query.size, 10) || 50;
    const sort = req.query.sort || 'titleSort:asc';

    const cacheKey = cache.constructor.key('GET', `/library/sections/${id}/all?start=${start}&size=${size}&sort=${sort}`);
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await plexClient.get(`/library/sections/${id}/all`, {
      headers: {
        'X-Plex-Container-Start': String(start),
        'X-Plex-Container-Size': String(size),
      },
      params: { sort },
    });

    const result = transformContainer(data);
    cache.setWithCategory(cacheKey, result, 'list');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/*
 * GET /api/plex/metadata/:ratingKey
 * get full metadata for a single item.
 */
router.get('/metadata/:ratingKey', async (req, res, next) => {
  try {
    const { ratingKey } = req.params;

    const cacheKey = cache.constructor.key('GET', `/library/metadata/${ratingKey}`);
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await plexClient.get(`/library/metadata/${ratingKey}`, {
      params: { includeExtras: 1 },
    });
    const container = data.MediaContainer;
    if (!container || !container.Metadata) {
      return res.status(404).json({ error: 'not_found', message: 'item not found' });
    }

    const items = Array.isArray(container.Metadata) ? container.Metadata : [container.Metadata];
    const item = transformItem(items[0]);

    if (!item) {
      return res.status(404).json({ error: 'not_found', message: 'item not found' });
    }

    // include related hubs if present
    if (container.Related) {
      item.related = (container.Related.Hub || []).map(hub => ({
        hubKey: hub.hubKey,
        key: hub.key,
        title: hub.title,
        type: hub.type,
        hubIdentifier: hub.hubIdentifier,
        context: hub.context,
        size: hub.size,
        items: hub.Video ? (Array.isArray(hub.Video) ? hub.Video : [hub.Video]).map(transformItem).filter(Boolean) : [],
      }));
    }

    cache.setWithCategory(cacheKey, item, 'metadata');
    res.json(item);
  } catch (err) {
    next(err);
  }
});

/*
 * GET /api/plex/timeline
 * report playback progress to plex so watch state and resume points
 * stay in sync with the in-store player.
 * query: ratingKey, state (playing|paused|stopped), time (ms), duration (ms)
 */
router.get('/timeline', async (req, res, next) => {
  try {
    const { ratingKey, state, time, duration } = req.query;

    if (!ratingKey || !['playing', 'paused', 'stopped'].includes(state)) {
      return res.status(400).json({ error: 'bad_request', message: 'ratingKey and a valid state are required' });
    }

    await plexClient.get('/:/timeline', {
      params: {
        ratingKey,
        key: `/library/metadata/${ratingKey}`,
        state,
        time: Math.max(0, Math.floor(Number(time) || 0)),
        duration: Math.max(0, Math.floor(Number(duration) || 0)),
        identifier: 'com.plexapp.plugins.library',
        hasMDE: 0,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/*
 * GET /api/plex/posters/:ratingKey
 * list the candidate posters plex's agents can offer for an item.
 */
router.get('/posters/:ratingKey', async (req, res, next) => {
  try {
    const { ratingKey } = req.params;
    const { data } = await plexClient.get(`/library/metadata/${ratingKey}/posters`);
    const raw = data.MediaContainer?.Metadata || [];
    const posters = (Array.isArray(raw) ? raw : [raw]).map(p => ({
      // the ratingKey here is the provider url used to select this poster
      key: p.ratingKey,
      // provider previews are public https urls; local ones go via our proxy
      thumb: p.thumb && p.thumb.startsWith('http')
        ? p.thumb
        : rewriteArtworkUrl(p.thumb),
      provider: p.provider || null,
      selected: !!p.selected,
    })).filter(p => p.thumb);
    res.json({ posters });
  } catch (err) {
    next(err);
  }
});

/*
 * POST /api/plex/posters/:ratingKey?url=<provider key>
 * select one of the candidate posters for an item.
 */
router.post('/posters/:ratingKey', async (req, res, next) => {
  try {
    const { ratingKey } = req.params;
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'missing_url', message: 'url query parameter is required' });
    }
    await plexClient.post(`/library/metadata/${ratingKey}/posters`, null, {
      params: { url },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/*
 * GET /api/plex/metadata/:ratingKey/children
 * seasons of a show, or episodes of a season.
 */
router.get('/metadata/:ratingKey/children', async (req, res, next) => {
  try {
    const { ratingKey } = req.params;

    const cacheKey = cache.constructor.key('GET', `/library/metadata/${ratingKey}/children`);
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await plexClient.get(`/library/metadata/${ratingKey}/children`);
    const result = transformContainer(data);
    cache.setWithCategory(cacheKey, result, 'metadata');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/*
 * GET /api/plex/recentlyAdded
 * get recently added items across all sections.
 */
router.get('/recentlyAdded', async (req, res, next) => {
  try {
    const start = parseInt(req.query.start, 10) || 0;
    const size = parseInt(req.query.size, 10) || 20;
    const sectionId = req.query.sectionId;

    let url = '/library/recentlyAdded';
    if (sectionId) {
      url = `/library/sections/${sectionId}/recentlyAdded`;
    }

    const cacheKey = cache.constructor.key('GET', `${url}?start=${start}&size=${size}`);
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await plexClient.get(url, {
      headers: {
        'X-Plex-Container-Start': String(start),
        'X-Plex-Container-Size': String(size),
      },
    });

    const result = transformContainer(data);
    cache.setWithCategory(cacheKey, result, 'list');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/*
 * GET /api/plex/search
 * ranked search over the in-memory library index (title + director).
 * the index holds the complete library, so results are not capped by
 * plex's paging; size defaults to 100 (max 300).
 */
router.get('/search', async (req, res, next) => {
  try {
    const { query, sectionId, start: startStr, size: sizeStr } = req.query;
    const start = parseInt(startStr, 10) || 0;
    const size = Math.min(parseInt(sizeStr, 10) || 100, 300);

    if (!query || query.trim().length === 0) {
      return res.json({ items: [], totalSize: 0, offset: 0 });
    }

    // resolve which sections to search
    let sectionIds;
    if (sectionId) {
      sectionIds = [sectionId];
    } else {
      const { data } = await plexClient.get('/library/sections');
      sectionIds = (data.MediaContainer?.Directory || [])
        .filter(s => s.type === 'movie' || s.type === 'show')
        .map(s => s.key);
    }

    const result = await searchIndex.search(query, sectionIds, start, size);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
