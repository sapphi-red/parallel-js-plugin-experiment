import test from 'ava'
import { DirectWorkerBundlerCreator } from '../index.js'
import { initWorkers } from './initDirectWorker.mjs'

test('run in two workers (direct)', async (t) => {
  t.plan(4)

  const bundlerCreator = new DirectWorkerBundlerCreator()
  const id = bundlerCreator.id

  const count = 10
  const stopWorkers = await initWorkers(id, 100, 2)

  const bundler = bundlerCreator.create()

  try {
    t.is(await bundler.getPluginCount(), 1)

    const before = Date.now()
    const result = await bundler.run(count)
    const duration = Date.now() - before

    t.is(result.result, 'worker:worker')
    t.is(result.len, count)
    t.is(duration < 600, true, `duration was ${duration}`)

    console.log(`running by two workers (direct) took: `, duration)
  } finally {
    await stopWorkers()
  }
})

test('run in one worker (direct)', async (t) => {
  t.plan(4)

  const bundlerCreator = new DirectWorkerBundlerCreator()
  const id = bundlerCreator.id

  const count = 10
  const stopWorkers = await initWorkers(id, 100, 1)

  const bundler = bundlerCreator.create()

  try {
    t.is(await bundler.getPluginCount(), 1)

    const before = Date.now()
    const result = await bundler.run(count)
    const duration = Date.now() - before

    t.is(result.result, 'worker:worker')
    t.is(result.len, count)
    t.is(duration < 1200, true, `duration was ${duration}`)

    console.log(`running by one worker (direct) took: `, duration)
  } finally {
    await stopWorkers()
  }
})
