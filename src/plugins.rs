use std::sync::Arc;

use crate::js_values::{
  proxy::{ProxyWrapable, ProxyWrapper},
  value::Value,
};
use dashmap::DashMap;
use napi::{
  bindgen_prelude::{FromNapiValue, Promise},
  threadsafe_function::{ErrorStrategy, ThreadSafeCallContext, ThreadsafeFunction},
  Either, Env, Error, JsFunction, Result, Status,
};

#[napi(object)]
pub struct Plugin {
  pub name: String,
  #[napi(ts_type = "(source: string) => Promise<string | undefined>")]
  pub resolve_id: Option<JsFunction>,

  #[napi(ts_type = "(code: string, context: Context) => Promise<string | undefined>")]
  pub render_chunk: Option<JsFunction>,
}

pub struct ThreadSafePlugin {
  pub name: String,
  pub resolve_id: Option<ThreadsafeFunction<String, ErrorStrategy::Fatal>>,
  pub render_chunk: Option<ThreadsafeFunction<(String, Context), ErrorStrategy::Fatal>>,
}

/// Only pass env when env is main thread
pub fn convert_plugins_to_thread_safe_plugins(
  env: Option<&Env>,
  plugins: Vec<Plugin>,
) -> Vec<ThreadSafePlugin> {
  plugins
    .into_iter()
    .map(|p| ThreadSafePlugin {
      name: p.name,
      resolve_id: p.resolve_id.map(|resolve_id| {
        let mut func = resolve_id
          .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| Ok(vec![ctx.value]))
          .unwrap();
        if let Some(env) = env {
          _ = func.unref(env);
        }

        func
      }),
      render_chunk: p.render_chunk.map(|render_chunk| {
        let mut func = render_chunk
          .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<(String, Context)>| {
            let v: Vec<Either<String, Context>> =
              vec![Either::A(ctx.value.0), Either::B(ctx.value.1)];
            Ok(v)
          })
          .unwrap();
        if let Some(env) = env {
          _ = func.unref(env);
        }

        func
      }),
    })
    .collect()
}

pub async fn resolve_id(plugins: &[ThreadSafePlugin], id: String) -> String {
  for plugin in plugins.iter() {
    if let Some(hook) = &plugin.resolve_id {
      let resolved: Result<Either<Promise<Option<String>>, Option<String>>> =
        hook.call_async(id.clone()).await;
      if let Ok(resolved) = resolved {
        let resolved = match resolved {
          Either::A(resolved) => resolved.await.ok().flatten(),
          Either::B(resolved) => resolved,
        };
        if let Some(resolved) = resolved {
          return resolved;
        }
      }
    }
  }
  "fallback".to_string()
}

/// NOTE: only calls the first one like resolveId for now
pub async fn render_chunk(
  plugins: &[ThreadSafePlugin],
  code: String,
  meta_map: Arc<MetaMap>,
) -> String {
  for plugin in plugins.iter() {
    if let Some(hook) = &plugin.render_chunk {
      let context = Context::new(Arc::clone(&meta_map));
      let resolved: Result<Either<Promise<Option<String>>, Option<String>>> =
        hook.call_async((code.clone(), context)).await;
      if let Ok(resolved) = resolved {
        let resolved = match resolved {
          Either::A(resolved) => resolved.await.ok().flatten(),
          Either::B(resolved) => resolved,
        };
        if let Some(resolved) = resolved {
          return resolved;
        }
      }
    }
  }
  code
}

pub type MetaMap = DashMap<String, DashMap<String, Value>>;

#[napi]
pub struct Context {
  meta_map: Arc<MetaMap>,
}

#[napi]
impl Context {
  pub fn new(meta_map: Arc<MetaMap>) -> Self {
    Self { meta_map }
  }

  #[napi]
  pub fn get_module_info(&self, id: String) -> ModuleInfo {
    let meta = ProxyWrapper::new(Meta {
      id,
      map: Arc::clone(&self.meta_map),
    });
    ModuleInfo { meta }
  }
}

#[napi(object)]
pub struct ModuleInfo {
  #[napi(writable = false)]
  pub meta: ProxyWrapper<Meta>,
}

#[derive(Default, Clone)]
#[napi]
pub struct Meta {
  id: String,
  map: Arc<MetaMap>,
}

#[napi]
impl Meta {
  #[napi]
  pub fn get(&self, key: String) -> Value {
    if let Some(meta) = self.map.get(&self.id) {
      if let Some(value) = meta.get(&key) {
        return value.clone();
      }
    }
    Value::Undefined
  }

  #[napi]
  pub fn set(&self, key: String, value: Value) {
    let entry = self.map.entry(self.id.clone()).or_default();
    entry.insert(key.clone(), value);
  }
}

impl ProxyWrapable for Meta {
  type V = Value;
  fn get(&self, key: String) -> Self::V {
    self.get(key)
  }
  fn set(&self, key: String, value: Self::V) {
    self.set(key, value)
  }
}

impl FromNapiValue for Meta {
  unsafe fn from_napi_value(
    _env: napi::sys::napi_env,
    _napi_val: napi::sys::napi_value,
  ) -> Result<Self> {
    Err(Error::from_status(Status::InvalidArg))
  }
}
