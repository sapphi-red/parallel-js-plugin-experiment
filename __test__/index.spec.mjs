import test from 'ava'
import { Bundler } from '../index.js'
import { initWorker } from './initWorker.mjs'

test('run in two workers', async (t) => {
  t.plan(4)

  const bundler = new Bundler()
  const id = bundler.getId()

  const [worker1, worker2] = await Promise.all([
    initWorker('./worker.mjs', id, 1),
    initWorker('./worker.mjs', id, 2)
  ])

  try {
    t.is(await bundler.getPluginCount(), 1)

    const before = Date.now()
    const [result1, result2] = await Promise.all([
      bundler.resolveId('worker'),
      bundler.resolveId('worker')
    ])
    const duration = Date.now() - before

    t.is(result1, 'worker:worker')
    t.is(result2, 'worker:worker')
    t.is(duration < 1000, true)

    console.log(`running by two workers took: `, duration)
  } finally {
    await Promise.all([
      worker1.terminate(),
      worker2.terminate()
    ])
  }
})

test('run in one worker', async (t) => {
  t.plan(4)

  const bundler = new Bundler()
  const id = bundler.getId()

  const worker1 = await initWorker('./worker.mjs', id, 1)

  try {
    t.is(await bundler.getPluginCount(), 1)

    const before = Date.now()
    const [result1, result2] = await Promise.all([
      bundler.resolveId('worker'),
      bundler.resolveId('worker')
    ])
    const duration = Date.now() - before

    t.is(result1, 'worker:worker')
    t.is(result2, 'worker:worker')
    t.is(duration > 600, true)

    console.log(`running by one worker took: `, duration)
  } finally {
    await worker1.terminate()
  }
})
