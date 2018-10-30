/* eslint-disable no-undef-init */

import logger from '@spotlightdata/node-logger';
import raven from 'raven';
import rp from 'request-promise-native';
import fs from 'fs-extra';

import checkEnvExistence from './helpers/utils/checkEnvExistence';
import sleep from './helpers/utils/sleep';

import downloadAndExtractCache from './helpers/caches/downloadAndExtractCache';

import Writer from './writer';

export default class SpotlightPipeline {
  constructor(params) {
    ['CONTROLLER_BASE_URI', 'POD_NAME', 'PLUGIN_ID'].map(checkEnvExistence);

    if (!params) throw new Error('Please supply a params object.');

    if (!params.taskHandler && !params.groupHandler) {
      throw new Error('Please supply a taskHandler or a groupHandler function.');
    }

    this.taskHandler = params.taskHandler;
    this.groupHandler = params.groupHandler;

    raven
      .config(process.env.SENTRY_DSN || false, {
        tags: { pluginName: params.pluginName },
        captureUnhandledRejections: true,
      })
      .install();

    this.pluginId = process.env.PLUGIN_ID;
    this.podName = process.env.POD_NAME;

    // Remove trailing slashes from base uri
    this.controllerBaseURI = process.env.CONTROLLER_BASE_URI.replace(/\/+$/, '');

    this.getTaskURI = `${this.controllerBaseURI}/v1/tasks`;
    this.getTaskURI += `?pluginId=${this.pluginId}`;
    this.getTaskURI += `&pluginInstance=${this.podName}`;

    this.task = false;
  }

  start() {
    this.processTask();

    return true;
  }

  async processTask() {
    let task = undefined;

    try {
      task = await this._getTask();
    } catch (e) {
      task = false;
    }

    if (!task) {
      await sleep(1000);

      this.processTask();

      return false;
    }

    this.task = task;

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
      logger.error('Error occurred handling task: ' + e.message);
    }

    this.processTask();

    return true;
  }

  async _getTask() {
    try {
      const task = await rp({
        method: 'GET',
        uri: this.getTaskURI,
        json: true,
      });

      return task;
    } catch (e) {
      if (e.statusCode === 404) {
        return false;
      }

      logger.error('Error fetching task: ' + e.message);
      raven.captureException(e);

      if (process.env.DEBUG) console.error(e);

      throw e;
    }
  }

  async _handleGroup() {
    const { cacheURL } = this.task.metadata.task.metadata;

    let cachePath = false;

    if (cacheURL) {
      try {
        cachePath = await downloadAndExtractCache(cacheURL);
      } catch (e) {
        logger.error('Unknown error downloading cache...');
        raven.captureException(e);

        if (process.env.DEBUG) console.error(e);

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
      logger.error('Error occurred in groupHandler function.');
      raven.captureException(e);

      if (process.env.DEBUG) console.error(e);

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
      logger.error('Error removing caches, continuing anyway...');
      console.error(e);

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
      logger.error('Error occurred in taskHandler function.');
      raven.captureException(e);

      if (process.env.DEBUG) console.error(e);

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
    try {
      const taskId = this.task.metadata.task._id;

      await rp({
        method: 'PUT',
        uri: `${this.controllerBaseURI}/v1/tasks/${taskId}`,
        json: true,
        body: payload,
      });

      return true;
    } catch (e) {
      logger.error('Unknown error occurred publishing results.');
      raven.captureException(e);

      if (process.env.DEBUG) console.error(e);

      throw e;
    }
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
