const Minio = require('minio');

const defaultExpiry = (24 * 60 * 60);

const getMinioClient = () => {
  const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_HOST,
    port: parseInt(process.env.MINIO_PORT, 10),
    region: process.env.MINIO_REGION || 'us-east1',
    secure: (process.env.MINIO_SCHEME === 'https'),
    accessKey: process.env.MINIO_ACCESS,
    secretKey: process.env.MINIO_SECRET,
  });

  return minioClient;
};

module.exports = {
  uploadFileUsingMinio(bucketName, newFileName, localFileLocation) {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      minioClient.fPutObject(bucketName, newFileName, localFileLocation, 'application/octet-stream', (err, etag) => {
        if (err) return reject(err);

        return resolve(etag);
      });
    });
  },
  downloadFileUsingMinio(bucketName, objectName) {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      minioClient.getObject(bucketName, objectName, (err, stream) => {
        if (err) {
          return reject(err);
        }

        const bufferChunks = [];

        stream.on('data', bufferChunks.push);

        stream.on('error', reject);

        return stream.on('end', () =>
          resolve(Buffer.concat(bufferChunks)),
        );
      });
    });
  },
  createMinioBucket(bucketName) {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      minioClient.makeBucket(bucketName, 'us-east-1', (err) => {
        if (err) return reject(err);

        return resolve();
      });
    });
  },
  removeMinioBucket(bucketName) {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      minioClient.removeBucket(bucketName, (err) => {
        if (err) return reject(err);

        return resolve();
      });
    });
  },
  generatePresignedURL(bucketName, objectName, expiryInSeconds, cb) {
    const minioClient = getMinioClient();

    if (cb) return minioClient.presignedPutObject(bucketName, objectName, expiryInSeconds, cb);

    return new Promise((resolve, reject) => {
      minioClient.presignedPutObject(bucketName, objectName, expiryInSeconds, (err, url) => {
        if (err) return reject(err);

        return resolve(url);
      });
    });
  },

  generatePresignedGetURL(bucketName, objectName, expiryInSeconds = defaultExpiry, cb) {
    const minioClient = getMinioClient();

    if (cb) return minioClient.presignedGetObject(bucketName, objectName, expiryInSeconds, cb);

    return new Promise((resolve, reject) => {
      minioClient.presignedGetObject(bucketName, objectName, expiryInSeconds, (err, url) => {
        if (err) return reject(err);

        return resolve(url);
      });
    });
  },
  checkBucket(bucketName, cb) {
    const minioClient = getMinioClient();

    if (cb) return minioClient.bucketExists(bucketName, cb);

    return new Promise((resolve, reject) => {
      minioClient.bucketExists(bucketName, (err) => {
        if (err) {
          if (err.code === 'NoSuchBucket') {
            return resolve(false);
          }
          return reject(err);
        }

        return resolve(true);
      });
    });
  },
  objectExists(bucketName, objectName) {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      minioClient.statObject(bucketName, objectName, (err) => {
        if (err) {
          if (err.code === 'NoSuchBucket' || err.code === 'NotFound') return resolve(false);

          return reject(err);
        }

        return resolve(true);
      });
    });
  },
  listBuckets() {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      minioClient.listBuckets((err, buckets) => {
        if (err) return reject(err);

        return resolve(buckets);
      });
    });
  },
  listObjects(bucketName) {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      const objects = [];
      const stream = minioClient.listObjects(bucketName, '', true);

      stream.on('data', (obj) => {
        objects.push(obj);
      });

      stream.on('end', () => {
        resolve(objects);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  },
  removeFile(bucketName, fileName) {
    return new Promise((resolve, reject) => {
      const minioClient = getMinioClient();

      minioClient.removeObject(bucketName, fileName, (err) => {
        if (err) return reject(err);

        return resolve();
      });
    });
  },
};
