import { DirectWorkerBundlerCreator } from '../index.js'
import { initWorkers } from './initDirectWorker.mjs'

/**
 * @param {number} consumeDuration
 * @param {number} workerCount
 * @returns {Promise<{
 *   bundler: import('../index.js').DirectWorkerBundler,
 *   stopWorkers: () => Promise<void>
 * }>}
 */
export const initializeDirect = async (consumeDuration, workerCount) => {
  const bundlerCreator = new DirectWorkerBundlerCreator(workerCount)
  const id = bundlerCreator.id

  const stopWorkers = initWorkers(id, consumeDuration, workerCount)

  const bundler = await bundlerCreator.create()
  return { bundler, stopWorkers }
}
