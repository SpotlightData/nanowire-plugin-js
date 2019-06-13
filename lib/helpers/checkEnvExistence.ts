import { StringKV } from './types';

export function envExists(env: StringKV, envVar: string) {
  if (!env[envVar]) throw new Error(`Environment variable ${envVar} is not set`);
}

export function allEnvExist(env: StringKV, names: string[]) {
  names.map(n => envExists(env, n));
}
