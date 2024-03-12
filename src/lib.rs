#![deny(clippy::all)]

use std::{
  collections::HashMap,
  sync::{
    atomic::{AtomicU16, Ordering},
    Arc,
  },
};

use napi::{
  bindgen_prelude::{block_on, ObjectFinalize},
  threadsafe_function::{ThreadSafeCallContext, ThreadsafeFunction},
  tokio::{
    runtime::Runtime,
    sync::{Mutex, RwLock},
  },
  Env, JsFunction,
};

#[macro_use]
extern crate napi_derive;
#[macro_use]
extern crate lazy_static;

lazy_static! {
  static ref PLUGINS_MAP: RwLock<HashMap<u16, Arc<RwLock<Vec<PluginsInSingleWorker>>>>> =
    RwLock::new(HashMap::new());
  static ref NEXT_ID: AtomicU16 = AtomicU16::new(1);
}

type PluginsInSingleWorker = Mutex<Vec<ThreadSafePlugin>>;

#[napi(object)]
pub struct Plugin {
  pub name: String,
  #[napi(ts_type = "(source: string) => Promise<string | undefined>")]
  pub resolve_id: Option<JsFunction>,
}

pub struct ThreadSafePlugin {
  pub name: String,
  pub resolve_id: Option<ThreadsafeFunction<String>>,
}

#[napi(custom_finalize)]
pub struct Bundler {
  id: u16,
}

#[napi]
impl Bundler {
  #[napi(constructor)]
  pub fn new() -> napi::Result<Self> {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);

    block_on(async {
      let mut map = PLUGINS_MAP.write().await;
      map.insert(id, Arc::new(RwLock::new(vec![])));
    });

    Ok(Self { id: id })
  }

  #[napi(writable = false)]
  pub fn get_id(&self) -> u16 {
    self.id
  }

  #[napi(writable = false)]
  pub async fn get_plugin_count(&self) -> u32 {
    let map = PLUGINS_MAP.read().await;
    let plugins = map.get(&self.id);
    match plugins {
      None => 0,
      Some(plugins) => plugins.read().await[0].lock().await.len() as u32,
    }
  }

  #[napi(writable = false)]
  pub async fn resolve_id(&self, id: String) -> String {
    let map = PLUGINS_MAP.read().await;
    let plugins_list = map.get(&self.id);
    if let Some(plugins_list) = plugins_list {
      let plugins_list = plugins_list.read().await;
      for plugins in plugins_list.iter() {
        if let Ok(plugins) = plugins.try_lock() {
          return resolve_id(&plugins, id).await;
        }
      }
      // TODO: should balance the workload
      for plugins in plugins_list.iter() {
        let plugins = plugins.lock().await;
        return resolve_id(&plugins, id).await;
      }
    }
    return "fallback".to_string();
  }
}

async fn resolve_id(plugins: &Vec<ThreadSafePlugin>, id: String) -> String {
  for plugin in plugins.iter() {
    if let Some(hook) = &plugin.resolve_id {
      let resolved = hook.call_async(Ok(id.to_string())).await;
      if let Ok(resolved) = resolved {
        return resolved;
      }
    }
  }
  return "fallback".to_string();
}

impl ObjectFinalize for Bundler {
  fn finalize(self, mut _env: Env) -> napi::Result<()> {
    // Runtime does not exist?
    Runtime::new().unwrap().block_on(async {
      let mut map = PLUGINS_MAP.write().await;
      map.remove(&self.id);
    });

    Ok(())
  }
}

#[napi]
pub fn register_plugins(id: u16, plugins: Vec<Plugin>) {
  block_on(async {
    let plugins = convert_plugins_to_thread_safe_plugins(plugins);

    let mut map = PLUGINS_MAP.write().await;
    if let Some(existing_plugins) = map.get_mut(&id) {
      existing_plugins.write().await.push(Mutex::new(plugins))
    }
  });
}

fn convert_plugins_to_thread_safe_plugins(plugins: Vec<Plugin>) -> Vec<ThreadSafePlugin> {
  plugins
    .iter()
    .map(|p| ThreadSafePlugin {
      name: p.name.clone(),
      resolve_id: p.resolve_id.as_ref().and_then(|resolve_id| {
        Some(
          resolve_id
            .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| {
              ctx.env.create_string(&ctx.value).map(|v| vec![v])
            })
            .unwrap(),
        )
      }),
    })
    .collect()
}
