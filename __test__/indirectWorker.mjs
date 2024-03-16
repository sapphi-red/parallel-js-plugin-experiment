import { parentPort, workerData } from 'node:worker_threads'

const consumeDuration = workerData.duration

parentPort.addListener('message', ({ id, rpcId }) => {
  /** @type {string | undefined} */
  let result
  if (id === 'worker') {
    // eat up the CPU for some time
    const now = Date.now()
    while (now + consumeDuration > Date.now()) {}

    result = 'worker:' + id
  }
  parentPort.postMessage({ rpcId, result })
})

parentPort.postMessage('')
