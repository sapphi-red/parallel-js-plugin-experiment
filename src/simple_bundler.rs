use std::sync::Arc;

use crate::{
  plugins::{convert_plugins_to_thread_safe_plugins, resolve_id, Plugin, ThreadSafePlugin},
  result::RunResult,
};

use napi::{
  tokio::{self, sync::RwLock},
  Env,
};

#[napi]
pub struct SimpleBundler {
  plugins: Arc<RwLock<Vec<ThreadSafePlugin>>>,
}

#[napi]
impl SimpleBundler {
  #[napi(constructor)]
  pub fn new(env: Env, plugins: Vec<Plugin>) -> Self {
    let plugins = convert_plugins_to_thread_safe_plugins(Some(&env), plugins);
    Self {
      plugins: Arc::new(RwLock::new(plugins)),
    }
  }

  #[napi]
  pub async fn get_plugin_count(&self) -> u32 {
    let plugins = self.plugins.read().await;
    plugins.len() as u32
  }

  #[napi]
  pub async fn run(&self, count: u32, id_length: u32) -> RunResult {
    let mut future_list = Vec::with_capacity(count as usize);
    for _ in 0..count {
      let plugins = self.plugins.clone();
      let f = tokio::spawn(async move {
        let plugins = plugins.read().await;
        resolve_id(&plugins, "worker".repeat((id_length / 6) as usize)).await
      });
      future_list.push(f)
    }

    let results = futures::future::join_all(future_list).await;
    let len = results.len() as u32;
    let result = results[0].as_ref().unwrap().clone();
    RunResult { len, result }
  }
}
