import logger from 'spotlight-json-logger';
import LightstreamMonitorClient from 'ls-monitor-client';
import fs from 'fs-extra';
import raven from 'raven';

import handleSingleFile from './handlers/singleFile';
import handleGroup from './handlers/group';
import emitToNextPlugin from './emitToNextPlugin';
import findIndexOfPlugin from './findIndexOfPlugin';
import parseMessage from './parseMessage';
import getMinioURL from './minio/getMinioURL';

const lsMonitorClient = new LightstreamMonitorClient({
  baseUri: process.env.MONITOR_URL,
});

export default async function safelyHandleMessage(cChannel, pChannel, pluginName, msg) {
  let message = null;

  try {
    message = parseMessage(msg);
  } catch (e) {
    logger.error('Unable to parse message!');
    console.error(e);

    raven.captureException(e);

    return cChannel.reject(msg, false);
  }

  const { nmo } = message;

  if (!nmo) {
    logger.error('RabbitMQ received a message with no NMO');

    raven.captureMessage('RabbitMQ received a message with no NMO');

    return cChannel.reject(msg, false);
  }

  const jobID = nmo.job.job_id;
  const taskID = nmo.task.task_id;
  const workflow = nmo.job.workflow;
  const isGroup = (nmo.source.misc && nmo.source.misc.isGroup);

  const currentPluginIndex = findIndexOfPlugin(workflow, pluginName);

  if (workflow[currentPluginIndex].env) {
    Object.keys(workflow[currentPluginIndex].env).forEach((k) => {
      process.env[k] = workflow[currentPluginIndex].env[k];
    });
  }

  let output;

  let rejectMessage = false;

  const monitorPayload = {
    p: pluginName,
    t: Math.round((new Date()).getTime()),
  };

  if (!isGroup) {
    const jsonld = message.jsonld;

    let url;

    try {
      url = await getMinioURL(nmo);
    } catch (e) {
      if (e.code !== 'NotFound') {
        logger.error(`Error with Minio for ${taskID}... nacking`);
        console.error(e);

        return cChannel.nack(msg);
      }
    }

    try {
      output = await handleSingleFile(nmo, jsonld, url);
    } catch (e) {
      if (e.code !== 3767) {
        logger.error(`Error with handler for ${pluginName}`);
        console.error(e);

        output = {
          nmo,
          jsonld,
        };

        monitorPayload.e = e.message;
      } else {
        rejectMessage = true;
      }
    }
  } else {
    try {
      const addToMisc = await handleGroup(nmo);

      if (addToMisc) {
        nmo.source.misc = Object.assign(nmo.source.misc, addToMisc);
      }
    } catch (e) {
      if (e.code !== 3767) {
        logger.error(`Error with group handler for ${pluginName}`);
        console.error(e);

        monitorPayload.e = e.message;
      } else {
        rejectMessage = true;
      }
    }

    output = {
      nmo,
    };

    try {
      await fs.remove('/caches/jsonlds');
      await fs.remove('/caches/cache.tar.gz');
    } catch (e) {
      logger.error('Error removing caches, continuing anyway...');
      console.error(e);

      raven.captureException(e);
    }
  }

  nmo.job.workflow[currentPluginIndex].completed = true;

  try {
    await lsMonitorClient.setTaskStatus(jobID, taskID, monitorPayload);
  } catch (e) {
    logger.error('Error sending status to Lightstream Monitor.');
    console.error(e);

    raven.captureException(e);
  }

  if (rejectMessage) return cChannel.reject(msg, false);

  const nextPluginIndex = currentPluginIndex + 1;

  if (!workflow[nextPluginIndex]) return cChannel.ack(msg);

  const nextPlugin = workflow[nextPluginIndex].config.name;

  try {
    await emitToNextPlugin(pChannel, nextPlugin, output);

    return cChannel.ack(msg);
  } catch (e) {
    logger.error('Error sending to next plugin.');

    raven.captureException(e);

    if (process.env.DEBUG) console.error(e);

    return cChannel.nack(msg);
  }
}
