//! PKG package reader implementation.

use byteorder::{LittleEndian, ReadBytesExt};
use repkg_core::{EntryType, Package, PackageEntry};
use std::io::{Read, Seek, SeekFrom};

use crate::error::{Error, Result};

/// Safety limits to prevent malicious files from causing issues.
const MAX_MAGIC_LENGTH: u32 = 64;
const MAX_PATH_LENGTH: u32 = 4096;
const MAX_ENTRY_COUNT: u32 = 100_000;

/// Reader for Wallpaper Engine PKG files.
#[derive(Debug, Clone)]
pub struct PackageReader {
    /// Whether to read entry bytes (can be disabled for info-only operations)
    pub read_entry_bytes: bool,
}

impl PackageReader {
    /// Create a new package reader.
    pub fn new() -> Self {
        Self {
            read_entry_bytes: true,
        }
    }

    /// Create a reader that doesn't load entry bytes.
    pub fn info_only() -> Self {
        Self {
            read_entry_bytes: false,
        }
    }

    /// Read a PKG file from a reader.
    pub fn read_from<R: Read + Seek>(&self, reader: &mut R) -> Result<Package> {
        let package_start = reader.stream_position()?;

        // Read magic string
        let magic = read_length_prefixed_string(reader, MAX_MAGIC_LENGTH)?;
        if !magic.starts_with("PKGV") {
            return Err(Error::InvalidPkgMagic { found: magic });
        }

        // Read entry count
        let entry_count = reader.read_u32::<LittleEndian>()?;
        if entry_count > MAX_ENTRY_COUNT {
            return Err(Error::safety_limit(format!(
                "Entry count {} exceeds maximum {}",
                entry_count, MAX_ENTRY_COUNT
            )));
        }

        // Read entries
        let mut entries = Vec::with_capacity(entry_count as usize);
        for _ in 0..entry_count {
            let full_path = read_length_prefixed_string(reader, MAX_PATH_LENGTH)?;
            let offset = reader.read_u32::<LittleEndian>()?;
            let length = reader.read_u32::<LittleEndian>()?;

            entries.push(PackageEntry {
                full_path: full_path.clone(),
                offset,
                length,
                bytes: None,
                entry_type: EntryType::from_path(&full_path),
            });
        }

        // Calculate header size
        let data_start = reader.stream_position()?;
        let header_size = (data_start - package_start) as u32;

        // Read entry bytes if requested
        if self.read_entry_bytes {
            for entry in &mut entries {
                reader.seek(SeekFrom::Start(data_start + entry.offset as u64))?;
                let mut bytes = vec![0u8; entry.length as usize];
                reader.read_exact(&mut bytes)?;
                entry.bytes = Some(bytes);
            }
        }

        Ok(Package {
            magic,
            header_size,
            entries,
        })
    }
}

impl Default for PackageReader {
    fn default() -> Self {
        Self::new()
    }
}

/// Read a length-prefixed string (i32 length + UTF-8 bytes).
fn read_length_prefixed_string<R: Read>(reader: &mut R, max_length: u32) -> Result<String> {
    let length = reader.read_u32::<LittleEndian>()?;
    if length > max_length {
        return Err(Error::safety_limit(format!(
            "String length {} exceeds maximum {}",
            length, max_length
        )));
    }

    let mut bytes = vec![0u8; length as usize];
    reader.read_exact(&mut bytes)?;

    String::from_utf8(bytes).map_err(Error::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_read_length_prefixed_string() {
        let data = [0x05, 0x00, 0x00, 0x00, b'h', b'e', b'l', b'l', b'o'];
        let mut cursor = Cursor::new(&data);
        let result = read_length_prefixed_string(&mut cursor, 100).unwrap();
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_read_length_prefixed_string_too_long() {
        let data = [0xFF, 0xFF, 0x00, 0x00]; // Length = 65535
        let mut cursor = Cursor::new(&data);
        let result = read_length_prefixed_string(&mut cursor, 100);
        assert!(result.is_err());
    }
}
