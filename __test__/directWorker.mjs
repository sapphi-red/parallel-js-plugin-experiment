import { parentPort, workerData } from 'node:worker_threads'
import { registerPlugins } from '../index.js'

const bundlerId = workerData.id
const consumeDuration = workerData.duration
const testCb = workerData.testCb

registerPlugins(bundlerId, [
  {
    name: 'worker',
    resolveId(id, m) {
      if (id.startsWith('worker')) {
        // eat up the CPU for some time
        const now = Date.now()
        while (now + consumeDuration > Date.now()) {}

        return (testCb ? `${m.foo}:` : '') + 'worker:' + id
      }
    }
  }
])

parentPort.postMessage('')
