//! Integration tests using real Wallpaper Engine PKG and TEX files.

use repkg::package::PackageReader;
use repkg::texture::{OutputFormat, TexReader, TexToImageConverter};
use repkg_core::{MipmapFormat, TexFlags, TexFormat, TexImageContainerVersion};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

// ============================================================================
// PKG Tests
// ============================================================================

#[test]
fn test_read_pkg_file() {
    let pkg_path = fixtures_dir().join("scene.pkg");
    if !pkg_path.exists() {
        eprintln!("Skipping test: fixture not found at {:?}", pkg_path);
        return;
    }

    let bytes = fs::read(&pkg_path).expect("Failed to read PKG file");
    let reader = PackageReader::new();
    let package = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse PKG");

    // Verify package structure
    assert_eq!(package.magic, "PKGV0019");
    assert_eq!(package.entries.len(), 18);

    // Check for expected files
    let entry_paths: Vec<&str> = package.entries.iter().map(|e| e.full_path.as_str()).collect();

    assert!(entry_paths.contains(&"scene.json"));
    assert!(entry_paths.contains(&"materials/Reze poster.tex"));
    assert!(entry_paths.contains(&"materials/masks/waterwaves_mask_b95b17e8.tex"));
    assert!(entry_paths.contains(&"shaders/effects/waterwaves.vert"));
}

#[test]
fn test_pkg_entry_types() {
    let pkg_path = fixtures_dir().join("scene.pkg");
    if !pkg_path.exists() {
        return;
    }

    let bytes = fs::read(&pkg_path).expect("Failed to read PKG file");
    let reader = PackageReader::new();
    let package = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse PKG");

    // Count entry types
    let tex_count = package
        .entries
        .iter()
        .filter(|e| e.full_path.ends_with(".tex"))
        .count();
    let json_count = package
        .entries
        .iter()
        .filter(|e| e.full_path.ends_with(".json"))
        .count();
    let shader_count = package
        .entries
        .iter()
        .filter(|e| {
            e.full_path.ends_with(".vert")
                || e.full_path.ends_with(".frag")
                || e.full_path.ends_with(".glsl")
        })
        .count();

    assert_eq!(tex_count, 3, "Expected 3 TEX files");
    assert_eq!(json_count, 11, "Expected 11 JSON files");
    assert_eq!(shader_count, 4, "Expected 4 shader files");
}

#[test]
fn test_pkg_extract_entry() {
    let pkg_path = fixtures_dir().join("scene.pkg");
    if !pkg_path.exists() {
        return;
    }

    let bytes = fs::read(&pkg_path).expect("Failed to read PKG file");
    let reader = PackageReader::new();
    let package = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse PKG");

    // Find and extract scene.json
    let scene_entry = package
        .entries
        .iter()
        .find(|e| e.full_path == "scene.json")
        .expect("scene.json not found");

    let entry_bytes = scene_entry
        .bytes
        .as_ref()
        .expect("Entry bytes not loaded");

    // Verify it's valid JSON
    let json_str = String::from_utf8(entry_bytes.clone()).expect("Invalid UTF-8");
    let _: serde_json::Value = serde_json::from_str(&json_str).expect("Invalid JSON");
}

// ============================================================================
// TEX Tests - Embedded PNG Image
// ============================================================================

#[test]
fn test_read_tex_embedded_png() {
    let tex_path = fixtures_dir().join("image.tex");
    if !tex_path.exists() {
        eprintln!("Skipping test: fixture not found at {:?}", tex_path);
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    // Verify header
    assert_eq!(tex.magic1, "TEXV0005");
    assert_eq!(tex.magic2, "TEXI0001");
    assert_eq!(tex.header.format, TexFormat::RGBA8888);
    assert!(tex.header.flags.contains(TexFlags::CLAMP_UVS));
    assert_eq!(tex.header.texture_width, 4096);
    assert_eq!(tex.header.texture_height, 4096);
    assert_eq!(tex.header.image_width, 3840);
    assert_eq!(tex.header.image_height, 2160);

    // Verify container
    assert_eq!(
        tex.images_container.version,
        TexImageContainerVersion::Version3
    );
    assert_eq!(tex.images_container.images.len(), 1);

    // Verify mipmaps (embedded PNG has multiple mipmap levels)
    let image = tex.first_image().expect("No image");
    assert!(image.mipmaps.len() >= 1);

    let mipmap = image.first_mipmap().expect("No mipmap");
    assert_eq!(mipmap.format, MipmapFormat::ImagePNG);
    assert_eq!(mipmap.width, 3840);
    assert_eq!(mipmap.height, 2160);

    // Verify PNG magic in data
    assert!(mipmap.bytes.len() > 8);
    assert_eq!(&mipmap.bytes[0..8], b"\x89PNG\r\n\x1a\n");
}

#[test]
fn test_convert_tex_embedded_png_to_png() {
    let tex_path = fixtures_dir().join("image.tex");
    if !tex_path.exists() {
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    let converter = TexToImageConverter::new();
    let result = converter
        .convert(&tex, OutputFormat::Png)
        .expect("Failed to convert");

    assert_eq!(result.format, OutputFormat::Png);
    assert!(result.bytes.len() > 1000); // Should be a substantial PNG

    // Verify PNG magic
    assert_eq!(&result.bytes[0..8], b"\x89PNG\r\n\x1a\n");

    // Verify we can decode it
    let img = image::load_from_memory(&result.bytes).expect("Failed to decode PNG");
    assert_eq!(img.width(), 3840);
    assert_eq!(img.height(), 2160);
}

// ============================================================================
// TEX Tests - Raw R8 Grayscale Mask
// ============================================================================

#[test]
fn test_read_tex_r8_mask() {
    let tex_path = fixtures_dir().join("mask.tex");
    if !tex_path.exists() {
        eprintln!("Skipping test: fixture not found at {:?}", tex_path);
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    // Verify header
    assert_eq!(tex.magic1, "TEXV0005");
    assert_eq!(tex.magic2, "TEXI0001");
    // Note: Header says RG88 but actual data is R8 (this is a known quirk)
    assert_eq!(tex.header.format, TexFormat::RG88);
    assert_eq!(tex.header.texture_width, 1920);
    assert_eq!(tex.header.texture_height, 1080);

    // Verify container
    assert_eq!(
        tex.images_container.version,
        TexImageContainerVersion::Version3
    );
    assert_eq!(tex.images_container.images.len(), 1);

    // Verify mipmap
    let image = tex.first_image().expect("No image");
    let mipmap = image.first_mipmap().expect("No mipmap");
    assert_eq!(mipmap.width, 1920);
    assert_eq!(mipmap.height, 1080);

    // After LZ4 decompression, data should be 1 byte per pixel (R8)
    // The converter will infer the correct format from the data size
    let expected_r8_size = 1920 * 1080; // 1 byte per pixel
    assert_eq!(
        mipmap.bytes.len(),
        expected_r8_size,
        "Expected R8 data (1 byte per pixel)"
    );
}

#[test]
fn test_convert_tex_r8_mask_to_png() {
    let tex_path = fixtures_dir().join("mask.tex");
    if !tex_path.exists() {
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    let converter = TexToImageConverter::new();
    let result = converter
        .convert(&tex, OutputFormat::Png)
        .expect("Failed to convert mask");

    assert_eq!(result.format, OutputFormat::Png);
    assert!(result.bytes.len() > 100);

    // Verify PNG magic
    assert_eq!(&result.bytes[0..8], b"\x89PNG\r\n\x1a\n");

    // Verify we can decode it as grayscale
    let img = image::load_from_memory(&result.bytes).expect("Failed to decode PNG");
    assert_eq!(img.width(), 1920);
    assert_eq!(img.height(), 1080);
}

// ============================================================================
// Format Conversion Tests
// ============================================================================

#[test]
fn test_convert_to_jpeg() {
    let tex_path = fixtures_dir().join("image.tex");
    if !tex_path.exists() {
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    let converter = TexToImageConverter::new().with_quality(85);
    let result = converter
        .convert(&tex, OutputFormat::Jpeg)
        .expect("Failed to convert to JPEG");

    assert_eq!(result.format, OutputFormat::Jpeg);

    // Verify JPEG magic (FFD8FF)
    assert!(result.bytes.len() > 3);
    assert_eq!(result.bytes[0], 0xFF);
    assert_eq!(result.bytes[1], 0xD8);
    assert_eq!(result.bytes[2], 0xFF);

    // Verify dimensions
    let img = image::load_from_memory(&result.bytes).expect("Failed to decode JPEG");
    assert_eq!(img.width(), 3840);
    assert_eq!(img.height(), 2160);
}

#[test]
fn test_convert_to_webp() {
    let tex_path = fixtures_dir().join("image.tex");
    if !tex_path.exists() {
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    let converter = TexToImageConverter::new();
    let result = converter
        .convert(&tex, OutputFormat::WebP)
        .expect("Failed to convert to WebP");

    assert_eq!(result.format, OutputFormat::WebP);

    // Verify WebP magic (RIFF....WEBP)
    assert!(result.bytes.len() > 12);
    assert_eq!(&result.bytes[0..4], b"RIFF");
    assert_eq!(&result.bytes[8..12], b"WEBP");
}

// ============================================================================
// Edge Cases
// ============================================================================

#[test]
fn test_tex_reader_without_decompression() {
    let tex_path = fixtures_dir().join("mask.tex");
    if !tex_path.exists() {
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::without_decompression();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    let mipmap = tex
        .first_image()
        .and_then(|i| i.first_mipmap())
        .expect("No mipmap");

    // Data should still be LZ4 compressed
    assert!(mipmap.is_lz4_compressed);
    // Compressed size should be much smaller than decompressed
    assert!(mipmap.bytes.len() < mipmap.decompressed_bytes_count as usize);
}

#[test]
fn test_recommended_format() {
    let tex_path = fixtures_dir().join("image.tex");
    if !tex_path.exists() {
        return;
    }

    let bytes = fs::read(&tex_path).expect("Failed to read TEX file");
    let reader = TexReader::new();
    let tex = reader
        .read_from(&mut Cursor::new(&bytes))
        .expect("Failed to parse TEX");

    let converter = TexToImageConverter::new();
    let recommended = converter.recommended_format(&tex);

    // Static image should recommend PNG
    assert_eq!(recommended, OutputFormat::Png);
}
