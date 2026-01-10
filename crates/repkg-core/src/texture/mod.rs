//! Texture types for Wallpaper Engine TEX files.

mod enums;
mod frame_info;
mod tex;

pub use enums::{FreeImageFormat, MipmapFormat, TexFlags, TexFormat, TexImageContainerVersion};
pub use frame_info::{TexFrameInfo, TexFrameInfoContainer};
pub use tex::{Tex, TexHeader, TexImage, TexImageContainer, TexMipmap};
