import logger from 'spotlight-json-logger';
import LightstreamMonitorClient from 'ls-monitor-client';
import raven from 'raven';

import sendDataToWorker from './processes/sendDataToWorker';

import handleSingleFile from './handlers/singleFile';
import emitToNextPlugin from './emitToNextPlugin';
import findIndexOfPlugin from './findIndexOfPlugin';
import parseMessage from './parseMessage';
import getMinioURL from './minio/getMinioURL';

const lsMonitorClient = new LightstreamMonitorClient({
  baseUri: process.env.MONITOR_URL,
});

export default async function safelyHandleMessages(cChannel, pChannel, pluginName, messages) {
  const messageState = {};

  await Promise.all(messages.map(async (msg) => {
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

    const taskID = nmo.task.task_id;

    let url = null;

    try {
      url = await getMinioURL(nmo);
    } catch (e) {
      if (e.code !== 'NotFound') {
        logger.error(`Error with Minio for ${taskID}... nacking`);
        console.error(e);

        return cChannel.nack(msg);
      }
    }

    messageState[taskID] = {
      nmo,
      jsonld: message.jsonld,
      url,
      error: null,
      action: '',
      _msg: msg,
    };

    return true;
  }, {}));

  let processedMessageState = null;
  let endMessages = false;
  let processingError = false;

  try {
    processedMessageState = await sendDataToWorker(
      1337,
      [(Object.values(messageState).map(message => ({
        nmo: message.nmo,
        jsonld: message.jsonld,
        url: message.url,
        error: message.error,
        action: message.action,
      })))],
    );
  } catch (e) {
    if (e.code !== 3767) {
      logger.error(`Error with handler for ${pluginName}`);
      console.error(e);

      processingError = e.message;
      processedMessageState = Object.values(messageState);
    } else {
      endMessages = true;
    }
  }

  return Promise.all(processedMessageState.map(async (processedMessage) => {
    const { nmo, jsonld, error, action } = processedMessage;
    const message = messageState[nmo.task.task_id];

    if (processingError) {
      message.error = processingError;
      message.action = 'ack';
    } else if (endMessages) {
      message.action = 'reject';
    } else {
      message.action = action;
      message.error = error;
    }

    const jobID = nmo.job.job_id;
    const taskID = nmo.task.task_id;
    const workflow = nmo.job.workflow;

    const currentPluginIndex = findIndexOfPlugin(workflow, pluginName);

    if (workflow[currentPluginIndex].env) {
      Object.keys(workflow[currentPluginIndex].env).forEach((k) => {
        process.env[k] = workflow[currentPluginIndex].env[k];
      });
    }

    nmo.job.workflow[currentPluginIndex].completed = true;

    const nextBody = {
      nmo,
      jsonld,
    };

    const monitorPayload = {
      p: pluginName,
      t: Math.round((new Date()).getTime()),
    };

    if (message.error) {
      nextBody.jsonld = message.jsonld;
      monitorPayload.e = message.error;
    }

    try {
      await lsMonitorClient.setTaskStatus(jobID, taskID, monitorPayload);
    } catch (e) {
      logger.error(`Error sending status to Lightstream Monitor for ${taskID}`);
      console.error(e);

      raven.captureException(e);
    }

    switch (message.action) {
      case 'reject': {
        await cChannel.reject(message._msg, false);

        break;
      }

      case 'ack': {
        try {
          const nextPluginIndex = currentPluginIndex + 1;

          if (!workflow[nextPluginIndex]) return cChannel.ack(message._msg);

          const nextPlugin = workflow[nextPluginIndex].config.name;

          await emitToNextPlugin(pChannel, nextPlugin, nextBody);

          await cChannel.ack(message._msg);

          break;
        } catch (e) {
          logger.error('Error sending to next plugin.');

          raven.captureException(e);

          if (process.env.DEBUG) console.error(e);
        }
        // falls through
      }

      default: {
        await cChannel.nack(message._msg);
      }
    }

    return true;
  }));
}
