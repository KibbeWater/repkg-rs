//! Library for reading Wallpaper Engine PKG and TEX files.
//!
//! This crate provides parsers and converters for Wallpaper Engine's
//! proprietary file formats.

pub mod error;
pub mod package;
pub mod texture;

pub use error::{Error, Result};
pub use package::PackageReader;
pub use texture::{TexReader, TexToImageConverter};
