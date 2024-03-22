import matplotlib.pyplot as plt
import numpy as np

def gen_init_graph():
  fig, ax = plt.subplots()

  types = ['A', 'B1', 'B4', 'B8', 'B16', 'C1', 'C4', 'C8', 'C16']
  duration = [0.013, 26.207, 29.304, 34.062, 51.233, 31.253, 34.196, 38.116, 57.307]
  workerDuration = [0, 25.566, 28.197, 31.764, 46.026, 30.820, 33.201, 36.142, 52.613]

  weight_counts = {
    "CPU consumption\non main thread": np.array(duration) - np.array(workerDuration),
    "Wating for worker": workerDuration,
  }

  bottom = np.zeros(len(types))
  for label, weight_count in weight_counts.items():
    ax.bar(types, weight_count, label=label, bottom=bottom)
    bottom += weight_count

  ax.set_ylabel('Duration (ms)')
  ax.legend()
  fig.savefig("./output/init.png")

def gen_run_graph1():
  fig, ax = plt.subplots()

  worker_counts = [1, 4, 8, 16]

  ax.plot(worker_counts, [1004.372, 704.273, 1737.580, 4358.620], label='indirect (consume duration: 1)')
  ax.plot(worker_counts, [999.165, 252.673, 187.974, 375.481], label='indirect (consume duration: 3)')
  ax.plot(worker_counts, [999.963, 251.265, 131.172, 137.273], label='indirect (consume duration: 5)')
  ax.plot(worker_counts, [1000.069, 249.981, 130.881, 71.374], label='indirect (consume duration: 10)')

  ax.plot(worker_counts, [1000.195, 249.977, 125.079, 62.978], label='direct (consume duration: 1)')
  ax.plot(worker_counts, [998.969, 251.976, 125.977, 62.977], label='direct (consume duration: 3)')
  ax.plot(worker_counts, [1000.039, 249.979, 124.980, 64.982], label='direct (consume duration: 5)')
  ax.plot(worker_counts, [999.939, 249.980, 129.981, 69.975], label='direct (consume duration: 10)')

  ax.set_xlabel('Worker counts')
  ax.set_ylabel('Duration (ms)')
  ax.set_ylim(0, 1200)
  ax.legend()
  fig.savefig("./output/run1.png")

def gen_run_graph2():
  fig, ax = plt.subplots()

  worker_counts = [1, 4, 8, 16]

  ax.plot(worker_counts, [1000.069, 249.981, 130.881, 71.374], label='indirect (id length: 30)')
  ax.plot(worker_counts, [999.939, 249.981, 130.968, 72.181], label='indirect (id length: 10000)')
  ax.plot(worker_counts, [1002.145, 253.245, 134.376, 86.170], label='indirect (id length: 100000)')
  ax.plot(worker_counts, [1148.172, 336.675, 212.726, 208.795], label='indirect (id length: 1000000)')

  ax.plot(worker_counts, [999.939, 249.980, 129.981, 69.975], label='direct (id length: 30)')
  ax.plot(worker_counts, [999.973, 249.979, 129.967, 69.976], label='direct (id length: 10000)')
  ax.plot(worker_counts, [999.959, 250.166, 130.082, 70.083], label='direct (id length: 100000)')
  ax.plot(worker_counts, [1100.431, 280.206, 157.280, 88.989], label='direct (id length: 1000000)')

  ax.set_xlabel('Worker counts')
  ax.set_ylabel('Duration (ms)')
  ax.set_ylim(0, 1200)
  ax.legend()
  fig.savefig("./output/run2.png")

gen_init_graph()
gen_run_graph1()
gen_run_graph2()
