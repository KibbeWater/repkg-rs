//! Package types for Wallpaper Engine PKG files.

use std::path::Path;

/// A Wallpaper Engine PKG package containing multiple files.
#[derive(Debug, Clone)]
pub struct Package {
    /// Magic string identifying the package format (e.g., "PKGV0019")
    pub magic: String,
    /// Size of the header in bytes
    pub header_size: u32,
    /// List of entries in the package
    pub entries: Vec<PackageEntry>,
}

impl Package {
    /// Create a new empty package with the given magic string.
    pub fn new(magic: String) -> Self {
        Self {
            magic,
            header_size: 0,
            entries: Vec::new(),
        }
    }

    /// Get the total number of entries in the package.
    pub fn entry_count(&self) -> usize {
        self.entries.len()
    }

    /// Get the total size of all entry data.
    pub fn total_data_size(&self) -> u64 {
        self.entries.iter().map(|e| e.length as u64).sum()
    }
}

/// An entry (file) within a PKG package.
#[derive(Debug, Clone)]
pub struct PackageEntry {
    /// Full path of the entry within the package
    pub full_path: String,
    /// Offset from the start of the data section
    pub offset: u32,
    /// Length of the entry data in bytes
    pub length: u32,
    /// Raw bytes of the entry (loaded on demand)
    pub bytes: Option<Vec<u8>>,
    /// Type of entry determined from file extension
    pub entry_type: EntryType,
}

impl PackageEntry {
    /// Create a new package entry.
    pub fn new(full_path: String, offset: u32, length: u32) -> Self {
        let entry_type = EntryType::from_path(&full_path);
        Self {
            full_path,
            offset,
            length,
            bytes: None,
            entry_type,
        }
    }

    /// Get the filename without extension.
    pub fn name(&self) -> &str {
        Path::new(&self.full_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
    }

    /// Get the file extension (including the dot).
    pub fn extension(&self) -> &str {
        if let Some(idx) = self.full_path.rfind('.') {
            &self.full_path[idx..]
        } else {
            ""
        }
    }

    /// Get the directory path of the entry.
    pub fn directory_path(&self) -> &str {
        Path::new(&self.full_path)
            .parent()
            .and_then(|p| p.to_str())
            .unwrap_or("")
    }

    /// Check if the entry has loaded bytes.
    pub fn has_bytes(&self) -> bool {
        self.bytes.is_some()
    }
}

/// Type of package entry determined by file extension.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EntryType {
    /// TEX texture file
    Tex,
    /// JSON configuration file
    Json,
    /// Shader file (vertex or fragment)
    Shader,
    /// Other/unknown file type
    Other,
}

impl EntryType {
    /// Determine entry type from a file path.
    pub fn from_path(path: &str) -> Self {
        let lower = path.to_lowercase();
        if lower.ends_with(".tex") {
            EntryType::Tex
        } else if lower.ends_with(".json") {
            EntryType::Json
        } else if lower.ends_with(".vert") || lower.ends_with(".frag") {
            EntryType::Shader
        } else {
            EntryType::Other
        }
    }

    /// Get a human-readable name for the entry type.
    pub fn as_str(&self) -> &'static str {
        match self {
            EntryType::Tex => "texture",
            EntryType::Json => "json",
            EntryType::Shader => "shader",
            EntryType::Other => "other",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entry_type_from_path() {
        assert_eq!(EntryType::from_path("materials/test.tex"), EntryType::Tex);
        assert_eq!(EntryType::from_path("scene.json"), EntryType::Json);
        assert_eq!(
            EntryType::from_path("shaders/effect.vert"),
            EntryType::Shader
        );
        assert_eq!(
            EntryType::from_path("shaders/effect.frag"),
            EntryType::Shader
        );
        assert_eq!(EntryType::from_path("readme.txt"), EntryType::Other);
        assert_eq!(EntryType::from_path("MATERIALS/TEST.TEX"), EntryType::Tex);
    }

    #[test]
    fn test_package_entry_name() {
        let entry = PackageEntry::new("materials/Reze poster.tex".to_string(), 0, 100);
        assert_eq!(entry.name(), "Reze poster");
        assert_eq!(entry.extension(), ".tex");
        assert_eq!(entry.directory_path(), "materials");
    }

    #[test]
    fn test_package_entry_root_file() {
        let entry = PackageEntry::new("scene.json".to_string(), 0, 100);
        assert_eq!(entry.name(), "scene");
        assert_eq!(entry.extension(), ".json");
        assert_eq!(entry.directory_path(), "");
    }
}
