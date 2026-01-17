//! WebAssembly bindings for repkg.
//!
//! This crate provides JavaScript-friendly APIs for parsing and converting
//! Wallpaper Engine PKG and TEX files in the browser.

use repkg::package::PackageReader;
use repkg::texture::{OutputFormat, TexReader, TexToImageConverter};
use repkg_core::{Package, Tex};
use serde::Serialize;
use std::io::Cursor;
use wasm_bindgen::prelude::*;

#[macro_use]
pub mod log;

#[cfg(feature = "console-log")]
pub use log::{clear_log_callback, set_log_callback};

/// Initialize panic hook for better error messages in browser console.
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ============================================================================
// Data Types
// ============================================================================

/// Information about a PKG package.
#[derive(Serialize)]
pub struct PkgInfo {
    pub magic: String,
    pub entry_count: usize,
    pub entries: Vec<PkgEntryInfo>,
}

/// Information about a single entry in a PKG package.
#[derive(Serialize)]
pub struct PkgEntryInfo {
    pub path: String,
    pub size: u32,
    pub entry_type: String,
}

/// An extracted file from a PKG package.
#[derive(Serialize)]
pub struct ExtractedFile {
    pub path: String,
    pub data: Vec<u8>,
}

/// Information about a TEX texture.
#[derive(Serialize)]
pub struct TexInfo {
    pub width: u32,
    pub height: u32,
    pub texture_width: u32,
    pub texture_height: u32,
    pub format: String,
    pub is_gif: bool,
    pub is_video: bool,
    pub mipmap_count: usize,
}

// ============================================================================
// Log Data Structures (only used when console-log feature is enabled)
// ============================================================================

#[cfg(feature = "console-log")]
#[derive(Serialize)]
struct PkgParseLog {
    magic: String,
    version: String,
    header_size_bytes: u32,
    entry_count: usize,
    total_data_bytes: u64,
    texture_count: usize,
    json_count: usize,
    shader_count: usize,
    other_count: usize,
}

#[cfg(feature = "console-log")]
#[derive(Serialize)]
struct TexParseLog {
    container_version: String,
    format: String,
    flags: u32,
    dimensions: String,
    texture_dimensions: String,
    image_format: String,
    is_lz4_compressed: bool,
    mipmap_count: usize,
    total_mipmap_bytes: usize,
}

#[cfg(feature = "console-log")]
#[derive(Serialize)]
struct TexConvertLog {
    input_format: String,
    output_format: String,
    dimensions: String,
    input_bytes: usize,
    output_bytes: usize,
    compression_ratio: f32,
}

#[cfg(feature = "console-log")]
#[derive(Serialize)]
struct ExtractLog {
    entry_count: usize,
    total_bytes: usize,
}

// ============================================================================
// PKG Functions
// ============================================================================

/// Parse a PKG file and return information about its contents.
#[wasm_bindgen]
pub fn parse_pkg(bytes: &[u8]) -> Result<JsValue, JsError> {
    let reader = PackageReader::new();
    let package = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    // Log parsing details
    #[cfg(feature = "console-log")]
    {
        let texture_count = package
            .entries
            .iter()
            .filter(|e| matches!(e.entry_type, repkg_core::EntryType::Tex))
            .count();
        let json_count = package
            .entries
            .iter()
            .filter(|e| matches!(e.entry_type, repkg_core::EntryType::Json))
            .count();
        let shader_count = package
            .entries
            .iter()
            .filter(|e| matches!(e.entry_type, repkg_core::EntryType::Shader))
            .count();
        let other_count = package
            .entries
            .iter()
            .filter(|e| matches!(e.entry_type, repkg_core::EntryType::Other))
            .count();
        let total_data: u64 = package.entries.iter().map(|e| e.length as u64).sum();

        wasm_info!(
            "pkg_parse",
            &PkgParseLog {
                magic: package.magic.clone(),
                version: package.magic.chars().skip(4).collect(),
                header_size_bytes: package.header_size,
                entry_count: package.entries.len(),
                total_data_bytes: total_data,
                texture_count,
                json_count,
                shader_count,
                other_count,
            }
        );
    }

    let info = pkg_to_info(&package);
    serde_wasm_bindgen::to_value(&info).map_err(|e| JsError::new(&e.to_string()))
}

/// Extract a single entry from a PKG file by path.
#[wasm_bindgen]
pub fn extract_pkg_entry(bytes: &[u8], path: &str) -> Result<Vec<u8>, JsError> {
    let reader = PackageReader::new();
    let package = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    let entry = package
        .entries
        .iter()
        .find(|e| e.full_path == path)
        .ok_or_else(|| JsError::new(&format!("Entry not found: {}", path)))?;

    entry
        .bytes
        .clone()
        .ok_or_else(|| JsError::new("Entry has no data"))
}

/// Extract all entries from a PKG file.
/// Returns an array of { path: string, data: Uint8Array } objects.
#[wasm_bindgen]
pub fn extract_all_pkg(bytes: &[u8]) -> Result<JsValue, JsError> {
    let reader = PackageReader::new();
    let package = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    let files: Vec<ExtractedFile> = package
        .entries
        .iter()
        .filter_map(|entry| {
            entry.bytes.as_ref().map(|data| ExtractedFile {
                path: entry.full_path.clone(),
                data: data.clone(),
            })
        })
        .collect();

    serde_wasm_bindgen::to_value(&files).map_err(|e| JsError::new(&e.to_string()))
}

/// Extract selected entries from a PKG file.
/// `paths` should be a JavaScript array of strings.
#[wasm_bindgen]
pub fn extract_selected_pkg(bytes: &[u8], paths: Vec<String>) -> Result<JsValue, JsError> {
    let reader = PackageReader::new();
    let package = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    let files: Vec<ExtractedFile> = package
        .entries
        .iter()
        .filter(|entry| paths.contains(&entry.full_path))
        .filter_map(|entry| {
            entry.bytes.as_ref().map(|data| ExtractedFile {
                path: entry.full_path.clone(),
                data: data.clone(),
            })
        })
        .collect();

    // Log extraction details
    #[cfg(feature = "console-log")]
    {
        let total_bytes: usize = files.iter().map(|f| f.data.len()).sum();
        wasm_info!(
            "pkg_extract",
            &ExtractLog {
                entry_count: files.len(),
                total_bytes,
            }
        );
    }

    serde_wasm_bindgen::to_value(&files).map_err(|e| JsError::new(&e.to_string()))
}

// ============================================================================
// TEX Functions
// ============================================================================

/// Parse a TEX file and return information about it.
#[wasm_bindgen]
pub fn parse_tex(bytes: &[u8]) -> Result<JsValue, JsError> {
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    // Log parsing details
    #[cfg(feature = "console-log")]
    {
        let mipmap_count = tex.first_image().map(|i| i.mipmap_count()).unwrap_or(0);
        let total_mipmap_bytes: usize = tex
            .first_image()
            .map(|img| img.mipmaps.iter().map(|m| m.bytes.len()).sum())
            .unwrap_or(0);
        let is_lz4 = tex
            .first_image()
            .and_then(|img| img.mipmaps.first())
            .map(|m| m.is_lz4_compressed)
            .unwrap_or(false);

        wasm_info!(
            "tex_parse",
            &TexParseLog {
                container_version: format!("{:?}", tex.images_container.version),
                format: format!("{:?}", tex.header.format),
                flags: tex.header.flags.bits(),
                dimensions: format!("{}x{}", tex.header.image_width, tex.header.image_height),
                texture_dimensions: format!(
                    "{}x{}",
                    tex.header.texture_width, tex.header.texture_height
                ),
                image_format: format!("{:?}", tex.images_container.image_format),
                is_lz4_compressed: is_lz4,
                mipmap_count,
                total_mipmap_bytes,
            }
        );
    }

    let info = tex_to_info(&tex);
    serde_wasm_bindgen::to_value(&info).map_err(|e| JsError::new(&e.to_string()))
}

/// Convert a TEX file to an image format.
/// Supported formats: "png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tga"
#[wasm_bindgen]
pub fn convert_tex(bytes: &[u8], format: &str) -> Result<Vec<u8>, JsError> {
    #[cfg(feature = "console-log")]
    let input_len = bytes.len();

    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    let output_format = OutputFormat::parse(format)
        .ok_or_else(|| JsError::new(&format!("Unsupported format: {}", format)))?;

    let converter = TexToImageConverter::new();
    let result = converter
        .convert(&tex, output_format)
        .map_err(|e| JsError::new(&e.to_string()))?;

    // Log conversion details
    #[cfg(feature = "console-log")]
    {
        let output_len = result.bytes.len();
        wasm_info!(
            "tex_convert",
            &TexConvertLog {
                input_format: format!("{:?}", tex.header.format),
                output_format: format.to_uppercase(),
                dimensions: format!("{}x{}", tex.header.image_width, tex.header.image_height),
                input_bytes: input_len,
                output_bytes: output_len,
                compression_ratio: if input_len > 0 {
                    output_len as f32 / input_len as f32
                } else {
                    0.0
                },
            }
        );
    }

    Ok(result.bytes)
}

/// Video data location info for zero-copy extraction.
#[derive(Serialize)]
pub struct VideoDataInfo {
    pub is_video: bool,
    pub data_offset: u64,
    pub data_size: u32,
}

/// Get video data location from a TEX file without reading the actual video bytes.
/// Returns { is_video: bool, data_offset: number, data_size: number }.
/// If is_video is true, you can use bytes.slice(data_offset, data_offset + data_size)
/// to get the MP4 data directly without WASM memory overhead.
#[wasm_bindgen]
pub fn get_video_data_location(bytes: &[u8]) -> Result<JsValue, JsError> {
    // Create a reader that only reads headers, not mipmap data
    let reader = TexReader::headers_only();
    let tex = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    if !tex.is_video() {
        let info = VideoDataInfo {
            is_video: false,
            data_offset: 0,
            data_size: 0,
        };
        return serde_wasm_bindgen::to_value(&info).map_err(|e| JsError::new(&e.to_string()));
    }

    // Get the video data location from the mipmap metadata
    let mipmap = tex
        .first_image()
        .and_then(|img| img.first_mipmap())
        .ok_or_else(|| JsError::new("Video texture has no data"))?;

    let info = VideoDataInfo {
        is_video: true,
        data_offset: mipmap.file_offset,
        data_size: mipmap.original_byte_count,
    };
    serde_wasm_bindgen::to_value(&info).map_err(|e| JsError::new(&e.to_string()))
}

/// Convert a TEX file to its recommended format (PNG for images, GIF for animations, MP4 for video).
#[wasm_bindgen]
pub fn convert_tex_auto(bytes: &[u8]) -> Result<ConvertResult, JsError> {
    #[cfg(feature = "console-log")]
    let input_len = bytes.len();

    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(bytes))
        .map_err(|e| JsError::new(&e.to_string()))?;

    let converter = TexToImageConverter::new();
    let format = converter.recommended_format(&tex);

    let result = converter
        .convert(&tex, format)
        .map_err(|e| JsError::new(&e.to_string()))?;

    // Log conversion details
    #[cfg(feature = "console-log")]
    {
        let output_len = result.bytes.len();
        wasm_info!(
            "tex_convert_auto",
            &TexConvertLog {
                input_format: format!("{:?}", tex.header.format),
                output_format: result.format.extension().to_uppercase(),
                dimensions: format!("{}x{}", tex.header.image_width, tex.header.image_height),
                input_bytes: input_len,
                output_bytes: output_len,
                compression_ratio: if input_len > 0 {
                    output_len as f32 / input_len as f32
                } else {
                    0.0
                },
            }
        );
    }

    Ok(ConvertResult {
        data: result.bytes,
        format: result.format.extension().to_string(),
        mime_type: format_to_mime(result.format),
    })
}

/// Result of automatic TEX conversion.
#[wasm_bindgen]
pub struct ConvertResult {
    data: Vec<u8>,
    format: String,
    mime_type: String,
}

#[wasm_bindgen]
impl ConvertResult {
    /// Take the converted image data as bytes (consumes the data).
    /// This is more efficient than cloning for large files.
    pub fn take_data(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.data)
    }

    /// Get the file extension (e.g., "png", "gif", "mp4").
    #[wasm_bindgen(getter)]
    pub fn format(&self) -> String {
        self.format.clone()
    }

    /// Get the MIME type (e.g., "image/png", "video/mp4").
    #[wasm_bindgen(getter)]
    pub fn mime_type(&self) -> String {
        self.mime_type.clone()
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn pkg_to_info(package: &Package) -> PkgInfo {
    PkgInfo {
        magic: package.magic.clone(),
        entry_count: package.entries.len(),
        entries: package
            .entries
            .iter()
            .map(|e| PkgEntryInfo {
                path: e.full_path.clone(),
                size: e.length,
                entry_type: entry_type_string(&e.entry_type),
            })
            .collect(),
    }
}

fn entry_type_string(entry_type: &repkg_core::EntryType) -> String {
    match entry_type {
        repkg_core::EntryType::Tex => "texture".to_string(),
        repkg_core::EntryType::Json => "json".to_string(),
        repkg_core::EntryType::Shader => "shader".to_string(),
        repkg_core::EntryType::Other => "other".to_string(),
    }
}

fn tex_to_info(tex: &Tex) -> TexInfo {
    let mipmap_count = tex.first_image().map(|img| img.mipmap_count()).unwrap_or(0);

    TexInfo {
        width: tex.header.image_width,
        height: tex.header.image_height,
        texture_width: tex.header.texture_width,
        texture_height: tex.header.texture_height,
        format: format!("{:?}", tex.header.format),
        is_gif: tex.is_gif(),
        is_video: tex.is_video(),
        mipmap_count,
    }
}

fn format_to_mime(format: OutputFormat) -> String {
    match format {
        OutputFormat::Png => "image/png".to_string(),
        OutputFormat::Jpeg => "image/jpeg".to_string(),
        OutputFormat::Gif => "image/gif".to_string(),
        OutputFormat::WebP => "image/webp".to_string(),
        OutputFormat::Bmp => "image/bmp".to_string(),
        OutputFormat::Tiff => "image/tiff".to_string(),
        OutputFormat::Tga => "image/x-targa".to_string(),
        OutputFormat::Mp4 => "video/mp4".to_string(),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_to_mime() {
        assert_eq!(format_to_mime(OutputFormat::Png), "image/png");
        assert_eq!(format_to_mime(OutputFormat::Mp4), "video/mp4");
    }
}
