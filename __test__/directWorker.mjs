import { parentPort, workerData } from 'node:worker_threads'
import { registerPlugins } from '../index.js'
import { setTimeout } from 'node:timers/promises'

const bundlerId = workerData.id
const consumeDuration = workerData.duration

registerPlugins(bundlerId, [
  {
    name: 'worker',
    async resolveId(_dummy, id) {
      if (id.startsWith('worker')) {
        await setTimeout(consumeDuration)

        return 'worker:' + id
      }
    }
  }
])

parentPort.postMessage('')
