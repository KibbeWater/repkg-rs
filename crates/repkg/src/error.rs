//! Error types for repkg operations.

use std::path::PathBuf;
use thiserror::Error;

/// Result type alias using the repkg Error.
pub type Result<T> = std::result::Result<T, Error>;

/// Errors that can occur during PKG/TEX operations.
#[derive(Error, Debug)]
pub enum Error {
    /// Failed to read from file or stream.
    #[error("Failed to read file: {path}")]
    FileRead {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    /// Generic I/O error.
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// Invalid PKG magic header.
    #[error("Invalid PKG magic: expected 'PKGV', got '{found}'")]
    InvalidPkgMagic { found: String },

    /// Invalid TEX magic header.
    #[error("Invalid TEX magic: expected '{expected}', got '{found}'")]
    InvalidTexMagic {
        expected: &'static str,
        found: String,
    },

    /// Unsupported TEX container version.
    #[error("Unsupported TEX container version: {version}")]
    UnsupportedContainerVersion { version: String },

    /// Unsupported mipmap format.
    #[error("Unsupported mipmap format: {format:?}")]
    UnsupportedMipmapFormat { format: repkg_core::MipmapFormat },

    /// LZ4 decompression failed.
    #[error("LZ4 decompression failed: {message}")]
    Lz4Decompression { message: String },

    /// DXT decompression failed.
    #[error("DXT decompression failed: {details}")]
    DxtDecompression { details: String },

    /// Image conversion failed.
    #[error("Image conversion failed: {0}")]
    ImageConversion(#[from] image::ImageError),

    /// Invalid data encountered.
    #[error("Invalid data: {message}")]
    InvalidData { message: String },

    /// Data exceeds safety limits.
    #[error("Data exceeds safety limits: {message}")]
    SafetyLimit { message: String },

    /// Unexpected end of stream.
    #[error("Unexpected end of stream at position {position}")]
    UnexpectedEof { position: u64 },

    /// String encoding error.
    #[error("String encoding error: {0}")]
    StringEncoding(#[from] std::string::FromUtf8Error),
}

impl Error {
    /// Get a helpful suggestion for recovering from this error.
    pub fn suggestion(&self) -> Option<&'static str> {
        match self {
            Error::InvalidPkgMagic { .. } => Some(
                "This file may not be a valid PKG file. Verify it comes from Wallpaper Engine.",
            ),
            Error::InvalidTexMagic { .. } => Some(
                "This file may not be a valid TEX file. Use --no-convert to extract raw files.",
            ),
            Error::UnsupportedContainerVersion { .. } => {
                Some("This file uses a newer format version. Please report this issue on GitHub.")
            }
            Error::UnsupportedMipmapFormat { .. } => {
                Some("Try using --format png or --no-convert to extract raw data.")
            }
            Error::Lz4Decompression { .. } | Error::DxtDecompression { .. } => Some(
                "The file may be corrupted. Try re-downloading from Wallpaper Engine workshop.",
            ),
            Error::ImageConversion(_) => Some("Try a different output format with --format."),
            Error::SafetyLimit { .. } => Some("The file may be corrupted or malicious."),
            _ => None,
        }
    }

    /// Create an InvalidData error with a message.
    pub fn invalid_data(message: impl Into<String>) -> Self {
        Error::InvalidData {
            message: message.into(),
        }
    }

    /// Create a SafetyLimit error with a message.
    pub fn safety_limit(message: impl Into<String>) -> Self {
        Error::SafetyLimit {
            message: message.into(),
        }
    }
}
