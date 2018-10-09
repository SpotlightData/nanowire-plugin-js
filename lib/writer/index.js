import fs from 'fs-extra';
import raven from 'raven';

import minio from '../vendor/minio-manager';

import elasticsearchConfig from '../../config/elasticsearch';

import getCurrentDateStamp from '../helpers/utils/getCurrentDateStamp';
import checkEnvExistence from '../helpers/utils/checkEnvExistence';

export default class Writer {
  constructor(metadata) {
    [
      'MINIO_SCHEME',
      'MINIO_HOST',
      'MINIO_PORT',
      'MINIO_ACCESS',
      'MINIO_SECRET',
      'MINIO_BUCKET',
    ].map(checkEnvExistence);

    this.metadata = metadata;
    this.pluginName = process.env.PLUGIN_ID;

    const taskId = this.metadata.task._id;

    this.taskWriteStream = fs.createWriteStream(`${__dirname}/../../task-${taskId}`, { flags: 'a' });

    this.writeGroupOutput = this.writeGroupOutput.bind(this);
    this.appendTaskOutput = this.appendTaskOutput.bind(this);
  }

  writeGroupOutput(groupOutput) {
    return new Promise((resolve, reject) => {
      const taskId = this.metadata.task._id;

      let data = JSON.stringify({
        update: {
          _id: taskId,
          _type: elasticsearchConfig.ES_GROUP_TYPE_GROUP,
          _index: elasticsearchConfig.ES_GROUP_INDEX,
        },
      });

      data += '\n';

      data += JSON.stringify({
        doc: {
          meta: {
            userId: this.metadata.user._id,
            projectId: this.metadata.project._id,
            jobId: this.metadata.job._id,
            taskId: this.metadata.task._id,
            storedAt: getCurrentDateStamp(),
          },
          jsonLD: {
            '@type': 'NaturalLanguageProcessing',
            naturalLanguageProcessing: groupOutput,
          },
        },
        doc_as_upsert: true,
      });

      data += '\n';

      fs.writeFile(`${__dirname}/../../group-${taskId}`, data, (err) => {
        if (err) {
          raven.captureException(err);

          return reject(err);
        }

        return resolve();
      });
    });
  }

  appendTaskOutput(taskOutput) {
    const taskId = this.metadata.task._id;

    let data = JSON.stringify({
      update: {
        _id: `${taskOutput['@id']}:${taskId}`,
        _type: elasticsearchConfig.ES_GROUP_TYPE_TASK,
        _index: elasticsearchConfig.ES_GROUP_INDEX,
        _parent: taskId,
      },
    });

    data += '\n';

    data += JSON.stringify({
      doc: taskOutput,
      doc_as_upsert: true,
    });

    data += '\n';

    this.taskWriteStream.write(data);
  }

  // Returns the misc object to update
  // {
  //   "storePayloads": ["t-1/group/previous-plugin.bin","t-1/group/current-plugin.bin"] 
  // }
  async store() {
    const bucket = process.env.MINIO_BUCKET;
    const jobId = this.metadata.job._id;
    const taskId = this.metadata.task._id;

    let storePayloads = [];

    if (this.metadata.task.metadata) {
      if (this.metadata.task.metadata.storePayloads) {
        storePayloads = this.metadata.task.metadata.storePayloads;
      }
    }

    this.taskWriteStream.end();

    const storePromise = new Promise((resolve, reject) => {
      const groupWriteStream = fs.createWriteStream(`${__dirname}/../../group-${taskId}`, { flags: 'a' });
      const taskReadStream = fs.createReadStream(`${__dirname}/../../task-${taskId}`);

      groupWriteStream.on('close', () => {
        minio.uploadFileUsingMinio(bucket, `${jobId}/${taskId}/group/${this.pluginName}.bin`, `${__dirname}/../../group-${taskId}`)
        .then(() => resolve(`${jobId}/${taskId}/group/${this.pluginName}.bin`))
        .catch(reject);
      });

      groupWriteStream.on('error', reject);

      taskReadStream.pipe(groupWriteStream);
    });

    try {
      const payloadLocation = await storePromise;

      storePayloads.push(payloadLocation);

      await fs.remove(`${__dirname}/../../group-${taskId}`);
      await fs.remove(`${__dirname}/../../task-${taskId}`);

      return {
        storePayloads,
      };
    } catch (e) {
      throw e;
    }
  }
}
