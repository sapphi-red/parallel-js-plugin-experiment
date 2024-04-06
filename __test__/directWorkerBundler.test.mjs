import { test, expect } from 'vitest'
import testParams from './testParams.mjs'
import { initializeDirect } from './directWorkerBundler.mjs'

const { consumeDuration, count, idLength, workerCount } = testParams

test.sequential(`run in ${workerCount} workers (direct)`, async () => {
  expect.assertions(3)

  const { bundler, stopWorkers } = await initializeDirect(
    'test',
    consumeDuration,
    workerCount
  )

  try {
    expect(await bundler.getPluginCount()).toBe(2)

    const result = await bundler.run(count, idLength)

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})

test.sequential('run in one worker (direct)', async () => {
  expect.assertions(3)

  const { bundler, stopWorkers } = await initializeDirect(
    'test',
    consumeDuration,
    1
  )

  try {
    expect(await bundler.getPluginCount()).toBe(2)

    const result = await bundler.run(count, idLength)

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})

test.sequential(`test meta (direct)`, async () => {
  const { bundler, stopWorkers } = await initializeDirect(
    'test',
    consumeDuration,
    workerCount
  )

  try {
    const result = await bundler.testMeta(count, idLength)

    expect(+result.result).not.toBeNaN()
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})
