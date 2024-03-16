import test from 'ava'
import { SimpleBundler } from '../index.js'
import { initWorkers } from './initIndirectWorker.mjs'

test('run in two workers (indirect)', async (t) => {
  t.plan(4)

  const count = 10
  const { stopWorkers, call } = await initWorkers(100, 2)

  const bundler = new SimpleBundler([
    {
      name: 'worker',
      async resolveId(_dummy, id) {
        if (id === 'worker') {
          const r = await call(id);
          return r
        }
      }
    }
  ])

  try {
    t.is(await bundler.getPluginCount(), 1)

    const before = Date.now()
    const result = await bundler.run(count)
    const duration = Date.now() - before

    t.is(result.result, 'worker:worker')
    t.is(result.len, count)
    t.is(duration < 600, true, `duration was ${duration}`)

    console.log(`running by two worker (indirect) took: `, duration)
  } finally {
    await stopWorkers()
  }
})

test('run by main thread', async (t) => {
  t.plan(4)

  const count = 10
  const consumeDuration = 100
  const bundler = new SimpleBundler([
    {
      name: 'worker',
      resolveId(_dummy, id) {
        if (id === 'worker') {
          // eat up the CPU for some time
          const now = Date.now()
          while (now + consumeDuration > Date.now()) {}

          return 'worker:' + id
        }
      }
    }
  ])

  t.is(await bundler.getPluginCount(), 1)

  const before = Date.now()
  const result = await bundler.run(count)
  const duration = Date.now() - before

  t.is(result.result, 'worker:worker')
  t.is(result.len, count)
  t.is(duration < 1200, true, `duration was ${duration}`)

  console.log(`running by main thread took: `, duration)
})
