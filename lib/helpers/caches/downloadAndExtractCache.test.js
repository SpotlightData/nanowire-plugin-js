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
    expect(fs.createWriteStream).toBeCalledWith(`${process.env.CACHES_PATH}/cache.tar.gz`);

    expect(tar.x).toBeCalledWith({
      file: `${process.env.CACHES_PATH}/cache.tar.gz`,
      C: process.env.CACHES_PATH,
      preservePaths: true,
    });

    expect(result).toEqual(`${process.env.CACHES_PATH}/jsonlds`);
  });
});
