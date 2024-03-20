import { Worker } from 'node:worker_threads'

/**
 * @param {number} [id]
 * @param {number} [name]
 * @param {number} [duration] in milliseconds
 * @returns {import('node:worker_threads').Worker}
 */
const initWorker = (id, name, duration) => {
  const worker = new Worker(new URL('./directWorker.mjs', import.meta.url), {
    workerData: { id, name, duration }
  })
  return worker
}

/**
 * @param {number} [id]
 * @param {number} [duration] in milliseconds
 * @param {number} [count] number of workers
 * @returns {() => Promise<void>}
 */
export const initWorkers = (id, duration, count) => {
  /** @type {Array<import('node:worker_threads').Worker>} */
  const workers = Array.from({ length: count }, (_, i) =>
    initWorker(id, i, duration)
  )
  return async () => {
    await Promise.all(workers.map(worker => worker.terminate()))
  }
}
