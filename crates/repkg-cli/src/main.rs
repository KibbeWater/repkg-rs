//! repkg-rs CLI - Wallpaper Engine PKG unpacker and TEX converter.

mod commands;
mod output;

use clap::{Parser, Subcommand};
use colored::Colorize;

/// Wallpaper Engine PKG unpacker and TEX converter
#[derive(Parser)]
#[command(name = "repkg-rs")]
#[command(author, version, about, long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose output
    #[arg(short, long, global = true)]
    verbose: bool,

    /// Suppress non-error output
    #[arg(short, long, global = true)]
    quiet: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Extract PKG files or convert TEX files to images
    Extract(commands::ExtractArgs),
    /// Display information about PKG/TEX files
    Info(commands::InfoArgs),
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Extract(args) => commands::extract::run(args, cli.verbose, cli.quiet),
        Commands::Info(args) => commands::info::run(args, cli.verbose, cli.quiet),
    };

    if let Err(err) = result {
        eprintln!("{} {}", "error:".red().bold(), err);

        // Print chain of causes
        let mut source = err.source();
        while let Some(cause) = source {
            eprintln!("  {} {}", "caused by:".dimmed(), cause);
            source = std::error::Error::source(cause);
        }

        // Print suggestion if available
        if let Some(repkg_err) = err.downcast_ref::<repkg::Error>() {
            if let Some(suggestion) = repkg_err.suggestion() {
                eprintln!("  {} {}", "hint:".yellow(), suggestion);
            }
        }

        std::process::exit(1);
    }
}
