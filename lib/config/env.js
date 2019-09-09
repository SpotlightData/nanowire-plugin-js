import checkEnvExistence from '../helpers/utils/checkEnvExistence';

export const validate = () => {
  [
    'CONTROLLER_BASE_URI',
    'POD_NAME',
    'PLUGIN_ID',
    'MINIO_SCHEME',
    'MINIO_HOST',
    'MINIO_PORT',
    'MINIO_ACCESS',
    'MINIO_SECRET',
    'MINIO_BUCKET',
  ].map(checkEnvExistence);

  process.env.CACHES_PATH = process.env.CACHES_PATH || '/caches';
};
