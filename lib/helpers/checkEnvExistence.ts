import { StringKV } from './types';

export function envExists(env: StringKV, envVar: string): string {
  if (!env[envVar]) throw new Error(`Environment variable ${envVar} is not set`);
  return env[envVar];
}

export function getAllEnv(env: StringKV, names: string[]) {
  return names.map(n => envExists(env, n));
}
