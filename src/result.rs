
#[napi(object)]
pub struct RunResult {
  pub len: u32,
  pub result: String,
}
