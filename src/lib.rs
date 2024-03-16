#![deny(clippy::all)]

pub mod direct_worker_bundler;
pub mod direct_worker_bundler_creator;
pub mod plugins;
pub mod simple_bundler;
pub mod result;

#[macro_use]
extern crate napi_derive;
#[macro_use]
extern crate lazy_static;
