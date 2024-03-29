/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

export function registerPlugins(id: number, plugins: Array<Plugin>): void
export interface Plugin {
  name: string
  resolveId?: (source: string) => Promise<string | undefined>
}
export interface RunResult {
  len: number
  result: string
}
export class DirectWorkerBundler {
  getPluginCount(): Promise<number>
  run(count: number, idLength: number): Promise<RunResult>
}
export class DirectWorkerBundlerCreator {
  id: number
  constructor()
  create(): DirectWorkerBundler
}
export class SimpleBundler {
  constructor(plugins: Array<Plugin>)
  getPluginCount(): Promise<number>
  run(count: number, idLength: number): Promise<RunResult>
}
