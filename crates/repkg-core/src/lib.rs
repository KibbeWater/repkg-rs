//! Core types for the repkg-rs library.
//!
//! This crate provides the fundamental data structures used to represent
//! Wallpaper Engine PKG packages and TEX texture files.

pub mod package;
pub mod texture;

pub use package::{EntryType, Package, PackageEntry};
pub use texture::{
    FreeImageFormat, MipmapFormat, Tex, TexFlags, TexFormat, TexFrameInfo, TexFrameInfoContainer,
    TexHeader, TexImage, TexImageContainer, TexImageContainerVersion, TexMipmap,
};
