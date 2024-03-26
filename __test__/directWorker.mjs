import { parentPort, workerData } from 'node:worker_threads'
import { registerPlugins } from '../index.js'

const bundlerId = workerData.id
const consumeDuration = workerData.duration

registerPlugins(bundlerId, [
  {
    name: 'worker',
    resolveId(id) {
      if (id.startsWith('worker')) {
        // eat up the CPU for some time
        const now = Date.now()
        while (now + consumeDuration > Date.now()) {}

        return 'worker:' + id
      }
    }
  }
])

parentPort.postMessage('')
