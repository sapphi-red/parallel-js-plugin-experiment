import { initializeIndirect, initializeMainThread } from './simpleBundler.mjs'
import { initializeDirect } from './directWorkerBundler.mjs'

const workerCounts = [1, 4, 8, 16]

await benchGroup('initialize', ({ bench }) => {
  bench('main thread', () => {
    initializeMainThread(1)
  })

  for (const workerCount of workerCounts) {
    bench(`indirect (worker count: ${workerCount})`, async () => {
      const { stopWorkers } = await initializeIndirect(1, workerCount)
      return async () => {
        await stopWorkers()
      }
    })
  }

  for (const workerCount of workerCounts) {
    bench(`direct (worker count: ${workerCount})`, async () => {
      const { stopWorkers } = await initializeDirect(1, workerCount)
      return async () => {
        await stopWorkers()
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
  },
]

for (const { consumeDuration, idLengths } of params) {
  const count = consumeDuration === 0 ? 1000 : Math.floor(1000 / consumeDuration)
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
          await Promise.all(teardowns.map(t => t()))
        }
      }
    )
  }
}

/**
 * @param {string} name
 * @param {(p: { bench: (name: string, fn: () => Promise<() => Promise<void> | undefined>) => Promise<void> }) => Promise<() => Promise<void> | undefined>} fn
 */
async function benchGroup(name, fn) {
  /** @type {Array<{ name: string, fn: () => Promise<() => Promise<void> | undefined> }>} */
  const benchTasks = []

  const bench = (name, fn) => {
    benchTasks.push({ name, fn })
  }

  const groupTeardown = await fn({ bench })

  console.log(`${name}:`)
  for (const task of benchTasks) {
    /** @type {number[]} */
    const durations = []
    const count = 10
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
  }

  await groupTeardown?.()
}
