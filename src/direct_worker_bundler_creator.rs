use std::{
  collections::HashMap,
  sync::{
    atomic::{AtomicU16, Ordering}, Arc, Mutex
  },
};

use napi::{bindgen_prelude::ObjectFinalize, threadsafe_function::{ErrorStrategy, ThreadSafeCallContext, ThreadsafeFunction}, Env, Error, JsFunction, Result};

use crate::{
  direct_worker_bundler::DirectWorkerBundler,
  plugins::{convert_plugins_to_thread_safe_plugins, Plugin, ThreadSafePlugin},
};

type PluginsInSingleWorker = Vec<ThreadSafePlugin>;

lazy_static! {
  static ref PLUGINS_MAP: Mutex<HashMap<u16, Mutex<Vec<PluginsInSingleWorker>>>> =
    Mutex::new(HashMap::new());
  static ref NEXT_ID: AtomicU16 = AtomicU16::new(1);
}

#[napi(custom_finalize)]
pub struct DirectWorkerBundlerCreator {
  #[napi(writable = false)]
  pub id: u16,

  cb: Option<Arc<ThreadsafeFunction<String, ErrorStrategy::Fatal>>>,
}

#[napi]
impl DirectWorkerBundlerCreator {
  #[napi(constructor)]
  pub fn new(cb: Option<JsFunction>) -> napi::Result<Self> {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);

    let mut map = PLUGINS_MAP.lock().unwrap();
    map.insert(id, Mutex::new(vec![]));

    Ok(Self {
      id,
      cb: cb.map(|cb| {
        Arc::new(cb.create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| {
          Ok(vec![ctx.value])
        }).unwrap())
      })
    })
  }

  #[napi(writable = false)]
  pub fn create(&self) -> Result<DirectWorkerBundler> {
    let mut map = PLUGINS_MAP.lock().unwrap();
    let plugins = map.remove(&self.id);
    if plugins.is_none() {
      return Err(Error::new(
        napi::Status::GenericFailure,
        "Bundler already created",
      ));
    }

    let plugins = plugins.unwrap().into_inner().unwrap();
    Ok(DirectWorkerBundler::new(plugins, self.cb.clone()))
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
    existing_plugins.lock().unwrap().push(plugins);
  }
}
