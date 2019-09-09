import request from 'request';
import tar from 'tar';
import fs from 'fs-extra';

const downloadAndExtractCache = async url => {
  try {
    if (!fs.existsSync(process.env.CACHES_PATH)) {
      fs.mkdirSync(process.env.CACHES_PATH);
    }

    const downloadP = new Promise((resolve, reject) => {
      request
        .get(url)
        .on('error', err => reject(err))
        .pipe(fs.createWriteStream(`${process.env.CACHES_PATH}/cache.tar.gz`))
        .on('finish', () => resolve());
    });

    await downloadP;

    await tar.x({
      file: `${process.env.CACHES_PATH}/cache.tar.gz`,
      C: process.env.CACHES_PATH,
      preservePaths: true,
    });

    return `${process.env.CACHES_PATH}/jsonlds`;
  } catch (e) {
    throw e;
  }
};

export default downloadAndExtractCache;
