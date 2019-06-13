import * as Sentry from '@sentry/node';
import { StringKV, getAllEnv } from '@lib/helpers';

export type Handler<M, A, U, R> = (meta: M, json: A, url: U) => R;

export interface PluginHandlerParams<M, A, U, R> {
  taskHandler: Handler<M, A, U, R>;
  env: StringKV;
  name: string;
}

export class PluginHandler<M, A, U, R> {
  static formatUrl(base: string, pName: string, pId: string): string {
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/v1/tasks?pluginId=${pId}&pluginInstance=${pName}`;
  }

  controllerUrl: string;
  taskHandler: Handler<M, A, U, R>;

  constructor(params: PluginHandlerParams<M, A, U, R>) {
    const { env, name, taskHandler } = params;

    if (!params) {
      throw new TypeError('Missing parameters');
    }

    const [CONTROLLER_BASE_URI, POD_NAME, PLUGIN_ID] = getAllEnv(env, [
      'CONTROLLER_BASE_URI',
      'POD_NAME',
      'PLUGIN_ID',
    ]);

    this.taskHandler = taskHandler;
    this.controllerUrl = PluginHandler.formatUrl(CONTROLLER_BASE_URI, POD_NAME, PLUGIN_ID);

    Sentry.init({
      dsn: env.SENTRY_DSN,
    });
  }

  start() {}
}
