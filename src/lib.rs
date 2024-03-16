#![deny(clippy::all)]

pub mod bundler;
pub mod bundler_creator;
pub mod plugins;

#[macro_use]
extern crate napi_derive;
#[macro_use]
extern crate lazy_static;
