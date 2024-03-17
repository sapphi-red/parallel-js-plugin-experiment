import { test, expect } from 'vitest'
import { DirectWorkerBundlerCreator } from '../index.js'
import { initWorkers } from './initDirectWorker.mjs'
import config from './config.mjs'

const { consumeDuration, count, idLength, workerCount } = config

test.sequential(`run in ${workerCount} workers (direct)`, async () => {
  expect.assertions(3)

  console.time('initialization (direct, multiple)')
  const bundlerCreator = new DirectWorkerBundlerCreator()
  const id = bundlerCreator.id

  const stopWorkers = await initWorkers(id, consumeDuration, workerCount)

  const bundler = bundlerCreator.create()
  console.timeEnd('initialization (direct, multiple)')

  try {
    expect(await bundler.getPluginCount()).toBe(1)

    console.time('run (direct, multiple)')
    const result = await bundler.run(count, idLength)
    console.timeEnd('run (direct, multiple)')

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})

test.sequential('run in one worker (direct)', async (t) => {
  expect.assertions(3)

  console.time('initialization (direct, single)')
  const bundlerCreator = new DirectWorkerBundlerCreator()
  const id = bundlerCreator.id

  const stopWorkers = await initWorkers(id, consumeDuration, 1)

  const bundler = bundlerCreator.create()
  console.timeEnd('initialization (direct, single)')

  try {
    expect(await bundler.getPluginCount()).toBe(1)

    console.time('run (direct, single)')
    const result = await bundler.run(count, idLength)
    console.timeEnd('run (direct, single)')

    expect(result.result.startsWith('worker:worker')).toBe(true)
    expect(result.len).toBe(count)
  } finally {
    await stopWorkers()
  }
})
