//! Output formatting utilities.

use colored::Colorize;

/// Print an error message.
#[allow(dead_code)]
pub fn error(msg: &str) {
    eprintln!("{} {}", "error:".red().bold(), msg);
}

/// Print a warning message.
#[allow(dead_code)]
pub fn warning(msg: &str) {
    eprintln!("{} {}", "warning:".yellow(), msg);
}

/// Print an info message.
#[allow(dead_code)]
pub fn info(msg: &str) {
    println!("{} {}", "info:".blue(), msg);
}

/// Print a success message.
#[allow(dead_code)]
pub fn success(msg: &str) {
    println!("{} {}", "success:".green().bold(), msg);
}

/// Print a hint/suggestion.
#[allow(dead_code)]
pub fn hint(msg: &str) {
    eprintln!("  {} {}", "hint:".yellow(), msg);
}
