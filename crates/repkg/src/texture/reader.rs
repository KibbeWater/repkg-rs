//! TEX texture reader implementation.

use byteorder::{LittleEndian, ReadBytesExt};
use repkg_core::{
    FreeImageFormat, MipmapFormat, Tex, TexFlags, TexFormat, TexFrameInfo, TexFrameInfoContainer,
    TexHeader, TexImage, TexImageContainer, TexImageContainerVersion, TexMipmap,
};
use std::io::{Read, Seek};

use super::MipmapDecompressor;
use crate::error::{Error, Result};

/// Safety limits.
const MAX_IMAGE_COUNT: u32 = 1000;
const MAX_MIPMAP_COUNT: u32 = 20;
const MAX_MIPMAP_SIZE: u32 = 512 * 1024 * 1024; // 512 MB
const MAX_FRAME_COUNT: u32 = 10000;

/// Reader for Wallpaper Engine TEX files.
#[derive(Debug, Clone)]
pub struct TexReader {
    /// Whether to read mipmap bytes
    pub read_mipmap_bytes: bool,
    /// Whether to decompress mipmaps after reading
    pub decompress_mipmaps: bool,
}

impl TexReader {
    /// Create a new TEX reader.
    pub fn new() -> Self {
        Self {
            read_mipmap_bytes: true,
            decompress_mipmaps: true,
        }
    }

    /// Create a reader that doesn't decompress mipmaps.
    pub fn without_decompression() -> Self {
        Self {
            read_mipmap_bytes: true,
            decompress_mipmaps: false,
        }
    }

    /// Read a TEX file from a reader.
    pub fn read_from<R: Read + Seek>(&self, reader: &mut R) -> Result<Tex> {
        // Read magic strings
        let magic1 = read_null_terminated_string(reader, 16)?;
        if magic1 != "TEXV0005" {
            return Err(Error::InvalidTexMagic {
                expected: "TEXV0005",
                found: magic1,
            });
        }

        let magic2 = read_null_terminated_string(reader, 16)?;
        if magic2 != "TEXI0001" {
            return Err(Error::InvalidTexMagic {
                expected: "TEXI0001",
                found: magic2,
            });
        }

        // Read header
        let header = self.read_header(reader)?;

        // Read image container
        let images_container = self.read_image_container(reader, header.format)?;

        // Read frame info if this is a GIF
        let frame_info_container = if header.flags.contains(TexFlags::IS_GIF) {
            Some(self.read_frame_info_container(reader)?)
        } else {
            None
        };

        Ok(Tex {
            magic1,
            magic2,
            header,
            images_container,
            frame_info_container,
        })
    }

    /// Read the TEX header.
    fn read_header<R: Read>(&self, reader: &mut R) -> Result<TexHeader> {
        let format = TexFormat::from(reader.read_u32::<LittleEndian>()?);
        let flags = TexFlags::from_bits_truncate(reader.read_u32::<LittleEndian>()?);
        let texture_width = reader.read_u32::<LittleEndian>()?;
        let texture_height = reader.read_u32::<LittleEndian>()?;
        let image_width = reader.read_u32::<LittleEndian>()?;
        let image_height = reader.read_u32::<LittleEndian>()?;
        let unk_int0 = reader.read_u32::<LittleEndian>()?;

        Ok(TexHeader {
            format,
            flags,
            texture_width,
            texture_height,
            image_width,
            image_height,
            unk_int0,
        })
    }

    /// Read the image container.
    fn read_image_container<R: Read + Seek>(
        &self,
        reader: &mut R,
        tex_format: TexFormat,
    ) -> Result<TexImageContainer> {
        // Read container magic
        let container_magic = read_null_terminated_string(reader, 16)?;
        let version = TexImageContainerVersion::from_magic(&container_magic);

        if !version.is_supported() {
            return Err(Error::UnsupportedContainerVersion {
                version: container_magic,
            });
        }

        // Read first field (may be a flag or image format depending on version)
        let first_field = reader.read_i32::<LittleEndian>()?;
        
        // For Version 3+, read additional fields
        // The structure appears to be: flag(4) + image_format(4) + mipmap_count(4)
        // where mipmap_count is for a single implicit image
        let (image_format, mipmap_count) = if matches!(
            version,
            TexImageContainerVersion::Version3 | TexImageContainerVersion::Version4
        ) {
            let second_field = reader.read_i32::<LittleEndian>()?;
            let third_field = reader.read_u32::<LittleEndian>()?;
            
            // The second field is likely the actual FreeImageFormat
            // (13 = PNG, etc.), while first_field is a flag
            let fmt = if (0..=36).contains(&second_field) {
                FreeImageFormat::from(second_field)
            } else {
                FreeImageFormat::from(first_field)
            };
            
            (fmt, third_field)
        } else {
            // For older versions, first_field is image_format
            let image_count = reader.read_u32::<LittleEndian>()?;
            (FreeImageFormat::from(first_field), image_count)
        };

        if mipmap_count > MAX_IMAGE_COUNT {
            return Err(Error::safety_limit(format!(
                "Mipmap count {} exceeds maximum {}",
                mipmap_count, MAX_IMAGE_COUNT
            )));
        }

        // Determine mipmap format
        let mut container = TexImageContainer {
            version: version.clone(),
            image_format,
            images: Vec::new(),
        };
        let mipmap_format = container.mipmap_format(tex_format);

        // For Version 3 with embedded image formats, treat mipmap_count as the number
        // of mipmaps in a single image (no per-image mipmap count in the file)
        if matches!(
            version,
            TexImageContainerVersion::Version3 | TexImageContainerVersion::Version4
        ) {
            let image = self.read_image_direct_mipmaps(reader, &version, mipmap_format, mipmap_count)?;
            container.images.push(image);
        } else {
            // For older versions, read images with per-image mipmap count
            for _ in 0..mipmap_count {
                let image = self.read_image(reader, &version, mipmap_format)?;
                container.images.push(image);
            }
        }

        Ok(container)
    }

    /// Read an image where mipmap count is provided externally (V3+ format).
    fn read_image_direct_mipmaps<R: Read + Seek>(
        &self,
        reader: &mut R,
        version: &TexImageContainerVersion,
        mipmap_format: MipmapFormat,
        mipmap_count: u32,
    ) -> Result<TexImage> {
        let mut image = TexImage {
            mipmaps: Vec::with_capacity(mipmap_count as usize),
        };

        let decompressor = MipmapDecompressor::new();

        for _ in 0..mipmap_count {
            let mut mipmap = self.read_mipmap(reader, version)?;
            mipmap.format = mipmap_format;

            if self.decompress_mipmaps && mipmap.has_data() {
                decompressor.decompress(&mut mipmap)?;
            }

            image.mipmaps.push(mipmap);
        }

        Ok(image)
    }

    /// Read a single image with its mipmaps.
    fn read_image<R: Read + Seek>(
        &self,
        reader: &mut R,
        version: &TexImageContainerVersion,
        mipmap_format: MipmapFormat,
    ) -> Result<TexImage> {
        let mipmap_count = reader.read_u32::<LittleEndian>()?;
        if mipmap_count > MAX_MIPMAP_COUNT {
            return Err(Error::safety_limit(format!(
                "Mipmap count {} exceeds maximum {}",
                mipmap_count, MAX_MIPMAP_COUNT
            )));
        }

        let mut image = TexImage {
            mipmaps: Vec::with_capacity(mipmap_count as usize),
        };

        let decompressor = MipmapDecompressor::new();

        for _ in 0..mipmap_count {
            let mut mipmap = self.read_mipmap(reader, version)?;
            mipmap.format = mipmap_format;

            if self.decompress_mipmaps && mipmap.has_data() {
                decompressor.decompress(&mut mipmap)?;
            }

            image.mipmaps.push(mipmap);
        }

        Ok(image)
    }

    /// Read a single mipmap.
    fn read_mipmap<R: Read + Seek>(
        &self,
        reader: &mut R,
        version: &TexImageContainerVersion,
    ) -> Result<TexMipmap> {
        match version {
            TexImageContainerVersion::Version1 => self.read_mipmap_v1(reader),
            TexImageContainerVersion::Version2 | TexImageContainerVersion::Version3 => {
                self.read_mipmap_v2_v3(reader)
            }
            TexImageContainerVersion::Version4 => self.read_mipmap_v4(reader),
            TexImageContainerVersion::Unknown(_) => Err(Error::UnsupportedContainerVersion {
                version: format!("{:?}", version),
            }),
        }
    }

    /// Read a V1 mipmap.
    fn read_mipmap_v1<R: Read>(&self, reader: &mut R) -> Result<TexMipmap> {
        let width = reader.read_u32::<LittleEndian>()?;
        let height = reader.read_u32::<LittleEndian>()?;
        let bytes = self.read_mipmap_bytes(reader)?;

        Ok(TexMipmap {
            width,
            height,
            format: MipmapFormat::Invalid,
            is_lz4_compressed: false,
            decompressed_bytes_count: 0,
            bytes,
        })
    }

    /// Read a V2/V3 mipmap.
    fn read_mipmap_v2_v3<R: Read>(&self, reader: &mut R) -> Result<TexMipmap> {
        let width = reader.read_u32::<LittleEndian>()?;
        let height = reader.read_u32::<LittleEndian>()?;
        let is_lz4_compressed = reader.read_u32::<LittleEndian>()? == 1;
        let decompressed_bytes_count = reader.read_u32::<LittleEndian>()?;
        let bytes = self.read_mipmap_bytes(reader)?;

        Ok(TexMipmap {
            width,
            height,
            format: MipmapFormat::Invalid,
            is_lz4_compressed,
            decompressed_bytes_count,
            bytes,
        })
    }

    /// Read a V4 mipmap (has extra parameters).
    fn read_mipmap_v4<R: Read>(&self, reader: &mut R) -> Result<TexMipmap> {
        // V4 has some extra parameters we skip
        let _param1 = reader.read_u32::<LittleEndian>()?;
        let _param2 = reader.read_u32::<LittleEndian>()?;
        let _condition_json = read_null_terminated_string(reader, 4096)?;
        let _param3 = reader.read_u32::<LittleEndian>()?;

        // Then same as V2/V3
        self.read_mipmap_v2_v3(reader)
    }

    /// Read mipmap bytes with length prefix.
    fn read_mipmap_bytes<R: Read>(&self, reader: &mut R) -> Result<Vec<u8>> {
        let byte_count = reader.read_u32::<LittleEndian>()?;

        if byte_count > MAX_MIPMAP_SIZE {
            return Err(Error::safety_limit(format!(
                "Mipmap size {} exceeds maximum {}",
                byte_count, MAX_MIPMAP_SIZE
            )));
        }

        if !self.read_mipmap_bytes {
            // Skip the bytes
            let mut remaining = byte_count as usize;
            let mut buf = [0u8; 8192];
            while remaining > 0 {
                let to_read = remaining.min(buf.len());
                reader.read_exact(&mut buf[..to_read])?;
                remaining -= to_read;
            }
            return Ok(Vec::new());
        }

        let mut bytes = vec![0u8; byte_count as usize];
        reader.read_exact(&mut bytes)?;
        Ok(bytes)
    }

    /// Read frame info container for animated textures.
    fn read_frame_info_container<R: Read>(&self, reader: &mut R) -> Result<TexFrameInfoContainer> {
        // Read magic
        let magic = read_null_terminated_string(reader, 16)?;
        if magic != "TEXS0003" && magic != "TEXS0002" && magic != "TEXS0001" {
            return Err(Error::invalid_data(format!(
                "Invalid frame info magic: {}",
                magic
            )));
        }

        let gif_width = reader.read_u32::<LittleEndian>()?;
        let gif_height = reader.read_u32::<LittleEndian>()?;
        let _unk1 = reader.read_u32::<LittleEndian>()?;
        let frame_count = reader.read_u32::<LittleEndian>()?;

        if frame_count > MAX_FRAME_COUNT {
            return Err(Error::safety_limit(format!(
                "Frame count {} exceeds maximum {}",
                frame_count, MAX_FRAME_COUNT
            )));
        }

        let mut container = TexFrameInfoContainer::new(gif_width, gif_height);

        for _ in 0..frame_count {
            let image_id = reader.read_u32::<LittleEndian>()?;
            let frametime = reader.read_f32::<LittleEndian>()?;
            let x = reader.read_f32::<LittleEndian>()?;
            let y = reader.read_f32::<LittleEndian>()?;
            let width = reader.read_f32::<LittleEndian>()?;
            let height_x = reader.read_f32::<LittleEndian>()?;
            let width_y = reader.read_f32::<LittleEndian>()?;
            let height = reader.read_f32::<LittleEndian>()?;

            container.frames.push(TexFrameInfo {
                image_id,
                frametime,
                x,
                y,
                width,
                height,
                width_y,
                height_x,
            });
        }

        Ok(container)
    }
}

impl Default for TexReader {
    fn default() -> Self {
        Self::new()
    }
}

/// Read a null-terminated string with maximum length.
fn read_null_terminated_string<R: Read>(reader: &mut R, max_length: usize) -> Result<String> {
    let mut bytes = Vec::with_capacity(max_length.min(32));

    for _ in 0..max_length {
        let byte = reader.read_u8()?;
        if byte == 0 {
            break;
        }
        bytes.push(byte);
    }

    String::from_utf8(bytes).map_err(Error::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_read_null_terminated_string() {
        let data = b"TEXV0005\0extra";
        let mut cursor = Cursor::new(data);
        let result = read_null_terminated_string(&mut cursor, 16).unwrap();
        assert_eq!(result, "TEXV0005");
    }
}
