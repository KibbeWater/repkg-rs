//! Extract command implementation.

use anyhow::{Context, Result};
use clap::Args;
use colored::Colorize;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use rayon::prelude::*;
use repkg::texture::OutputFormat;
use repkg::{PackageReader, TexReader, TexToImageConverter};
use repkg_core::EntryType;
use std::fs::{self, File};
use std::io::{BufReader, Cursor};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use walkdir::WalkDir;

/// Extract PKG files or convert TEX files to images
#[derive(Args, Debug)]
pub struct ExtractArgs {
    /// Path to PKG/TEX file or directory
    #[arg(value_name = "INPUT")]
    pub input: PathBuf,

    /// Output directory
    #[arg(short, long, default_value = "./output")]
    pub output: PathBuf,

    /// Output image format (png, jpeg, gif, webp, bmp, tiff, tga)
    #[arg(short, long, default_value = "png")]
    pub format: String,

    /// Skip files with these extensions (comma-separated)
    #[arg(short = 'i', long = "ignore-exts")]
    pub ignore_exts: Option<String>,

    /// Only extract files with these extensions (comma-separated)
    #[arg(short = 'e', long = "only-exts")]
    pub only_exts: Option<String>,

    /// Treat input directory as containing TEX files
    #[arg(short = 't', long = "tex")]
    pub tex_directory: bool,

    /// Put all extracted files in one directory (ignore paths)
    #[arg(short = 's', long = "single-dir")]
    pub single_dir: bool,

    /// Recursively search subdirectories
    #[arg(short = 'r', long)]
    pub recursive: bool,

    /// Don't convert TEX files to images
    #[arg(long = "no-convert")]
    pub no_convert: bool,

    /// Overwrite existing files
    #[arg(long)]
    pub overwrite: bool,

    /// Show what would be extracted without writing files
    #[arg(long = "dry-run")]
    pub dry_run: bool,

    /// Number of parallel jobs (0 = auto)
    #[arg(short = 'j', long, default_value = "0")]
    pub jobs: usize,
}

pub fn run(args: ExtractArgs, verbose: bool, quiet: bool) -> Result<()> {
    // Validate output format
    let output_format = OutputFormat::parse(&args.format).ok_or_else(|| {
        anyhow::anyhow!(
            "Invalid output format '{}'. Valid formats: {}",
            args.format,
            OutputFormat::all()
                .iter()
                .map(|f| f.extension())
                .collect::<Vec<_>>()
                .join(", ")
        )
    })?;

    // Parse extension filters
    let ignore_exts: Vec<String> = args
        .ignore_exts
        .as_ref()
        .map(|s| normalize_extensions(s))
        .unwrap_or_default();

    let only_exts: Vec<String> = args
        .only_exts
        .as_ref()
        .map(|s| normalize_extensions(s))
        .unwrap_or_default();

    // Configure thread pool
    if args.jobs > 0 {
        rayon::ThreadPoolBuilder::new()
            .num_threads(args.jobs)
            .build_global()
            .ok();
    }

    // Determine input type
    let input_path = &args.input;
    let metadata = fs::metadata(input_path)
        .with_context(|| format!("Failed to access input: {}", input_path.display()))?;

    let context = ExtractContext {
        args: &args,
        output_format,
        ignore_exts,
        only_exts,
        verbose,
        quiet,
    };

    if metadata.is_file() {
        extract_file(&context, input_path)?;
    } else if metadata.is_dir() {
        extract_directory(&context, input_path)?;
    } else {
        anyhow::bail!("Input is neither a file nor directory");
    }

    if !quiet {
        println!("{}", "Done!".green().bold());
    }

    Ok(())
}

struct ExtractContext<'a> {
    args: &'a ExtractArgs,
    output_format: OutputFormat,
    ignore_exts: Vec<String>,
    only_exts: Vec<String>,
    verbose: bool,
    quiet: bool,
}

fn normalize_extensions(s: &str) -> Vec<String> {
    s.split(',')
        .map(|ext| {
            let ext = ext.trim().to_lowercase();
            if ext.starts_with('.') {
                ext
            } else {
                format!(".{}", ext)
            }
        })
        .collect()
}

fn extract_file(ctx: &ExtractContext, path: &Path) -> Result<()> {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "pkg" => extract_pkg(ctx, path),
        "tex" => extract_tex(ctx, path),
        _ => {
            if !ctx.quiet {
                println!(
                    "{} Unrecognized file extension: {}",
                    "warning:".yellow(),
                    ext
                );
            }
            Ok(())
        }
    }
}

fn extract_directory(ctx: &ExtractContext, dir: &Path) -> Result<()> {
    let pattern = if ctx.args.tex_directory { "tex" } else { "pkg" };

    // Collect matching files
    let files: Vec<PathBuf> = if ctx.args.recursive {
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
        if !ctx.quiet {
            println!(
                "{} No {} files found in {}",
                "warning:".yellow(),
                pattern.to_uppercase(),
                dir.display()
            );
        }
        return Ok(());
    }

    if !ctx.quiet {
        println!(
            "Found {} {} files",
            files.len().to_string().cyan(),
            pattern.to_uppercase()
        );
    }

    // Process files in parallel with progress
    let multi_progress = MultiProgress::new();
    let overall_pb = multi_progress.add(ProgressBar::new(files.len() as u64));
    overall_pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len} files ({eta})")?
            .progress_chars("#>-"),
    );

    let success_count = Arc::new(AtomicUsize::new(0));
    let error_count = Arc::new(AtomicUsize::new(0));

    files.par_iter().for_each(|file| {
        let result = if ctx.args.tex_directory {
            extract_tex(ctx, file)
        } else {
            extract_pkg(ctx, file)
        };

        match result {
            Ok(()) => {
                success_count.fetch_add(1, Ordering::SeqCst);
            }
            Err(e) => {
                error_count.fetch_add(1, Ordering::SeqCst);
                if !ctx.quiet {
                    eprintln!("{} {}: {}", "error:".red(), file.display(), e);
                }
            }
        }

        overall_pb.inc(1);
    });

    overall_pb.finish_and_clear();

    let success = success_count.load(Ordering::SeqCst);
    let errors = error_count.load(Ordering::SeqCst);

    if !ctx.quiet {
        println!(
            "Processed {} files ({} successful, {} errors)",
            files.len(),
            success.to_string().green(),
            if errors > 0 {
                errors.to_string().red()
            } else {
                errors.to_string().normal()
            }
        );
    }

    Ok(())
}

fn extract_pkg(ctx: &ExtractContext, path: &Path) -> Result<()> {
    if !ctx.quiet && ctx.verbose {
        println!("\n{} Extracting: {}", ">>>".cyan(), path.display());
    }

    // Read the package
    let file = File::open(path).with_context(|| format!("Failed to open {}", path.display()))?;
    let mut reader = BufReader::new(file);

    let pkg_reader = PackageReader::new();
    let package = pkg_reader
        .read_from(&mut reader)
        .with_context(|| format!("Failed to read PKG: {}", path.display()))?;

    if ctx.verbose && !ctx.quiet {
        println!(
            "  Package: {} entries, {} bytes",
            package.entry_count(),
            package.total_data_size()
        );
    }

    // Filter entries
    let entries: Vec<_> = package
        .entries
        .iter()
        .filter(|e| should_extract(e.extension(), &ctx.ignore_exts, &ctx.only_exts))
        .collect();

    if entries.is_empty() {
        if !ctx.quiet {
            println!("  No entries match filter criteria");
        }
        return Ok(());
    }

    // Create output directory
    let output_dir = &ctx.args.output;
    if !ctx.args.dry_run {
        fs::create_dir_all(output_dir)?;
    }

    let tex_reader = TexReader::new();
    let converter = TexToImageConverter::new();

    for entry in entries {
        let bytes = entry
            .bytes
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Entry has no data"))?;

        // Determine output path
        let output_path = if ctx.args.single_dir {
            output_dir.join(format!("{}{}", entry.name(), entry.extension()))
        } else {
            output_dir.join(&entry.full_path)
        };

        // Check if exists
        if !ctx.args.overwrite && output_path.exists() {
            if ctx.verbose && !ctx.quiet {
                println!("  {} Skipping (exists): {}", "-".dimmed(), entry.full_path);
            }
            continue;
        }

        if ctx.args.dry_run {
            println!(
                "  Would extract: {} -> {}",
                entry.full_path,
                output_path.display()
            );
            continue;
        }

        // Create parent directory
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Write raw file
        fs::write(&output_path, bytes)?;

        if ctx.verbose && !ctx.quiet {
            println!("  {} Extracted: {}", "+".green(), entry.full_path);
        }

        // Convert TEX if requested
        if entry.entry_type == EntryType::Tex && !ctx.args.no_convert {
            let tex_result = tex_reader.read_from(&mut Cursor::new(bytes));

            match tex_result {
                Ok(tex) => {
                    let format = if tex.is_gif() || tex.is_video() {
                        converter.recommended_format(&tex)
                    } else {
                        ctx.output_format
                    };

                    match converter.convert(&tex, format) {
                        Ok(result) => {
                            let img_path = output_path.with_extension(result.format.extension());
                            fs::write(&img_path, &result.bytes)?;
                            if ctx.verbose && !ctx.quiet {
                                println!(
                                    "  {} Converted: {} -> {}",
                                    "+".green(),
                                    entry.full_path,
                                    result.format.extension()
                                );
                            }
                        }
                        Err(e) => {
                            if !ctx.quiet {
                                eprintln!(
                                    "  {} Failed to convert {}: {}",
                                    "!".yellow(),
                                    entry.full_path,
                                    e
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    if !ctx.quiet {
                        eprintln!(
                            "  {} Failed to read TEX {}: {}",
                            "!".yellow(),
                            entry.full_path,
                            e
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

fn extract_tex(ctx: &ExtractContext, path: &Path) -> Result<()> {
    if !ctx.quiet && ctx.verbose {
        println!("\n{} Converting: {}", ">>>".cyan(), path.display());
    }

    let bytes = fs::read(path).with_context(|| format!("Failed to read {}", path.display()))?;

    let tex_reader = TexReader::new();
    let tex = tex_reader
        .read_from(&mut Cursor::new(&bytes))
        .with_context(|| format!("Failed to parse TEX: {}", path.display()))?;

    let converter = TexToImageConverter::new();
    let format = if tex.is_gif() || tex.is_video() {
        converter.recommended_format(&tex)
    } else {
        ctx.output_format
    };

    // Determine output path
    let file_stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let output_path = ctx
        .args
        .output
        .join(format!("{}.{}", file_stem, format.extension()));

    // Check if exists
    if !ctx.args.overwrite && output_path.exists() {
        if ctx.verbose && !ctx.quiet {
            println!(
                "  {} Skipping (exists): {}",
                "-".dimmed(),
                output_path.display()
            );
        }
        return Ok(());
    }

    if ctx.args.dry_run {
        println!(
            "  Would convert: {} -> {}",
            path.display(),
            output_path.display()
        );
        return Ok(());
    }

    // Create output directory
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Convert and write
    let result = converter.convert(&tex, format)?;
    fs::write(&output_path, &result.bytes)?;

    if !ctx.quiet {
        println!(
            "  {} Converted: {} -> {}",
            "+".green(),
            path.display(),
            output_path.display()
        );
    }

    Ok(())
}

fn should_extract(ext: &str, ignore: &[String], only: &[String]) -> bool {
    let ext_lower = ext.to_lowercase();

    if !only.is_empty() {
        return only.iter().any(|e| ext_lower == e.as_str());
    }

    if !ignore.is_empty() {
        return !ignore.iter().any(|e| ext_lower == e.as_str());
    }

    true
}
