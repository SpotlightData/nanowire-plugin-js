jest.mock('fs-extra');
jest.mock('tar');

const fs = require('fs-extra');
const tar = require('tar');
const request = require('request');

const onFinish = jest.fn((a, cb) => cb());

request.get = jest.fn(() => ({
  on: jest.fn(() => ({
    pipe: jest.fn(() => ({
      on: onFinish,
    })),
  })),
}));

const downloadAndExtractCache = require('./downloadAndExtractCache').default;

describe('downloadAndExtractCache', () => {
  it('should download and extract a cache from a URL', async () => {
    const result = await downloadAndExtractCache('http://fake.url');

    expect(request.get).toBeCalledWith('http://fake.url');
    expect(fs.createWriteStream).toBeCalledWith('/caches/cache.tar.gz');

    expect(tar.x).toBeCalledWith(
      {
        file: '/caches/cache.tar.gz',
        C: '/caches',
        preservePaths: true,
      },
    );

    expect(result).toEqual('/caches/jsonlds');
  });
});
