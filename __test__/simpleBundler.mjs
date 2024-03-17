import { SimpleBundler } from '../index.js'
import { initWorkers } from './initIndirectWorker.mjs'

/**
 * @param {number} consumeDuration
 * @returns {SimpleBundler}
 */
export const initializeMainThread = (consumeDuration) => {
  const bundler = new SimpleBundler([
    {
      name: 'worker',
      resolveId(_dummy, id) {
        if (id.startsWith('worker')) {
          // eat up the CPU for some time
          const now = Date.now()
          while (now + consumeDuration > Date.now()) {}

          return 'worker:' + id
        }
      }
    }
  ])
  return bundler
}

/**
 * @param {number} consumeDuration
 * @param {number} workerCount
 * @returns {Promise<{ bundler: SimpleBundler, stopWorkers: () => Promise<void> }>}
 */
export const initializeIndirect = async (consumeDuration, workerCount) => {
  const { stopWorkers, call } = await initWorkers(consumeDuration, workerCount)

  const bundler = new SimpleBundler([
    {
      name: 'worker',
      async resolveId(_dummy, id) {
        if (id.startsWith('worker')) {
          const r = await call(id);
          return r
        }
      }
    }
  ])

  return { bundler, stopWorkers }
}
