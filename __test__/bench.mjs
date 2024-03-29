import { initializeIndirect, initializeMainThread } from './simpleBundler.mjs'
import { initializeDirect } from './directWorkerBundler.mjs'

const workerCounts = [1, 4, 8, 16]

await benchGroup('initialize', ({ bench }) => {
  bench('main thread', () => {
    initializeMainThread(1)
  })

  const createWorkerWaitDurationCollector = () => {
    let duration = 0
    let count = 0
    let before = 0
    const hooks = {
      beforeWaitWorker: () => {
        before = performance.now()
      },
      afterWaitWorker: () => {
        duration += performance.now() - before
        count++
      }
    }
    return { hooks, getResult: () => duration / count }
  }

  for (const workerCount of workerCounts) {
    let workerWaitdurationCollector
    bench(`indirect (worker count: ${workerCount})`, {
      setupAll: () => { workerWaitdurationCollector = createWorkerWaitDurationCollector() },
      teardownAll: () => {
        const result = workerWaitdurationCollector.getResult()
        console.log(`    worker wait: ${result.toFixed(3)}ms`)
      },
      fn: async () => {
        const { stopWorkers } = await initializeIndirect(
          1,
          workerCount,
          workerWaitdurationCollector.hooks
        )
        return async () => {
          await stopWorkers()
        }
      }
    })
  }

  for (const workerCount of workerCounts) {
    let workerWaitdurationCollector
    bench(`direct (worker count: ${workerCount})`, {
      setupAll: () => { workerWaitdurationCollector = createWorkerWaitDurationCollector() },
      teardownAll: () => {
        const result = workerWaitdurationCollector.getResult()
        console.log(`    worker wait: ${result.toFixed(3)}ms`)
      },
      fn: async () => {
        const { stopWorkers } = await initializeDirect(
          1,
          workerCount,
          workerWaitdurationCollector.hooks
        )
        return async () => {
          await stopWorkers()
        }
      }
    })
  }
})

const params = [
  {
    consumeDuration: 0, // calls 1000 times in this case
    idLengths: [30]
  },
  {
    consumeDuration: 1,
    idLengths: [30]
  },
  {
    consumeDuration: 3,
    idLengths: [30]
  },
  {
    consumeDuration: 5,
    idLengths: [30]
  },
  {
    consumeDuration: 10,
    idLengths: [30, 10000, 100000, 1000000]
  }
]

for (const { consumeDuration, idLengths } of params) {
  const count =
    consumeDuration === 0 ? 1000 : Math.floor(1000 / consumeDuration)
  for (const idLength of idLengths) {
    await benchGroup(
      `run (consumeDuration: ${consumeDuration}, count: ${count}, idLength: ${idLength})`,
      async ({ bench }) => {
        /** @type {Array<() => Promise<void>>} */
        const teardowns = []

        const mainThreadBundler = initializeMainThread(consumeDuration)
        bench('main', async () => {
          await mainThreadBundler.run(count, idLength)
        })

        for (const workerCount of workerCounts) {
          const { bundler, stopWorkers } = await initializeIndirect(
            consumeDuration,
            workerCount
          )
          bench(`indirect (worker count: ${workerCount})`, async () => {
            await bundler.run(count, idLength)
          })
          teardowns.push(stopWorkers)
        }

        for (const workerCount of workerCounts) {
          const { bundler, stopWorkers } = await initializeDirect(
            consumeDuration,
            workerCount
          )
          bench(`direct (worker count: ${workerCount})`, async () => {
            await bundler.run(count, idLength)
          })
          teardowns.push(stopWorkers)
        }

        return async () => {
          await Promise.all(teardowns.map((t) => t()))
        }
      }
    )
  }
}

/**
 * @typedef {() => Promise<() => Promise<void> | undefined>} TaskFunction
 */
/**
 * @typedef {{fn: TaskFunction, setupAll?: () => void, teardownAll?: () => void}} TaskOptions
 */

/**
 * @param {string} name
 * @param {(p: { bench: (name: string, fnOrObj: TaskFunction | TaskOptions) => Promise<void> }) => Promise<() => Promise<void> | undefined>} fn
 */
async function benchGroup(name, fn) {
  /** @type {Array<{ name: string } & TaskOptions>} */
  const benchTasks = []

  const bench = (name, fnOrObj) => {
    benchTasks.push({ name, ...(typeof fnOrObj === 'function' ? { fn: fnOrObj } : fnOrObj) })
  }

  const groupTeardown = await fn({ bench })

  console.log(`${name}:`)
  for (const task of benchTasks) {
    /** @type {number[]} */
    const durations = []
    const count = 10
    task.setupAll?.()
    for (let i = 0; i < count; i++) {
      const before = performance.now()
      const teardown = await task.fn()
      durations.push(performance.now() - before)
      await teardown?.()
    }
    const duration = durations
      .map((duration) => duration / 10)
      .reduce((acc, v) => acc + v, 0)

    console.log(`  ${task.name}: ${duration.toFixed(3)}ms`)
    task.teardownAll?.()
  }

  await groupTeardown?.()
}
