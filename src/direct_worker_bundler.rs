use std::sync::Arc;

use napi::tokio::{
  self,
  sync::{Mutex, MutexGuard, RwLock, Semaphore},
};

use crate::{
  plugins::{resolve_id, ThreadSafePlugin},
  result::RunResult,
};

#[napi]
pub struct DirectWorkerBundler {
  plugins_list: Arc<RwLock<Box<[Arc<Mutex<Vec<ThreadSafePlugin>>>]>>>,
  semaphore: Arc<Semaphore>,
}

#[napi]
impl DirectWorkerBundler {
  pub fn new(plugins_list: Vec<Vec<ThreadSafePlugin>>) -> Self {
    let plugins_list: Vec<_> = plugins_list
      .into_iter()
      .map(|plugins| Arc::new(Mutex::new(plugins)))
      .collect();
    let plugins_list_len = plugins_list.len();
    Self {
      plugins_list: Arc::new(RwLock::new(plugins_list.into_boxed_slice())),
      semaphore: Arc::new(Semaphore::new(plugins_list_len)),
    }
  }

  #[napi]
  pub async fn get_plugin_count(&self) -> u32 {
    let plugins_list = self.plugins_list.read().await;
    let plugins = plugins_list[0].lock().await;
    plugins.len() as u32
  }

  #[napi]
  pub async fn run(&self, count: u32) -> RunResult {
    let mut future_list = Vec::with_capacity(count as usize);
    for _ in 0..count {
      let plugins_list = self.plugins_list.clone();
      let permit = self.semaphore.clone().acquire_owned().await.unwrap();
      let f = tokio::spawn(async move {
        let plugins_list = plugins_list.read().await;
        let plugins = get_plugins(&plugins_list).await.unwrap();
        let result = resolve_id(&plugins, "worker".to_string()).await;
        drop(permit);
        result
      });
      future_list.push(f)
    }

    let results = futures::future::join_all(future_list).await;
    let len = results.len() as u32;
    let result = results[0].as_ref().unwrap().clone();
    RunResult { len, result }
  }
}

async fn get_plugins(
  plugins_list: &Box<[Arc<Mutex<Vec<ThreadSafePlugin>>>]>,
) -> Option<MutexGuard<Vec<ThreadSafePlugin>>> {
  for plugins in plugins_list.iter() {
    if let Ok(plugins) = plugins.try_lock() {
      return Some(plugins);
    }
  }
  // NOTE: this would not be called because semaphore exists
  for plugins in plugins_list.iter() {
    let plugins = plugins.lock().await;
    return Some(plugins);
  }
  None
}
