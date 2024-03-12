import { Worker } from 'node:worker_threads'

/**
 * @param {string} [path]
 * @param {number} [id]
 * @param {number} [name]
 * @returns {Promise<import('node:worker_threads').Worker>}
 */
export const initWorker = async (path, id, name) => {
  const worker = new Worker(new URL(path, import.meta.url), {
    workerData: { id, name }
  })
  await new Promise(resolve => {
    worker.addListener('message', async () => {
      resolve()
    })
  })
  return worker
}
