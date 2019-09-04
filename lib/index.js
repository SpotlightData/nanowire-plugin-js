/* eslint-disable no-undef-init */

import { clog } from '@spotlightdata/node-logger';
import raven from 'raven';
import request from 'request-promise-native';
import fs from 'fs-extra';
import axios from 'axios';

import sleep from './helpers/utils/sleep';
import downloadAndExtractCache from './helpers/caches/downloadAndExtractCache';
import Writer from './writer';
import { validateEnv } from './config/environment';

const rp = request.defaults({
  headers: {
    'User-Agent': `${process.env.PLUGIN_ID}:${process.env.POD_NAME}`,
  },
});
const LONGEST_TIMEOUT = 30 * 1000;
const TIMEOUT = 2000;

export default class SpotlightPipeline {
  static exponentialTimeout(time) {
    return Math.min(time * 1.5, LONGEST_TIMEOUT);
  }

  constructor(params) {
    if (!params) throw new Error('Please supply a params object.');

    if (!params.taskHandler && !params.groupHandler) {
      throw new Error('Please supply a taskHandler or a groupHandler function.');
    }

    const { env } = process;
    validateEnv(env);

    this.initializeSentry(env.SENTRY_DSN, params.pluginName);

    this.taskHandler = params.taskHandler;
    this.groupHandler = params.groupHandler;

    this.pluginId = env.PLUGIN_ID;
    this.podName = env.POD_NAME;

    // Remove trailing slashes from base uri
    this.controllerBaseURI = process.env.CONTROLLER_BASE_URI.replace(/\/+$/, '');

    this.getTaskURI = `${this.controllerBaseURI}/v1/tasks`;
    this.getTaskURI += `?pluginId=${this.pluginId}`;
    this.getTaskURI += `&pluginInstance=${this.podName}`;

    this.task = false;
  }

  initializeSentry(dsn, pluginName) {
    if (typeof dsn !== undefined) {
      raven
        .config(dsn, {
          tags: { pluginName },
          captureUnhandledRejections: true,
        })
        .install();
    } else {
      clog.warn({ reason: 'SENTRY_INIT', message: 'Missing SENTRY_DSN, skipping raven' });
    }
  }

  async start() {
    this.processTask();

    return true;
  }

  async _getTask() {
    async function loop(timeout) {
      await sleep(timeout);
      try {
        const resp = await axios.get(this.getTaskURI);
        return resp.data;
      } catch (e) {
        if (e.code === 'ECONNREFUSED') {
          clog.warn({
            reason: 'GET_TASK',
            message: 'Controller not available, starting exponential backoff',
          });
          return loop(SpotlightPipeline.exponentialTimeout(timeout));
        } else {
          // Otherwise, just wait again
          return loop(TIMEOUT);
        }
      }
    }
    return loop(0);
  }

  async submitResults(body) {
    async function loop(timeout) {
      await sleep(timeout);
      try {
        const taskId = this.task.metadata.task._id;

        await rp({
          method: 'PUT',
          uri: `${this.controllerBaseURI}/v1/tasks/${taskId}`,
          json: true,
          body,
        });
      } catch (e) {
        if (e.code === 'ECONNREFUSED') {
          clog.warn({
            reason: 'SUBMIT_RESULTS',
            message: 'Controller not available, starting exponential backoff',
          });
          return loop(SpotlightPipeline.exponentialTimeout(timeout));
        } else {
          // Otherwise, just wait again
          return loop(TIMEOUT);
        }
      }
    }
    return loop(0);
  }

  async processTask() {
    this.task = await this._getTask();

    const {
      metadata: {
        job: {
          workflow: { type },
        },
      },
    } = task;

    try {
      if (type === 'GROUP') {
        await this._handleGroup();
      } else if (type === 'SINGLE_FILE') {
        await this._handleSingleFile();
      }
    } catch (e) {
      clog.error({ reason: 'HANDLE_TASK', message: e.message });
    }

    this.processTask();

    return true;
  }

  async addFile(buffer, identifier, metadata) {
    const uploadFileURI =
      `${this.controllerBaseURI}/v1/tasks/${this.task.metadata.task._id}/files` +
      `?pluginId=${this.pluginId}&pluginInstance=${this.podName}`;
    await rp.post({
      uri: uploadFileURI,
      method: 'POST',
      form: {
        meta: { identifier, metadata },
        file: buffer,
      },
    });
  }

  async _handleGroup() {
    const { cacheURL } = this.task.metadata.task.metadata;

    let cachePath = false;

    if (cacheURL) {
      try {
        cachePath = await downloadAndExtractCache(cacheURL);
      } catch (e) {
        clog.error({ reason: 'DOWNLOADING_CACHE', message: e.toString() });
        raven.captureException(e);

        throw e;
      }
    }

    let additionalMetadata = undefined;
    let status = 'success';
    let error = undefined;

    try {
      const result = await this.groupHandler(this.task.metadata, cachePath);

      if (result) {
        additionalMetadata = result;
      }
    } catch (e) {
      clog.error({ reason: 'HANDLE_GROUP', message: 'Error occurred in groupHandler function.' });
      raven.captureException(e);

      status = 'failure';
      error = e.message || 'An unknown error occured';
    }

    const payload = {
      pluginInstance: this.podName,
      status,
      error,
      additionalMetadata,
    };

    try {
      await fs.remove('/caches/jsonlds');
      await fs.remove('/caches/cache.tar.gz');
    } catch (e) {
      clog.error({ reason: 'REMOVING_CACHE', message: e.toString() });
      raven.captureException(e);
    }

    return this._updateResults(payload);
  }

  async _handleSingleFile() {
    let jsonld = undefined;
    let status = 'success';
    let error = undefined;

    try {
      jsonld = await this.taskHandler(this.task.metadata, this.task.jsonld, this.task.url);
    } catch (e) {
      clog.error({ reason: 'HANDLE_SINGLE_FILE', message: e.toString() });
      raven.captureException(e);

      status = 'failure';
      error = e.message || 'An unknown error occured';
    }

    const payload = {
      pluginInstance: this.podName,
      status,
      jsonld,
      error,
    };

    return this._updateResults(payload);
  }

  async _updateResults(payload) {
    this.submitResults(payload);
  }
}

export class SpotlightWriter extends Writer {}

export class NanowireError extends Error {
  constructor(type, code, ...params) {
    super(...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NanowireError);
    }

    this.type = type;
    this.code = code;
  }
}
