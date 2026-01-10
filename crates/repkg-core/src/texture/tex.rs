//! Core TEX texture types.

use super::enums::{FreeImageFormat, MipmapFormat, TexFlags, TexFormat, TexImageContainerVersion};
use super::frame_info::TexFrameInfoContainer;

/// A Wallpaper Engine TEX texture.
#[derive(Debug, Clone)]
pub struct Tex {
    /// First magic string (always "TEXV0005")
    pub magic1: String,
    /// Second magic string (always "TEXI0001")
    pub magic2: String,
    /// Texture header with format and dimension info
    pub header: TexHeader,
    /// Container holding the image data
    pub images_container: TexImageContainer,
    /// Optional frame info for animated textures
    pub frame_info_container: Option<TexFrameInfoContainer>,
}

impl Tex {
    /// Create a new TEX with the given header.
    pub fn new(header: TexHeader) -> Self {
        Self {
            magic1: "TEXV0005".to_string(),
            magic2: "TEXI0001".to_string(),
            header,
            images_container: TexImageContainer::new(),
            frame_info_container: None,
        }
    }

    /// Check if this texture contains GIF animation data.
    pub fn is_gif(&self) -> bool {
        self.header.flags.contains(TexFlags::IS_GIF)
    }

    /// Check if this texture contains video data.
    pub fn is_video(&self) -> bool {
        self.header.flags.contains(TexFlags::IS_VIDEO_TEXTURE)
    }

    /// Get the first image in the container.
    pub fn first_image(&self) -> Option<&TexImage> {
        self.images_container.images.first()
    }

    /// Get the first image mutably.
    pub fn first_image_mut(&mut self) -> Option<&mut TexImage> {
        self.images_container.images.first_mut()
    }

    /// Get the number of images in this texture.
    pub fn image_count(&self) -> usize {
        self.images_container.images.len()
    }

    /// Check if this texture has any image data.
    pub fn has_images(&self) -> bool {
        !self.images_container.images.is_empty()
    }
}

/// Header containing texture metadata.
#[derive(Debug, Clone, Copy)]
pub struct TexHeader {
    /// Pixel format of the texture
    pub format: TexFormat,
    /// Texture flags
    pub flags: TexFlags,
    /// Width of the texture (power of 2)
    pub texture_width: u32,
    /// Height of the texture (power of 2)
    pub texture_height: u32,
    /// Actual image width (may be smaller than texture)
    pub image_width: u32,
    /// Actual image height (may be smaller than texture)
    pub image_height: u32,
    /// Unknown field
    pub unk_int0: u32,
}

impl TexHeader {
    /// Create a new header with default values.
    pub fn new() -> Self {
        Self {
            format: TexFormat::RGBA8888,
            flags: TexFlags::NONE,
            texture_width: 0,
            texture_height: 0,
            image_width: 0,
            image_height: 0,
            unk_int0: 0,
        }
    }

    /// Check if the texture needs cropping (image != texture dimensions).
    pub fn needs_crop(&self) -> bool {
        self.image_width != self.texture_width || self.image_height != self.texture_height
    }

    /// Get the crop dimensions (width, height).
    pub fn crop_dimensions(&self) -> (u32, u32) {
        (self.image_width, self.image_height)
    }
}

impl Default for TexHeader {
    fn default() -> Self {
        Self::new()
    }
}

/// Container for texture images and mipmaps.
#[derive(Debug, Clone)]
pub struct TexImageContainer {
    /// Version of the container format
    pub version: TexImageContainerVersion,
    /// FreeImage format code
    pub image_format: FreeImageFormat,
    /// List of images (usually 1, but can be multiple for animated textures)
    pub images: Vec<TexImage>,
}

impl TexImageContainer {
    /// Create a new empty container.
    pub fn new() -> Self {
        Self {
            version: TexImageContainerVersion::Version3,
            image_format: FreeImageFormat::Unknown,
            images: Vec::new(),
        }
    }

    /// Get the format for mipmaps based on container settings.
    pub fn mipmap_format(&self, tex_format: TexFormat) -> MipmapFormat {
        // If the image format is set, use that
        let from_image_format = self.image_format.to_mipmap_format();
        if from_image_format != MipmapFormat::Invalid {
            return from_image_format;
        }

        // Otherwise derive from tex format
        match tex_format {
            TexFormat::RGBA8888 => MipmapFormat::RGBA8888,
            TexFormat::DXT1 => MipmapFormat::CompressedDXT1,
            TexFormat::DXT3 => MipmapFormat::CompressedDXT3,
            TexFormat::DXT5 => MipmapFormat::CompressedDXT5,
            TexFormat::R8 => MipmapFormat::R8,
            TexFormat::RG88 => MipmapFormat::RG88,
            TexFormat::Unknown(_) => MipmapFormat::Invalid,
        }
    }
}

impl Default for TexImageContainer {
    fn default() -> Self {
        Self::new()
    }
}

/// A single image within a texture (can have multiple mipmaps).
#[derive(Debug, Clone)]
pub struct TexImage {
    /// Mipmap levels (index 0 is the largest/original)
    pub mipmaps: Vec<TexMipmap>,
}

impl TexImage {
    /// Create a new empty image.
    pub fn new() -> Self {
        Self {
            mipmaps: Vec::new(),
        }
    }

    /// Get the first (largest) mipmap.
    pub fn first_mipmap(&self) -> Option<&TexMipmap> {
        self.mipmaps.first()
    }

    /// Get the first mipmap mutably.
    pub fn first_mipmap_mut(&mut self) -> Option<&mut TexMipmap> {
        self.mipmaps.first_mut()
    }

    /// Get the number of mipmap levels.
    pub fn mipmap_count(&self) -> usize {
        self.mipmaps.len()
    }
}

impl Default for TexImage {
    fn default() -> Self {
        Self::new()
    }
}

/// A single mipmap level within an image.
#[derive(Debug, Clone)]
pub struct TexMipmap {
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
    /// Format of the pixel data
    pub format: MipmapFormat,
    /// Whether the data is LZ4 compressed
    pub is_lz4_compressed: bool,
    /// Size of data after LZ4 decompression
    pub decompressed_bytes_count: u32,
    /// Raw byte data (may be compressed)
    pub bytes: Vec<u8>,
}

impl TexMipmap {
    /// Create a new empty mipmap.
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            format: MipmapFormat::Invalid,
            is_lz4_compressed: false,
            decompressed_bytes_count: 0,
            bytes: Vec::new(),
        }
    }

    /// Get the byte count of the data.
    pub fn byte_count(&self) -> usize {
        self.bytes.len()
    }

    /// Check if the mipmap has data.
    pub fn has_data(&self) -> bool {
        !self.bytes.is_empty()
    }

    /// Calculate the expected size for raw RGBA8888 data.
    pub fn expected_rgba_size(&self) -> usize {
        (self.width as usize) * (self.height as usize) * 4
    }

    /// Calculate the expected size based on format.
    pub fn expected_size(&self) -> usize {
        match self.format {
            MipmapFormat::RGBA8888 => (self.width as usize) * (self.height as usize) * 4,
            MipmapFormat::R8 => (self.width as usize) * (self.height as usize),
            MipmapFormat::RG88 => (self.width as usize) * (self.height as usize) * 2,
            MipmapFormat::CompressedDXT1 => {
                // DXT1: 8 bytes per 4x4 block
                let blocks_x = (self.width as usize).div_ceil(4);
                let blocks_y = (self.height as usize).div_ceil(4);
                blocks_x * blocks_y * 8
            }
            MipmapFormat::CompressedDXT3 | MipmapFormat::CompressedDXT5 => {
                // DXT3/DXT5: 16 bytes per 4x4 block
                let blocks_x = (self.width as usize).div_ceil(4);
                let blocks_y = (self.height as usize).div_ceil(4);
                blocks_x * blocks_y * 16
            }
            _ => self.bytes.len(),
        }
    }
}

impl Default for TexMipmap {
    fn default() -> Self {
        Self::new(0, 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tex_flags() {
        let header = TexHeader {
            format: TexFormat::RGBA8888,
            flags: TexFlags::IS_GIF,
            texture_width: 256,
            texture_height: 256,
            image_width: 200,
            image_height: 150,
            unk_int0: 0,
        };

        let tex = Tex::new(header);
        assert!(tex.is_gif());
        assert!(!tex.is_video());
    }

    #[test]
    fn test_header_crop() {
        let header = TexHeader {
            format: TexFormat::RGBA8888,
            flags: TexFlags::NONE,
            texture_width: 256,
            texture_height: 256,
            image_width: 200,
            image_height: 150,
            unk_int0: 0,
        };

        assert!(header.needs_crop());
        assert_eq!(header.crop_dimensions(), (200, 150));
    }

    #[test]
    fn test_mipmap_expected_size() {
        let mut mipmap = TexMipmap::new(256, 256);

        mipmap.format = MipmapFormat::RGBA8888;
        assert_eq!(mipmap.expected_size(), 256 * 256 * 4);

        mipmap.format = MipmapFormat::R8;
        assert_eq!(mipmap.expected_size(), 256 * 256);

        mipmap.format = MipmapFormat::CompressedDXT1;
        assert_eq!(mipmap.expected_size(), 64 * 64 * 8); // 64x64 blocks

        mipmap.format = MipmapFormat::CompressedDXT5;
        assert_eq!(mipmap.expected_size(), 64 * 64 * 16);
    }
}
