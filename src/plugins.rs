use std::sync::Arc;

use napi::{
  bindgen_prelude::{block_on, Promise}, threadsafe_function::{ ErrorStrategy, ThreadSafeCallContext, ThreadsafeFunction}, Either, Env, JsFunction, Result
};

#[napi]
pub struct MainTheadProxy {
  cb: Arc<ThreadsafeFunction<String, ErrorStrategy::Fatal>>
}

#[napi]
impl MainTheadProxy {
  pub fn new(cb: Arc<ThreadsafeFunction<String, ErrorStrategy::Fatal>>) -> Self {
    Self { cb }
  }

  // NOTE: I guess this should not be called from the main thread otherwise it will lead to deadlock
  #[napi(getter)]
  pub fn foo(&self) -> String {
    block_on(async {
      self.cb.call_async::<String>("foo".to_string()).await
    }).unwrap()
  }
}

#[napi(object)]
pub struct Plugin {
  pub name: String,
  #[napi(ts_type = "(source: string, mainThreadProxy?: MainThreadProxy) => Promise<string | undefined>")]
  pub resolve_id: Option<JsFunction>,
}

pub struct ThreadSafePlugin {
  pub name: String,
  pub resolve_id: Option<ThreadsafeFunction<(String, Option<MainTheadProxy>), ErrorStrategy::Fatal>>,
}

/// Only pass env when env is main thread
pub fn convert_plugins_to_thread_safe_plugins(env: Option<&Env>, plugins: Vec<Plugin>) -> Vec<ThreadSafePlugin> {
  plugins
    .into_iter()
    .map(|p| ThreadSafePlugin {
      name: p.name,
      resolve_id: p.resolve_id.and_then(|resolve_id| {
        let mut func = resolve_id
          .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<(String, Option<MainTheadProxy>)>| {
            let v: Vec<Either<String, Option<MainTheadProxy>>> = vec![Either::A(ctx.value.0), Either::B(ctx.value.1)];
            Ok(v)
          })
          .unwrap();
        if let Some(env) = env {
          _ = func.unref(env);
        }

        Some(func)
      }),
    })
    .collect()
}

pub async fn resolve_id(plugins: &Vec<ThreadSafePlugin>, id: String, cb: Option<Arc<ThreadsafeFunction<String, ErrorStrategy::Fatal>>>) -> String {
  for plugin in plugins.iter() {
    if let Some(hook) = &plugin.resolve_id {
      let resolved: Result<Either<Promise<Option<String>>, Option<String>>> =
        hook.call_async((id.clone(), cb.clone().map(|cb| { MainTheadProxy::new(cb) }))).await;
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
  return "fallback".to_string();
}
