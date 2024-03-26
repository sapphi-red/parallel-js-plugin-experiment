use napi::{
  bindgen_prelude::Promise, threadsafe_function::{ ThreadSafeCallContext, ThreadsafeFunction}, Either, Env, JsFunction, Result,
  threadsafe_function::ErrorStrategy,
};

#[napi(object)]
pub struct Plugin {
  pub name: String,
  #[napi(ts_type = "(source: string) => Promise<string | undefined>")]
  pub resolve_id: Option<JsFunction>,
}

pub struct ThreadSafePlugin {
  pub name: String,
  pub resolve_id: Option<ThreadsafeFunction<String, ErrorStrategy::Fatal>>,
}

/// Only pass env when env is main thread
pub fn convert_plugins_to_thread_safe_plugins(env: Option<&Env>, plugins: Vec<Plugin>) -> Vec<ThreadSafePlugin> {
  plugins
    .into_iter()
    .map(|p| ThreadSafePlugin {
      name: p.name,
      resolve_id: p.resolve_id.and_then(|resolve_id| {
        let mut func = resolve_id
          .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| {
            ctx.env.create_string(&ctx.value).map(|v| vec![v])
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

pub async fn resolve_id(plugins: &Vec<ThreadSafePlugin>, id: String) -> String {
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
  return "fallback".to_string();
}
