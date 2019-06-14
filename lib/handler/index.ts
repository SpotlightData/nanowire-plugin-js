import * as Sentry from '@sentry/node';
import axios from 'axios';
import { StringKV, getAllEnv, sleep } from '@lib/helpers';

export interface ControllerResponse<M, J> {
  metadata: M;
  jsonld: J;
  url: string;
}
export type TaskHandler<M, J, R> = (data: ControllerResponse<M, J>) => R;

export interface PluginHandlerParams<M, J, R> {
  taskHandler: TaskHandler<M, J, R>;
  env: StringKV;
  name: string;
  timeout: number;
}

export class PluginHandler<M, J, R> {
  static LONGEST_TIMEOUT = 30 * 1000;

  static exponentialTimeout(time: number) {
    return Math.min(time * 1.5, PluginHandler.LONGEST_TIMEOUT);
  }

  static formatUrl(base: string, pName: string, pId: string): string {
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/v1/tasks?pluginId=${pId}&pluginInstance=${pName}`;
  }

  controllerUrl: string;
  timeout: number;
  taskHandler: TaskHandler<M, J, R>;

  constructor(params: PluginHandlerParams<M, J, R>) {
    const { env, name, taskHandler, timeout } = params;

    if (!params) {
      throw new TypeError('Missing parameters');
    }

    const [CONTROLLER_BASE_URI, POD_NAME, PLUGIN_ID] = getAllEnv(env, [
      'CONTROLLER_BASE_URI',
      'POD_NAME',
      'PLUGIN_ID',
    ]);

    this.taskHandler = taskHandler;
    this.timeout = timeout;
    this.controllerUrl = PluginHandler.formatUrl(CONTROLLER_BASE_URI, POD_NAME, PLUGIN_ID);

    Sentry.init({
      dsn: env.SENTRY_DSN,
    });
    Sentry.setTags({ pluginName: name });
  }

  getTask(): ControllerResponse<M, J> {
    async function loop(timeout: number) {
      await sleep(timeout);
      try {
        const resp = await axios.get(this.controllerUrl);
        return resp.data;
      } catch (e) {
        // Controller not available use exponential back-off
        if (e.code === 'ECONNREFUSED') {
          return loop(PluginHandler.exponentialTimeout(timeout));
        } else {
          // Otherwise, just wait again
          return loop(this.timeout);
        }
      }
    }
    return loop(0);
  }

  async singleFileLoop() {
    const task = this.getTask();
    try {
    } catch (e) {}
  }

  start() {
    // Only support single file atm
    return this.singleFileLoop();
  }
}
