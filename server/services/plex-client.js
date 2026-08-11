/*
 * plex-client.js — configured axios instance for communicating with the plex server.
 * always sends the token and requests json.
 */

import axios from 'axios';
import config from '../config.js';

const plexClient = axios.create({
  baseURL: config.plexServerUrl,
  timeout: 15000,
  headers: {
    'X-Plex-Token': config.plexToken,
    'Accept': 'application/json',
    // identify as a client so plex tracks watch sessions from the store
    'X-Plex-Client-Identifier': 'hollywodplex',
    'X-Plex-Product': 'hollywodplex',
    'X-Plex-Device-Name': 'hollywodplex store',
  },
});

// response interceptor: check for plex-level errors encoded in the json body
plexClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      // plex sometimes returns xml errors even when we asked for json
      const message =
        typeof data === 'string'
          ? data.slice(0, 300)
          : data?.errors?.[0]?.message || `plex returned status ${status}`;

      const err = new Error(message);
      err.status = status;
      return Promise.reject(err);
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      const err = new Error('plex server is unreachable');
      err.status = 502;
      return Promise.reject(err);
    }
    return Promise.reject(error);
  },
);

export default plexClient;
