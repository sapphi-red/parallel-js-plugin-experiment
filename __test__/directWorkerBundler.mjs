import { DirectWorkerBundlerCreator } from '../index.js'
import { initWorkers } from './initDirectWorker.mjs'

/**
 * @param {number} consumeDuration
 * @param {number} workerCount
 * @param {{ beforeWaitWorker: () => void, afterWaitWorker: () => void }?} [hooks]
 * @returns {Promise<{
 *   bundler: import('../index.js').DirectWorkerBundler,
 *   stopWorkers: () => Promise<void>
 * }>}
 */
export const initializeDirect = async (consumeDuration, workerCount, hooks) => {
  const bundlerCreator = new DirectWorkerBundlerCreator()
  const id = bundlerCreator.id

  const stopWorkers = await initWorkers(id, consumeDuration, workerCount, hooks)

  const bundler = bundlerCreator.create()
  return { bundler, stopWorkers }
}
