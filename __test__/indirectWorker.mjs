import { parentPort, workerData } from 'node:worker_threads'
import { setTimeout } from 'node:timers/promises'

const consumeDuration = workerData.duration

parentPort.addListener('message', async ({ id, rpcId }) => {
  /** @type {string | undefined} */
  let result
  if (id.startsWith('worker')) {
    await setTimeout(consumeDuration)

    result = 'worker:' + id
  }
  parentPort.postMessage({ rpcId, result })
})

parentPort.postMessage('')
