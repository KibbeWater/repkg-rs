//! Info command implementation.

use anyhow::{Context, Result};
use clap::Args;
use colored::Colorize;
use repkg::{PackageReader, TexReader};
use repkg_core::{EntryType, Package, Tex};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{BufReader, Cursor};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Display information about PKG/TEX files
#[derive(Args, Debug)]
pub struct InfoArgs {
    /// Path to PKG/TEX file or directory
    #[arg(value_name = "INPUT")]
    pub input: PathBuf,

    /// Treat input as TEX file(s)
    #[arg(short = 't', long = "tex")]
    pub tex: bool,

    /// Print package entries
    #[arg(short = 'e', long = "entries")]
    pub entries: bool,

    /// Sort entries alphabetically
    #[arg(short = 's', long)]
    pub sort: bool,

    /// Sort by field (name, extension, size)
    #[arg(long = "sort-by", default_value = "name")]
    pub sort_by: String,

    /// Output as JSON
    #[arg(long)]
    pub json: bool,

    /// Recursively search directories
    #[arg(short = 'r', long)]
    pub recursive: bool,
}

pub fn run(args: InfoArgs, verbose: bool, quiet: bool) -> Result<()> {
    let input_path = &args.input;
    let metadata = fs::metadata(input_path)
        .with_context(|| format!("Failed to access input: {}", input_path.display()))?;

    if metadata.is_file() {
        info_file(&args, input_path, verbose, quiet)?;
    } else if metadata.is_dir() {
        info_directory(&args, input_path, verbose, quiet)?;
    } else {
        anyhow::bail!("Input is neither a file nor directory");
    }

    Ok(())
}

fn info_file(args: &InfoArgs, path: &Path, verbose: bool, quiet: bool) -> Result<()> {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    if args.tex || ext == "tex" {
        info_tex(args, path, verbose, quiet)
    } else if ext == "pkg" {
        info_pkg(args, path, verbose, quiet)
    } else {
        if !quiet {
            println!(
                "{} Unrecognized file extension: {}",
                "warning:".yellow(),
                ext
            );
        }
        Ok(())
    }
}

fn info_directory(args: &InfoArgs, dir: &Path, verbose: bool, quiet: bool) -> Result<()> {
    let pattern = if args.tex { "tex" } else { "pkg" };

    let files: Vec<PathBuf> = if args.recursive {
        WalkDir::new(dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.path()
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.eq_ignore_ascii_case(pattern))
                    .unwrap_or(false)
            })
            .map(|e| e.path().to_path_buf())
            .collect()
    } else {
        fs::read_dir(dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
            .filter(|e| {
                e.path()
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.eq_ignore_ascii_case(pattern))
                    .unwrap_or(false)
            })
            .map(|e| e.path())
            .collect()
    };

    if files.is_empty() {
        if !quiet {
            println!(
                "{} No {} files found in {}",
                "warning:".yellow(),
                pattern.to_uppercase(),
                dir.display()
            );
        }
        return Ok(());
    }

    for file in files {
        if args.tex {
            info_tex(args, &file, verbose, quiet)?;
        } else {
            info_pkg(args, &file, verbose, quiet)?;
        }
    }

    Ok(())
}

fn info_pkg(args: &InfoArgs, path: &Path, _verbose: bool, quiet: bool) -> Result<()> {
    let file = File::open(path).with_context(|| format!("Failed to open {}", path.display()))?;
    let mut reader = BufReader::new(file);

    let pkg_reader = PackageReader::info_only();
    let package = pkg_reader
        .read_from(&mut reader)
        .with_context(|| format!("Failed to read PKG: {}", path.display()))?;

    if args.json {
        let info = PkgInfo::from_package(&package, path, args);
        println!("{}", serde_json::to_string_pretty(&info)?);
    } else {
        print_pkg_info(&package, path, args, quiet);
    }

    Ok(())
}

fn info_tex(args: &InfoArgs, path: &Path, _verbose: bool, quiet: bool) -> Result<()> {
    let bytes = fs::read(path).with_context(|| format!("Failed to read {}", path.display()))?;

    let tex_reader = TexReader::without_decompression();
    let tex = tex_reader
        .read_from(&mut Cursor::new(&bytes))
        .with_context(|| format!("Failed to parse TEX: {}", path.display()))?;

    if args.json {
        let info = TexInfo::from_tex(&tex, path);
        println!("{}", serde_json::to_string_pretty(&info)?);
    } else {
        print_tex_info(&tex, path, quiet);
    }

    Ok(())
}

fn print_pkg_info(pkg: &Package, path: &Path, args: &InfoArgs, quiet: bool) {
    if quiet {
        return;
    }

    println!("\n{} {}", "Package:".cyan().bold(), path.display());
    println!("  Magic: {}", pkg.magic.yellow());
    println!("  Header size: {} bytes", pkg.header_size);
    println!("  Entry count: {}", pkg.entry_count());
    println!(
        "  Total data size: {} bytes",
        format_size(pkg.total_data_size())
    );

    // Count entries by type
    let tex_count = pkg
        .entries
        .iter()
        .filter(|e| e.entry_type == EntryType::Tex)
        .count();
    let json_count = pkg
        .entries
        .iter()
        .filter(|e| e.entry_type == EntryType::Json)
        .count();
    let shader_count = pkg
        .entries
        .iter()
        .filter(|e| e.entry_type == EntryType::Shader)
        .count();
    let other_count = pkg
        .entries
        .iter()
        .filter(|e| e.entry_type == EntryType::Other)
        .count();

    println!("  Entry types:");
    if tex_count > 0 {
        println!("    Textures: {}", tex_count.to_string().green());
    }
    if json_count > 0 {
        println!("    JSON: {}", json_count);
    }
    if shader_count > 0 {
        println!("    Shaders: {}", shader_count);
    }
    if other_count > 0 {
        println!("    Other: {}", other_count);
    }

    if args.entries {
        println!("\n  {}:", "Entries".cyan());

        let mut entries: Vec<_> = pkg.entries.iter().collect();

        if args.sort {
            match args.sort_by.as_str() {
                "extension" => entries.sort_by(|a, b| a.extension().cmp(b.extension())),
                "size" => entries.sort_by(|a, b| a.length.cmp(&b.length)),
                _ => entries.sort_by(|a, b| a.full_path.cmp(&b.full_path)),
            }
        }

        for entry in entries {
            println!(
                "    {} ({} bytes)",
                entry.full_path,
                format_size(entry.length as u64).dimmed()
            );
        }
    }
}

fn print_tex_info(tex: &Tex, path: &Path, quiet: bool) {
    if quiet {
        return;
    }

    println!("\n{} {}", "Texture:".cyan().bold(), path.display());
    println!("  Magic: {} / {}", tex.magic1.yellow(), tex.magic2.yellow());
    println!("  Format: {:?}", tex.header.format);
    println!("  Flags: {:?}", tex.header.flags);
    println!(
        "  Texture size: {}x{}",
        tex.header.texture_width, tex.header.texture_height
    );
    println!(
        "  Image size: {}x{}",
        tex.header.image_width, tex.header.image_height
    );
    println!("  Container version: {:?}", tex.images_container.version);
    println!("  Image format: {:?}", tex.images_container.image_format);
    println!("  Image count: {}", tex.image_count());

    if tex.is_gif() {
        println!("  Type: {} (animated)", "GIF".green());
        if let Some(frame_info) = &tex.frame_info_container {
            println!(
                "  GIF dimensions: {}x{}",
                frame_info.gif_width, frame_info.gif_height
            );
            println!("  Frame count: {}", frame_info.frame_count());
            println!("  Total duration: {:.2}s", frame_info.total_duration());
        }
    } else if tex.is_video() {
        println!("  Type: {} (video)", "MP4".blue());
    } else {
        println!("  Type: Static");
    }

    // Show mipmap info
    if let Some(first_image) = tex.first_image() {
        println!("  Mipmaps: {}", first_image.mipmap_count());
        for (i, mipmap) in first_image.mipmaps.iter().enumerate() {
            println!(
                "    [{}] {}x{}, {:?}, {} bytes",
                i,
                mipmap.width,
                mipmap.height,
                mipmap.format,
                format_size(mipmap.byte_count() as u64)
            );
        }
    }
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

// JSON output structures

#[derive(Serialize)]
struct PkgInfo {
    path: String,
    magic: String,
    header_size: u32,
    entry_count: usize,
    total_data_size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    entries: Option<Vec<PkgEntryInfo>>,
}

#[derive(Serialize)]
struct PkgEntryInfo {
    path: String,
    offset: u32,
    length: u32,
    entry_type: String,
}

impl PkgInfo {
    fn from_package(pkg: &Package, path: &Path, args: &InfoArgs) -> Self {
        let entries = if args.entries {
            Some(
                pkg.entries
                    .iter()
                    .map(|e| PkgEntryInfo {
                        path: e.full_path.clone(),
                        offset: e.offset,
                        length: e.length,
                        entry_type: e.entry_type.as_str().to_string(),
                    })
                    .collect(),
            )
        } else {
            None
        };

        Self {
            path: path.display().to_string(),
            magic: pkg.magic.clone(),
            header_size: pkg.header_size,
            entry_count: pkg.entry_count(),
            total_data_size: pkg.total_data_size(),
            entries,
        }
    }
}

#[derive(Serialize)]
struct TexInfo {
    path: String,
    magic1: String,
    magic2: String,
    format: String,
    flags: u32,
    texture_width: u32,
    texture_height: u32,
    image_width: u32,
    image_height: u32,
    is_gif: bool,
    is_video: bool,
    image_count: usize,
    container_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    frame_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_duration: Option<f32>,
}

impl TexInfo {
    fn from_tex(tex: &Tex, path: &Path) -> Self {
        let (frame_count, total_duration) = if let Some(fi) = &tex.frame_info_container {
            (Some(fi.frame_count()), Some(fi.total_duration()))
        } else {
            (None, None)
        };

        Self {
            path: path.display().to_string(),
            magic1: tex.magic1.clone(),
            magic2: tex.magic2.clone(),
            format: format!("{:?}", tex.header.format),
            flags: tex.header.flags.bits(),
            texture_width: tex.header.texture_width,
            texture_height: tex.header.texture_height,
            image_width: tex.header.image_width,
            image_height: tex.header.image_height,
            is_gif: tex.is_gif(),
            is_video: tex.is_video(),
            image_count: tex.image_count(),
            container_version: format!("{:?}", tex.images_container.version),
            frame_count,
            total_duration,
        }
    }
}
