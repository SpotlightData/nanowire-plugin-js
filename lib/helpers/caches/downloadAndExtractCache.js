import request from 'request';
import tar from 'tar';
import fs from 'fs-extra';

const downloadAndExtractCache = async (url) => {
  try {
    if (!fs.existsSync('/caches')) {
      fs.mkdirSync('/caches');
    }

    const downloadP = new Promise((resolve, reject) => {
      request
      .get(url)
      .on('error', err => reject(err))
      .pipe(fs.createWriteStream('/caches/cache.tar.gz'))
      .on('finish', () => resolve());
    });

    await downloadP;

    await tar.x(
      {
        file: '/caches/cache.tar.gz',
        C: '/caches',
        preservePaths: true,
      },
    );

    return '/caches/jsonlds';
  } catch (e) {
    throw e;
  }
};

export default downloadAndExtractCache;
