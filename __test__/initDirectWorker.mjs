import { Worker } from 'node:worker_threads'

/**
 * @param {number} [id]
 * @param {number} [name]
 * @param {number} [duration] in milliseconds
 * @param {boolean} [testCb]
 * @returns {Promise<import('node:worker_threads').Worker>}
 */
export const initWorker = async (id, name, duration, testCb) => {
  const worker = new Worker(new URL('./directWorker.mjs', import.meta.url), {
    workerData: { id, name, duration, testCb }
  })
  await new Promise(resolve => {
    worker.addListener('message', async () => {
      resolve()
    })
  })
  return worker
}

/**
 * @param {number} [id]
 * @param {number} [duration] in milliseconds
 * @param {number} [count] number of workers
 * @param {boolean} [testCb]
 * @param {{ beforeWaitWorker: () => void, afterWaitWorker: () => void }?} [hooks]
 * @returns {Promise<() => Promise<void>>}
 */
export const initWorkers = async (id, duration, count, testCb, hooks) => {
  /** @type {Promise<Array<import('node:worker_threads').Worker>>} */
  const workersPromises = Promise.all(Array.from({ length: count }, (_, i) =>
    initWorker(id, i, duration, testCb)
  ))
  hooks?.beforeWaitWorker()
  const workers = await workersPromises
  hooks?.afterWaitWorker()
  return async () => {
    await Promise.all(workers.map(worker => worker.terminate()))
  }
}
