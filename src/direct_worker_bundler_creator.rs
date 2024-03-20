use std::{
  collections::HashMap,
  sync::{
    atomic::{AtomicU16, Ordering},
    Arc, Mutex,
  },
};

use napi::{bindgen_prelude::ObjectFinalize, tokio::sync::Notify, Env, Error, Result};

use crate::{
  direct_worker_bundler::DirectWorkerBundler,
  plugins::{convert_plugins_to_thread_safe_plugins, Plugin, ThreadSafePlugin},
};

type PluginsInSingleWorker = Vec<ThreadSafePlugin>;

#[derive(Default)]
struct PluginsMapValue {
  plugins_list: Mutex<Vec<PluginsInSingleWorker>>,
  notify: Notify,
}

impl PluginsMapValue {
  fn register(&self, plugins: PluginsInSingleWorker) {
    self.plugins_list.lock().unwrap().push(plugins);
    self.notify.notify_one();
  }
}

lazy_static! {
  static ref PLUGINS_MAP: Mutex<HashMap<u16, Arc<PluginsMapValue>>> = Mutex::new(HashMap::new());
  static ref NEXT_ID: AtomicU16 = AtomicU16::new(1);
}

#[napi(custom_finalize)]
pub struct DirectWorkerBundlerCreator {
  #[napi(writable = false)]
  pub id: u16,
  worker_count: u16,
}

#[napi]
impl DirectWorkerBundlerCreator {
  #[napi(constructor)]
  pub fn new(worker_count: u16) -> napi::Result<Self> {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);

    let mut map = PLUGINS_MAP.lock().unwrap();
    map.insert(id, Arc::new(PluginsMapValue::default()));

    Ok(Self { id, worker_count })
  }

  #[napi(writable = false)]
  pub async fn create(&self) -> Result<DirectWorkerBundler> {
    {
      let value: Arc<PluginsMapValue>;
      {
        let map = PLUGINS_MAP.lock().unwrap();
        value = map.get(&self.id).unwrap().clone();
      }

      while value
        .plugins_list
        .try_lock()
        .map_or(true, |plugins| (plugins.len() as u16) < self.worker_count)
      {
        value.notify.notified().await;
      }
    }

    let mut map = PLUGINS_MAP.lock().unwrap();
    let value = map.remove(&self.id);
    if value.is_none() {
      return Err(Error::new(
        napi::Status::GenericFailure,
        "Bundler already created",
      ));
    }

    let plugins_list = Arc::into_inner(value.unwrap())
      .unwrap()
      .plugins_list
      .into_inner()
      .unwrap();
    Ok(DirectWorkerBundler::new(plugins_list))
  }
}

impl ObjectFinalize for DirectWorkerBundlerCreator {
  fn finalize(self, mut _env: Env) -> napi::Result<()> {
    let mut map = PLUGINS_MAP.lock().unwrap();
    map.remove(&self.id);

    Ok(())
  }
}

#[napi]
pub fn register_plugins(id: u16, plugins: Vec<Plugin>) {
  let plugins = convert_plugins_to_thread_safe_plugins(None, plugins);

  let mut map = PLUGINS_MAP.lock().unwrap();
  if let Some(existing_plugins) = map.get_mut(&id) {
    existing_plugins.register(plugins);
  }
}
