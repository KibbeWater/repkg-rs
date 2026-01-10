//! Mipmap decompression (LZ4 and DXT).

use repkg_core::{MipmapFormat, TexMipmap};

use crate::error::{Error, Result};

/// Decompressor for mipmap data.
#[derive(Debug, Clone, Copy)]
pub struct MipmapDecompressor;

impl MipmapDecompressor {
    /// Create a new decompressor.
    pub fn new() -> Self {
        Self
    }

    /// Decompress mipmap data in place.
    ///
    /// This handles both LZ4 decompression and DXT texture decompression.
    pub fn decompress(&self, mipmap: &mut TexMipmap) -> Result<()> {
        // First, LZ4 decompress if needed
        if mipmap.is_lz4_compressed {
            self.decompress_lz4(mipmap)?;
        }

        // Then, DXT decompress if needed
        if mipmap.format.is_compressed() {
            self.decompress_dxt(mipmap)?;
        }

        Ok(())
    }

    /// Decompress LZ4-compressed data.
    fn decompress_lz4(&self, mipmap: &mut TexMipmap) -> Result<()> {
        if mipmap.decompressed_bytes_count == 0 {
            return Ok(());
        }

        let decompressed = lz4_flex::decompress(
            &mipmap.bytes,
            mipmap.decompressed_bytes_count as usize,
        )
        .map_err(|e| Error::Lz4Decompression {
            message: e.to_string(),
        })?;

        mipmap.bytes = decompressed;
        mipmap.is_lz4_compressed = false;
        Ok(())
    }

    /// Decompress DXT-compressed texture data.
    fn decompress_dxt(&self, mipmap: &mut TexMipmap) -> Result<()> {
        let width = mipmap.width as usize;
        let height = mipmap.height as usize;
        let pixel_count = width * height;

        let rgba = match mipmap.format {
            MipmapFormat::CompressedDXT1 => {
                let mut output = vec![0u32; pixel_count];
                texture2ddecoder::decode_bc1(&mipmap.bytes, width, height, &mut output)
                    .map_err(|e| Error::DxtDecompression {
                        details: format!("DXT1/BC1 decompression failed: {}", e),
                    })?;
                u32_to_rgba_bytes(output)
            }
            MipmapFormat::CompressedDXT3 => {
                // BC2 is DXT3 - texture2ddecoder doesn't have decode_bc2
                // DXT3 is rare in Wallpaper Engine, return error for now
                return Err(Error::DxtDecompression {
                    details: "DXT3/BC2 decompression not yet supported".to_string(),
                });
            }
            MipmapFormat::CompressedDXT5 => {
                let mut output = vec![0u32; pixel_count];
                texture2ddecoder::decode_bc3(&mipmap.bytes, width, height, &mut output)
                    .map_err(|e| Error::DxtDecompression {
                        details: format!("DXT5/BC3 decompression failed: {}", e),
                    })?;
                u32_to_rgba_bytes(output)
            }
            _ => return Ok(()), // Not a compressed format
        };

        mipmap.bytes = rgba;
        mipmap.format = MipmapFormat::RGBA8888;
        Ok(())
    }
}

/// Convert u32 RGBA pixels to byte array.
fn u32_to_rgba_bytes(pixels: Vec<u32>) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(pixels.len() * 4);
    for pixel in pixels {
        // texture2ddecoder returns RGBA as u32 in native endian
        bytes.push((pixel & 0xFF) as u8);         // R
        bytes.push(((pixel >> 8) & 0xFF) as u8);  // G
        bytes.push(((pixel >> 16) & 0xFF) as u8); // B
        bytes.push(((pixel >> 24) & 0xFF) as u8); // A
    }
    bytes
}

impl Default for MipmapDecompressor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decompressor_creation() {
        let decompressor = MipmapDecompressor::new();
        assert!(std::mem::size_of_val(&decompressor) == 0);
    }

    #[test]
    fn test_decompress_uncompressed() {
        let decompressor = MipmapDecompressor::new();
        let mut mipmap = TexMipmap {
            width: 4,
            height: 4,
            format: MipmapFormat::RGBA8888,
            is_lz4_compressed: false,
            decompressed_bytes_count: 0,
            bytes: vec![0u8; 64],
        };

        // Should succeed without modifying anything
        decompressor.decompress(&mut mipmap).unwrap();
        assert_eq!(mipmap.bytes.len(), 64);
        assert_eq!(mipmap.format, MipmapFormat::RGBA8888);
    }
}
