use napi::{
  bindgen_prelude::{FromNapiValue, Null, ToNapiValue, Undefined},
  Error, JsUnknown, NapiValue, Result, Status, ValueType,
};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum Value {
  Null,
  Undefined,
  String(String),
  Number(i64),
  Object(HashMap<String, Value>),
}

impl ToNapiValue for Value {
  unsafe fn to_napi_value(env: napi::sys::napi_env, val: Self) -> Result<napi::sys::napi_value> {
    match val {
      Value::Null => unsafe { Null::to_napi_value(env, Null) },
      Value::Undefined => unsafe { Undefined::to_napi_value(env, ()) },
      Value::String(str) => unsafe { String::to_napi_value(env, str) },
      Value::Number(num) => unsafe { i64::to_napi_value(env, num) },
      Value::Object(obj) => unsafe { HashMap::to_napi_value(env, obj) },
    }
  }
}

impl FromNapiValue for Value {
  unsafe fn from_napi_value(
    env: napi::sys::napi_env,
    napi_val: napi::sys::napi_value,
  ) -> Result<Self> {
    let unknown = JsUnknown::from_raw_unchecked(env, napi_val);
    let val = match unknown.get_type()? {
      ValueType::Null => Some(Value::Null),
      ValueType::Undefined => Some(Value::Undefined),
      ValueType::String => Some(Value::String(String::from_napi_value(env, napi_val)?)),
      ValueType::Number => Some(Value::Number(i64::from_napi_value(env, napi_val)?)),
      ValueType::Object => Some(Value::Object(HashMap::from_napi_value(env, napi_val)?)),
      _ => None,
    };
    let val = val.ok_or(Error::new(
      Status::GenericFailure,
      "encountered unknown value",
    ))?;
    Ok(val)
  }
}
