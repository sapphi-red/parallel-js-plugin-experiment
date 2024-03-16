import test from 'ava'
import { BundlerCreator } from '../index.js'
import { initWorker } from './initWorker.mjs'

test('run in two workers (direct)', async (t) => {
  t.plan(4)

  const bundlerCreator = new BundlerCreator()
  const id = bundlerCreator.id

  const count = 10
  const [worker1, worker2] = await Promise.all([
    initWorker('./worker.mjs', id, 1, 100),
    initWorker('./worker.mjs', id, 2, 100)
  ])

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
    await Promise.all([
      worker1.terminate(),
      worker2.terminate()
    ])
  }
})

test('run in one worker (direct)', async (t) => {
  t.plan(4)

  const bundlerCreator = new BundlerCreator()
  const id = bundlerCreator.id

  const count = 10
  const worker1 = await initWorker('./worker.mjs', id, 1, 100)

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
    await worker1.terminate()
  }
})
