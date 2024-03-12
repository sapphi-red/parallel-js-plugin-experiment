import { parentPort, workerData } from 'node:worker_threads'
import { registerPlugins } from '../index.js'

const bundlerId = workerData.id

registerPlugins(bundlerId, [
  {
    name: 'worker',
    resolveId(_dummy, id) {
      if (id === 'worker') {
        // eat up the CPU for 500ms
        const now = Date.now()
        while (now + 500 > Date.now()) {}

        return 'worker:' + id
      }
    }
  }
])

parentPort.postMessage('')
