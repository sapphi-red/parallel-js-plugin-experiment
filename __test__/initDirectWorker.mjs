import { Worker } from 'node:worker_threads'

/**
 * @param {string} [file] worker file path
 * @param {number} [id]
 * @param {number} [name]
 * @param {number} [duration] in milliseconds
 * @returns {Promise<import('node:worker_threads').Worker>}
 */
export const initWorker = async (file, id, name, duration) => {
  const worker = new Worker(file, {
    workerData: { id, name, duration }
  })
  await new Promise((resolve) => {
    worker.addListener('message', async () => {
      resolve()
    })
  })
  return worker
}

/**
 * @param {'test' | 'bench'} [type]
 * @param {number} [id]
 * @param {number} [duration] in milliseconds
 * @param {number} [count] number of workers
 * @param {{ beforeWaitWorker: () => void, afterWaitWorker: () => void }?} [hooks]
 * @returns {Promise<() => Promise<void>>}
 */
export const initWorkers = async (type, id, duration, count, hooks) => {
  const file =
    type === 'test'
      ? new URL('./directWorker.mjs', import.meta.url)
      : new URL('./directWorkerForBench.mjs', import.meta.url)

  /** @type {Promise<Array<import('node:worker_threads').Worker>>} */
  const workersPromises = Promise.all(
    Array.from({ length: count }, (_, i) => initWorker(file, id, i, duration))
  )
  hooks?.beforeWaitWorker()
  const workers = await workersPromises
  hooks?.afterWaitWorker()
  return async () => {
    await Promise.all(workers.map((worker) => worker.terminate()))
  }
}
