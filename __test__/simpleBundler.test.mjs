import { test, expect } from 'vitest'
import { initializeMainThread, initializeIndirect } from './simpleBundler.mjs'
import testParams from './testParams.mjs'

const { consumeDuration, count, idLength, workerCount } = testParams

test.sequential(`run in ${workerCount} workers (indirect)`, async () => {
  expect.assertions(3)

  const { bundler, stopWorkers } = await initializeIndirect(consumeDuration, workerCount)

  try {
    expect(await bundler.getPluginCount()).toBe(1)

    const result = await bundler.run(count, idLength)

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})

test.sequential(`run in one worker (indirect)`, async () => {
  expect.assertions(3)

  const { bundler, stopWorkers } = await initializeIndirect(consumeDuration, 1)

  try {
    expect(await bundler.getPluginCount()).toBe(1)

    const result = await bundler.run(count, idLength)

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})

test.sequential('main thread', async () => {
  expect.assertions(3)

  const bundler = initializeMainThread(consumeDuration)

  expect(await bundler.getPluginCount()).toBe(1)

  const result = await bundler.run(count, idLength)

  expect(result.result.startsWith('worker:worker')).toBe(true)
  expect(result.len).toBe(count)
})
