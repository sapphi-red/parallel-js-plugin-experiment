use std::mem::size_of;

use napi::{
  bindgen_prelude::{FromNapiValue, ToNapiValue},
  Env, Error, JsExternal, JsFunction, JsObject, NapiRaw, Result, Status,
};

pub trait ProxyWrapable {
  type V: ToNapiValue + FromNapiValue;

  fn get(&self, key: String) -> Self::V;
  fn set(&self, key: String, value: Self::V);
}

pub struct ProxyWrapper<T: ProxyWrapable> {
  inner: T,
}

impl<T: ProxyWrapable> ProxyWrapper<T> {
  pub fn new(inner: T) -> Self {
    Self { inner }
  }
}

impl<T: ProxyWrapable + 'static> ToNapiValue for ProxyWrapper<T> {
  unsafe fn to_napi_value(env: napi::sys::napi_env, val: Self) -> Result<napi::sys::napi_value> {
    // new Proxy({ inner: External(Meta) }, {
    //   get(target, key, receiver) {
    //     return target.inner.get(key);
    //   },
    //   set(target, key, value) {
    //     return target.inner.set(key, value);
    //   }
    // })

    let env = Env::from_raw(env);
    let global = env.get_global()?;
    let constructor: JsFunction = global.get_named_property_unchecked("Proxy")?;

    let inner = env.create_external(val.inner, Some(size_of::<T>() as i64))?;

    let mut target = env.create_object()?;
    target.set_named_property("_inner", inner)?;

    let get = env.create_function_from_closure("get", |ctx| {
      let target: JsObject = ctx.get(0)?;
      let inner_external: JsExternal = target.get_named_property("_inner")?;
      let inner: &mut T = ctx.env.get_value_external(&inner_external)?;
      let key: String = ctx.get(1)?;
      ToNapiValue::to_napi_value(ctx.env.raw(), inner.get(key))
    })?;
    let set = env.create_function_from_closure("set", |ctx| {
      let target: JsObject = ctx.get(0)?;
      let inner_external: JsExternal = target.get_named_property("_inner")?;
      let inner: &mut T = ctx.env.get_value_external(&inner_external)?;
      let key: String = ctx.get(1)?;
      let value: T::V = ctx.get(2)?;
      inner.set(key, value);
      ctx.env.get_boolean(true)
    });

    let mut handler = env.create_object()?;
    handler.set_named_property("get", get)?;
    handler.set_named_property("set", set)?;

    let proxy = constructor.new_instance(&[target, handler])?;
    Ok(proxy.raw())
  }
}

impl<T: ProxyWrapable> FromNapiValue for ProxyWrapper<T> {
  unsafe fn from_napi_value(
    _env: napi::sys::napi_env,
    _napi_val: napi::sys::napi_value,
  ) -> Result<Self> {
    Err(Error::from_status(Status::InvalidArg))
  }
}
