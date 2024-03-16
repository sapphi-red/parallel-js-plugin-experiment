use napi::{threadsafe_function::{ThreadSafeCallContext, ThreadsafeFunction}, JsFunction};

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

pub fn convert_plugins_to_thread_safe_plugins(plugins: Vec<Plugin>) -> Vec<ThreadSafePlugin> {
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
