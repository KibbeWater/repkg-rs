//! TEX to image conversion.

use image::{
    codecs::gif::{GifEncoder, Repeat},
    imageops::FilterType,
    DynamicImage, Frame, ImageBuffer, ImageFormat, Luma, LumaA, RgbaImage,
};
use repkg_core::{MipmapFormat, Tex, TexMipmap};
use std::io::Cursor;
use std::time::Duration;

use crate::error::{Error, Result};

/// Output format for converted images.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum OutputFormat {
    /// PNG (lossless, supports transparency)
    Png,
    /// JPEG (lossy, no transparency)
    Jpeg,
    /// GIF (for animations)
    Gif,
    /// WebP (modern format)
    WebP,
    /// BMP (uncompressed)
    Bmp,
    /// TIFF (high quality)
    Tiff,
    /// TGA/Targa
    Tga,
    /// MP4 video (passthrough only)
    Mp4,
}

impl OutputFormat {
    /// Get the file extension for this format.
    pub fn extension(&self) -> &'static str {
        match self {
            OutputFormat::Png => "png",
            OutputFormat::Jpeg => "jpg",
            OutputFormat::Gif => "gif",
            OutputFormat::WebP => "webp",
            OutputFormat::Bmp => "bmp",
            OutputFormat::Tiff => "tiff",
            OutputFormat::Tga => "tga",
            OutputFormat::Mp4 => "mp4",
        }
    }

    /// Parse from a string, returning None for unknown formats.
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "png" => Some(OutputFormat::Png),
            "jpg" | "jpeg" => Some(OutputFormat::Jpeg),
            "gif" => Some(OutputFormat::Gif),
            "webp" => Some(OutputFormat::WebP),
            "bmp" => Some(OutputFormat::Bmp),
            "tiff" | "tif" => Some(OutputFormat::Tiff),
            "tga" | "targa" => Some(OutputFormat::Tga),
            "mp4" => Some(OutputFormat::Mp4),
            _ => None,
        }
    }

    /// Get all available formats.
    pub fn all() -> &'static [OutputFormat] {
        &[
            OutputFormat::Png,
            OutputFormat::Jpeg,
            OutputFormat::Gif,
            OutputFormat::WebP,
            OutputFormat::Bmp,
            OutputFormat::Tiff,
            OutputFormat::Tga,
        ]
    }
}

impl std::fmt::Display for OutputFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.extension())
    }
}

/// Result of a texture conversion.
#[derive(Debug)]
pub struct ConversionResult {
    /// The converted image bytes.
    pub bytes: Vec<u8>,
    /// The format of the converted image.
    pub format: OutputFormat,
}

/// Converter for TEX textures to standard image formats.
#[derive(Debug, Clone, Copy)]
pub struct TexToImageConverter {
    /// Quality for lossy formats (0-100)
    pub quality: u8,
}

impl TexToImageConverter {
    /// Create a new converter with default settings.
    pub fn new() -> Self {
        Self { quality: 90 }
    }

    /// Set the quality for lossy formats.
    pub fn with_quality(mut self, quality: u8) -> Self {
        self.quality = quality.min(100);
        self
    }

    /// Get the recommended output format for a texture.
    pub fn recommended_format(&self, tex: &Tex) -> OutputFormat {
        if tex.is_video() {
            OutputFormat::Mp4
        } else if tex.is_gif() {
            OutputFormat::Gif
        } else {
            OutputFormat::Png
        }
    }

    /// Convert a texture to an image.
    pub fn convert(&self, tex: &Tex, format: OutputFormat) -> Result<ConversionResult> {
        // Handle video textures
        if tex.is_video() {
            return self.convert_video(tex);
        }

        // Handle animated GIF textures
        if tex.is_gif() {
            return self.convert_gif(tex, format);
        }

        // Handle static textures
        self.convert_static(tex, format)
    }

    /// Convert a video texture (passthrough).
    fn convert_video(&self, tex: &Tex) -> Result<ConversionResult> {
        let mipmap = tex
            .first_image()
            .and_then(|img| img.first_mipmap())
            .ok_or_else(|| Error::invalid_data("Video texture has no data"))?;

        // Verify MP4 magic
        if mipmap.bytes.len() >= 12 {
            let magic = &mipmap.bytes[4..12];
            let magic_str = String::from_utf8_lossy(magic);
            if !magic_str.starts_with("ftyp") {
                return Err(Error::invalid_data("Expected MP4 magic header"));
            }
        }

        Ok(ConversionResult {
            bytes: mipmap.bytes.clone(),
            format: OutputFormat::Mp4,
        })
    }

    /// Convert a static texture.
    fn convert_static(&self, tex: &Tex, format: OutputFormat) -> Result<ConversionResult> {
        let mipmap = tex
            .first_image()
            .and_then(|img| img.first_mipmap())
            .ok_or_else(|| Error::invalid_data("Texture has no image data"))?;

        // If the mipmap is already an image format, we might be able to passthrough
        if mipmap.format.is_image() {
            return self.convert_embedded_image(mipmap, format);
        }

        // Convert raw pixel data to image
        let image = self.mipmap_to_image(mipmap)?;

        // Crop if needed
        let image = if tex.header.needs_crop() {
            let (crop_w, crop_h) = tex.header.crop_dimensions();
            image.crop_imm(0, 0, crop_w, crop_h)
        } else {
            image
        };

        // Encode to requested format
        self.encode_image(&image, format)
    }

    /// Convert an embedded image format.
    fn convert_embedded_image(
        &self,
        mipmap: &TexMipmap,
        format: OutputFormat,
    ) -> Result<ConversionResult> {
        // Try to decode the embedded image
        let image = image::load_from_memory(&mipmap.bytes)?;

        // If same format, passthrough
        if self.formats_match(mipmap.format, format) {
            return Ok(ConversionResult {
                bytes: mipmap.bytes.clone(),
                format,
            });
        }

        // Otherwise re-encode
        self.encode_image(&image, format)
    }

    /// Check if mipmap format matches output format.
    fn formats_match(&self, mipmap_fmt: MipmapFormat, output_fmt: OutputFormat) -> bool {
        matches!(
            (mipmap_fmt, output_fmt),
            (MipmapFormat::ImagePNG, OutputFormat::Png)
                | (MipmapFormat::ImageJPEG, OutputFormat::Jpeg)
                | (MipmapFormat::ImageGIF, OutputFormat::Gif)
                | (MipmapFormat::ImageWEBP, OutputFormat::WebP)
                | (MipmapFormat::ImageBMP, OutputFormat::Bmp)
                | (MipmapFormat::ImageTIFF, OutputFormat::Tiff)
                | (MipmapFormat::ImageTGA, OutputFormat::Tga)
        )
    }

    /// Convert a mipmap to a DynamicImage.
    fn mipmap_to_image(&self, mipmap: &TexMipmap) -> Result<DynamicImage> {
        let width = mipmap.width;
        let height = mipmap.height;
        let pixel_count = (width as usize) * (height as usize);
        let data_size = mipmap.bytes.len();

        // Infer the actual format from data size, as the header format can be incorrect
        // This handles cases where the TEX header says RG88 but the data is actually R8
        let actual_format = self.infer_format_from_size(mipmap.format, pixel_count, data_size);

        match actual_format {
            MipmapFormat::RGBA8888 => {
                let img: RgbaImage = ImageBuffer::from_raw(width, height, mipmap.bytes.clone())
                    .ok_or_else(|| {
                        Error::invalid_data("Invalid RGBA8888 data size for dimensions")
                    })?;
                Ok(DynamicImage::ImageRgba8(img))
            }
            MipmapFormat::R8 => {
                let img: ImageBuffer<Luma<u8>, Vec<u8>> =
                    ImageBuffer::from_raw(width, height, mipmap.bytes.clone()).ok_or_else(
                        || Error::invalid_data("Invalid R8 data size for dimensions"),
                    )?;
                Ok(DynamicImage::ImageLuma8(img))
            }
            MipmapFormat::RG88 => {
                let img: ImageBuffer<LumaA<u8>, Vec<u8>> =
                    ImageBuffer::from_raw(width, height, mipmap.bytes.clone()).ok_or_else(
                        || Error::invalid_data("Invalid RG88 data size for dimensions"),
                    )?;
                Ok(DynamicImage::ImageLumaA8(img))
            }
            _ => Err(Error::UnsupportedMipmapFormat {
                format: mipmap.format,
            }),
        }
    }

    /// Infer the actual pixel format from data size.
    /// Sometimes TEX headers report incorrect formats (e.g., RG88 when data is actually R8).
    fn infer_format_from_size(
        &self,
        declared_format: MipmapFormat,
        pixel_count: usize,
        data_size: usize,
    ) -> MipmapFormat {
        // Check if the declared format matches the data size
        let declared_bpp = declared_format.bytes_per_pixel();
        if let Some(bpp) = declared_bpp {
            if data_size == pixel_count * (bpp as usize) {
                return declared_format;
            }
        }

        // Infer format from actual data size
        if data_size == pixel_count * 4 {
            MipmapFormat::RGBA8888
        } else if data_size == pixel_count * 2 {
            MipmapFormat::RG88
        } else if data_size == pixel_count {
            MipmapFormat::R8
        } else {
            // Can't determine, return original
            declared_format
        }
    }

    /// Convert an animated GIF texture.
    fn convert_gif(&self, tex: &Tex, format: OutputFormat) -> Result<ConversionResult> {
        let frame_info = tex
            .frame_info_container
            .as_ref()
            .ok_or_else(|| Error::invalid_data("GIF texture missing frame info"))?;

        if tex.images_container.images.is_empty() {
            return Err(Error::invalid_data("GIF texture has no images"));
        }

        // Convert all source images
        let mut source_images: Vec<DynamicImage> = Vec::new();
        for image in &tex.images_container.images {
            if let Some(mipmap) = image.first_mipmap() {
                let img = if mipmap.format.is_image() {
                    image::load_from_memory(&mipmap.bytes)?
                } else {
                    self.mipmap_to_image(mipmap)?
                };
                source_images.push(img);
            }
        }

        if source_images.is_empty() {
            return Err(Error::invalid_data("No valid images in GIF texture"));
        }

        // Build frames
        let mut frames: Vec<Frame> = Vec::new();

        for frame_info in &frame_info.frames {
            let source_idx = frame_info.image_id as usize;
            if source_idx >= source_images.len() {
                continue;
            }

            let source = &source_images[source_idx];
            let (crop_x, crop_y, crop_w, crop_h) = frame_info.crop_rect();

            // Crop the frame from the source atlas
            let cropped = source.crop_imm(crop_x, crop_y, crop_w, crop_h);

            // Apply rotation if needed
            let rotation_deg = (frame_info.rotation_angle() * 180.0 / std::f64::consts::PI).round();
            let rotated = if rotation_deg.abs() > 1.0 {
                match rotation_deg as i32 {
                    90 | -270 => cropped.rotate90(),
                    180 | -180 => cropped.rotate180(),
                    270 | -90 => cropped.rotate270(),
                    _ => cropped, // For non-90-degree rotations, skip (would need interpolation)
                }
            } else {
                cropped
            };

            // Resize to target dimensions if needed
            let final_frame = if rotated.width() != frame_info.gif_width()
                || rotated.height() != frame_info.gif_height()
            {
                rotated.resize_exact(
                    frame_info.gif_width(),
                    frame_info.gif_height(),
                    FilterType::Lanczos3,
                )
            } else {
                rotated
            };

            // Create frame with delay
            let delay_ms = (frame_info.frametime * 1000.0) as u32;
            let frame = Frame::from_parts(
                final_frame.to_rgba8(),
                0,
                0,
                image::Delay::from_saturating_duration(Duration::from_millis(delay_ms as u64)),
            );
            frames.push(frame);
        }

        if frames.is_empty() {
            return Err(Error::invalid_data("No frames could be extracted from GIF"));
        }

        // For non-GIF output, just return the first frame
        if format != OutputFormat::Gif {
            let first_frame = &frames[0];
            let img = DynamicImage::ImageRgba8(first_frame.buffer().clone());
            return self.encode_image(&img, format);
        }

        // Encode as GIF
        let mut output = Vec::new();
        {
            let mut encoder = GifEncoder::new_with_speed(&mut output, 10);
            encoder.set_repeat(Repeat::Infinite)?;
            encoder.encode_frames(frames.into_iter())?;
        }

        Ok(ConversionResult {
            bytes: output,
            format: OutputFormat::Gif,
        })
    }

    /// Encode an image to the specified format.
    fn encode_image(&self, image: &DynamicImage, format: OutputFormat) -> Result<ConversionResult> {
        let mut output = Vec::new();

        match format {
            OutputFormat::Png => {
                image.write_to(&mut Cursor::new(&mut output), ImageFormat::Png)?;
            }
            OutputFormat::Jpeg => {
                // JPEG encoder with quality
                let encoder =
                    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, self.quality);
                image.write_with_encoder(encoder)?;
            }
            OutputFormat::Gif => {
                image.write_to(&mut Cursor::new(&mut output), ImageFormat::Gif)?;
            }
            OutputFormat::WebP => {
                image.write_to(&mut Cursor::new(&mut output), ImageFormat::WebP)?;
            }
            OutputFormat::Bmp => {
                image.write_to(&mut Cursor::new(&mut output), ImageFormat::Bmp)?;
            }
            OutputFormat::Tiff => {
                image.write_to(&mut Cursor::new(&mut output), ImageFormat::Tiff)?;
            }
            OutputFormat::Tga => {
                image.write_to(&mut Cursor::new(&mut output), ImageFormat::Tga)?;
            }
            OutputFormat::Mp4 => {
                return Err(Error::invalid_data("Cannot encode static image as MP4"));
            }
        }

        Ok(ConversionResult {
            bytes: output,
            format,
        })
    }
}

impl Default for TexToImageConverter {
    fn default() -> Self {
        Self::new()
    }
}

// Extension trait for TexFrameInfo
trait TexFrameInfoExt {
    fn gif_width(&self) -> u32;
    fn gif_height(&self) -> u32;
}

impl TexFrameInfoExt for repkg_core::TexFrameInfo {
    fn gif_width(&self) -> u32 {
        self.actual_width() as u32
    }

    fn gif_height(&self) -> u32 {
        self.actual_height() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_output_format_extension() {
        assert_eq!(OutputFormat::Png.extension(), "png");
        assert_eq!(OutputFormat::Jpeg.extension(), "jpg");
        assert_eq!(OutputFormat::Gif.extension(), "gif");
    }

    #[test]
    fn test_output_format_from_str() {
        assert_eq!(OutputFormat::parse("png"), Some(OutputFormat::Png));
        assert_eq!(OutputFormat::parse("PNG"), Some(OutputFormat::Png));
        assert_eq!(OutputFormat::parse("jpg"), Some(OutputFormat::Jpeg));
        assert_eq!(OutputFormat::parse("jpeg"), Some(OutputFormat::Jpeg));
        assert_eq!(OutputFormat::parse("unknown"), None);
    }
}
