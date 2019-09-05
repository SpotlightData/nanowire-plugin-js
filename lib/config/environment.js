import * as yup from 'yup';
import { logger } from '@spotlightdata/node-logger';

const envSchema = yup.object({
  CONTROLLER_BASE_URI: yup.string().required(),
  POD_NAME: yup.string().required(),
  PLUGIN_ID: yup.string().required(),
});

export function validateEnv(env) {
  try {
    envSchema.validateSync(env);
  } catch (e) {
    logger.error({ reason: 'ENVIRONMENT', message: `${e.path}: ${e.message}` });
    // Use process exit, for cleaner exit
    process.exit(1);
  }
}
