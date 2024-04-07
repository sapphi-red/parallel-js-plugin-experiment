import { parentPort, workerData } from 'node:worker_threads'
import { registerPlugins } from '../index.js'

const bundlerId = workerData.id
const name = workerData.name
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
    },
    renderChunk(code, context) {
      const meta = context.getModuleInfo('foo').meta
      meta.bar = name
    }
  },
  {
    name: 'worker2',
    renderChunk(code, context) {
      const meta = context.getModuleInfo('foo').meta
      return '' + meta.bar
    }
  }
])

parentPort.postMessage('')
