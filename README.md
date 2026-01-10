# repkg-rs

A Rust implementation for extracting and converting Wallpaper Engine PKG packages and TEX textures.

This is a cross-platform rewrite of [notscuffed/repkg](https://github.com/notscuffed/repkg), providing the same functionality with native support for Linux, macOS, and Windows.

## Features

- Extract files from Wallpaper Engine PKG packages
- Convert TEX textures to standard image formats (PNG, JPEG, WebP, GIF, BMP, TIFF, TGA)
- Support for various texture formats:
  - Embedded images (PNG, JPEG, etc.)
  - Raw pixel data (RGBA8888, R8, RG88)
  - DXT/BC compressed textures (DXT1/BC1, DXT5/BC3)
  - LZ4 compressed data
- Animated GIF texture support
- Video texture passthrough (MP4)
- Multi-threaded extraction with progress display
- Pure Rust - no external dependencies required

## Installation

### From source

```bash
git clone https://github.com/KibbeWater/repkg-rs
cd repkg-rs
cargo build --release
```

The binary will be at `target/release/repkg-rs`.

## Usage

### Extract PKG files

Extract all files from a PKG package:

```bash
repkg-rs extract scene.pkg -o output_dir
```

Extract with verbose output:

```bash
repkg-rs extract scene.pkg -o output_dir -v
```

Extract and convert TEX files to a specific format:

```bash
repkg-rs extract scene.pkg -o output_dir --format webp
```

### Convert standalone TEX files

Convert a single TEX file:

```bash
repkg-rs extract texture.tex -o output_dir
```

Convert to a specific format:

```bash
repkg-rs extract texture.tex -o output_dir --format jpeg --quality 90
```

### View file information

Display PKG package info:

```bash
repkg-rs info scene.pkg
```

Display TEX texture info:

```bash
repkg-rs info texture.tex
```

Output as JSON:

```bash
repkg-rs info scene.pkg --json
```

### Command-line options

```
repkg-rs extract [OPTIONS] <INPUT>...

Arguments:
  <INPUT>...  Input PKG or TEX files

Options:
  -o, --output <DIR>     Output directory [default: .]
  -f, --format <FORMAT>  Output image format [default: png]
                         Supported: png, jpg, gif, webp, bmp, tiff, tga
  -q, --quality <N>      JPEG quality (1-100) [default: 90]
  -j, --jobs <N>         Number of parallel jobs [default: CPU count]
      --overwrite        Overwrite existing files
      --no-convert       Extract TEX files without converting
      --single-dir       Extract all files to a single directory
      --only <EXT>       Only extract files with these extensions
      --ignore <EXT>     Ignore files with these extensions
  -v, --verbose          Verbose output
      --quiet            Suppress output
  -h, --help             Print help
```

## Library Usage

Add to your `Cargo.toml`:

```toml
[dependencies]
repkg = { path = "crates/repkg" }
repkg-core = { path = "crates/repkg-core" }
```

### Reading PKG files

```rust
use repkg::package::PackageReader;
use std::fs;
use std::io::Cursor;

let bytes = fs::read("scene.pkg")?;
let reader = PackageReader::new();
let package = reader.read_from(&mut Cursor::new(&bytes))?;

for entry in &package.entries {
    println!("{}: {} bytes", entry.full_path, entry.length);
    
    if let Some(data) = &entry.bytes {
        // Process entry data
    }
}
```

### Reading and converting TEX files

```rust
use repkg::texture::{TexReader, TexToImageConverter, OutputFormat};
use std::fs;
use std::io::Cursor;

let bytes = fs::read("texture.tex")?;
let reader = TexReader::new();
let tex = reader.read_from(&mut Cursor::new(&bytes))?;

println!("Format: {:?}", tex.header.format);
println!("Size: {}x{}", tex.header.image_width, tex.header.image_height);

let converter = TexToImageConverter::new();
let result = converter.convert(&tex, OutputFormat::Png)?;

fs::write("output.png", &result.bytes)?;
```

## Supported Formats

### PKG Package Format

- PKGV0019 (current Wallpaper Engine format)

### TEX Texture Formats

| Format | Description | Support |
|--------|-------------|---------|
| RGBA8888 | 32-bit RGBA | Full |
| R8 | 8-bit grayscale | Full |
| RG88 | 16-bit two-channel | Full |
| DXT1/BC1 | Compressed (no alpha) | Full |
| DXT3/BC2 | Compressed (sharp alpha) | Planned |
| DXT5/BC3 | Compressed (smooth alpha) | Full |

### TEX Container Versions

- TEXB0001, TEXB0002, TEXB0003, TEXB0004

### Embedded Image Formats

PNG, JPEG, GIF, WebP, BMP, TIFF, TGA

## Project Structure

```
repkg-rs/
├── crates/
│   ├── repkg-core/     # Core data types and structures
│   ├── repkg/          # Library for reading PKG/TEX files
│   └── repkg-cli/      # Command-line interface
├── tests/
│   └── fixtures/       # Test files
└── Cargo.toml          # Workspace configuration
```

## Building

Requirements:
- Rust 1.70 or later

```bash
# Debug build
cargo build

# Release build
cargo build --release

# Run tests
cargo test

# Run clippy
cargo clippy
```

## Differences from Original repkg

- Written in pure Rust (no .NET/C# dependency)
- Cross-platform support without Wine/Mono
- Parallel extraction support
- Handles edge cases in TEX format (e.g., header/data format mismatches)

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [notscuffed/repkg](https://github.com/notscuffed/repkg) - Original C# implementation
- Wallpaper Engine by Kristjan Skutta
