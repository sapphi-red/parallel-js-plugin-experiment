import { test, expect } from 'vitest'
import { SimpleBundler } from '../index.js'
import { initWorkers } from './initIndirectWorker.mjs'
import config from './config.mjs'

const { consumeDuration, count, idLength, workerCount } = config

test.sequential(`run in ${workerCount} workers (indirect)`, async () => {
  expect.assertions(3)

  console.time('initialization (indirect, multiple)')
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
  console.timeEnd('initialization (indirect, multiple)')

  try {
    expect(await bundler.getPluginCount()).toBe(1)

    console.time('run (indirect, multiple)')
    const result = await bundler.run(count, idLength)
    console.timeEnd('run (indirect, multiple)')

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})

test.sequential(`run in one worker (indirect)`, async () => {
  expect.assertions(3)

  console.time('initialization (indirect, single)')
  const { stopWorkers, call } = await initWorkers(consumeDuration, 1)

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
  console.timeEnd('initialization (indirect, single)')

  try {
    expect(await bundler.getPluginCount()).toBe(1)

    console.time('run (indirect, single)')
    const result = await bundler.run(count, idLength)
    console.timeEnd('run (indirect, single)')

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})

test.sequential('main thread', async () => {
  expect.assertions(3)

  console.time('initialization (main thread)')
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
  console.timeEnd('initialization (main thread)')

  expect(await bundler.getPluginCount()).toBe(1)

  console.time('run (main thread)')
  const result = await bundler.run(count, idLength)
  console.timeEnd('run (main thread)')

  expect(result.result.startsWith('worker:worker')).toBe(true)
  expect(result.len).toBe(count)
})
