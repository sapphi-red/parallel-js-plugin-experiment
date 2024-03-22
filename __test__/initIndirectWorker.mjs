import { Worker } from 'node:worker_threads'

/**
 * @param {number} [name]
 * @param {number} [duration] in milliseconds
 * @returns {Promise<import('node:worker_threads').Worker>}
 * @returns {Promise<{
 *    worker: import('node:worker_threads').Worker
 *    call: (id: string) => Promise<string | undefined>,
 * }>}
 */
const initWorker = async (name, duration) => {
  const worker = new Worker(new URL('./indirectWorker.mjs', import.meta.url), {
    workerData: { name, duration }
  })
  await new Promise(resolve => {
    worker.once('message', async () => {
      resolve()
    })
  })

  /** @type {Record<number, (value: string | undefined) => void>} */
  const rpcLists = {}
  worker.addListener('message', ({ rpcId, result }) => {
    rpcLists[rpcId]?.(result)
  })

  let nextRpcId = 0
  /** @type {(id: string) => Promise<string | undefined>} */
  const call = async id => {
    const rpcId = nextRpcId
    nextRpcId++

    /** @type {Promise<string | undefined>} */
    const p = new Promise(resolve => {
      rpcLists[rpcId] = resolve
    })
    worker.postMessage({ rpcId, id })

    const result = await p
    return result
  }


  return { worker, call }
}

/**
 * @param {number} [duration] in milliseconds
 * @param {number} [count] number of workers
 * @param {{ beforeWaitWorker: () => void, afterWaitWorker: () => void }?} [hooks]
 * @returns {Promise<{
 *    call: (id: string) => Promise<string | undefined>,
 *    stopWorkers: () => Promise<void>
 * }>}
 */
export const initWorkers = async (duration, count, hooks) => {
  /**
   * @type {Promise<Array<{
   *    worker: import('node:worker_threads').Worker
   *    call: (id: string) => Promise<string | undefined>,
   * }>>}
   */
  const workersPromise = Promise.all(Array.from({ length: count }, (_, i) =>
    initWorker(i, duration)
  ))
  hooks?.beforeWaitWorker()
  const workers = await workersPromise
  hooks?.afterWaitWorker()

  const isRunning = workers.map(() => false)
  const runningPromises = workers.map(() => Promise.resolve())

  /** @type {(id: string) => Promise<string | undefined>} */
  const call = async (id) => {
    while (isRunning.every(v => v)) {
      await Promise.race(runningPromises)
    }

    const emptyIndex = isRunning.findIndex(v => !v)
    if (emptyIndex < 0) throw new Error('')

    const promise = workers[emptyIndex].call(id).finally(() => {
      isRunning[emptyIndex] = false
    })
    isRunning[emptyIndex] = true
    runningPromises[emptyIndex] = promise

    const result = await promise
    return result
  }

  return {
    call,
    stopWorkers: async () => {
      await Promise.all(workers.map(({ worker }) => worker.terminate()))
    }
  }
}
