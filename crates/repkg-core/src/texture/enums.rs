//! Enums for TEX texture format.

use bitflags::bitflags;

bitflags! {
    /// Flags that modify texture behavior.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    pub struct TexFlags: u32 {
        /// No flags set
        const NONE = 0;
        /// Disable interpolation (use nearest-neighbor sampling)
        const NO_INTERPOLATION = 1;
        /// Clamp UV coordinates instead of wrapping
        const CLAMP_UVS = 2;
        /// Texture contains animated GIF frames
        const IS_GIF = 4;
        /// Unknown flag 3
        const UNK3 = 8;
        /// Unknown flag 4
        const UNK4 = 16;
        /// Texture contains video (MP4)
        const IS_VIDEO_TEXTURE = 32;
        /// Unknown flag 6
        const UNK6 = 64;
        /// Unknown flag 7
        const UNK7 = 128;
    }
}

/// Texture format specifying the pixel format.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u32)]
pub enum TexFormat {
    /// RGBA with 8 bits per channel (32-bit)
    RGBA8888 = 0,
    /// DXT5 compressed (BC3)
    DXT5 = 4,
    /// DXT3 compressed (BC2)
    DXT3 = 6,
    /// DXT1 compressed (BC1)
    DXT1 = 7,
    /// R8 single channel
    R8 = 8,
    /// RG88 two channel
    RG88 = 9,
    /// Unknown format
    Unknown(u32),
}

impl From<u32> for TexFormat {
    fn from(value: u32) -> Self {
        match value {
            0 => TexFormat::RGBA8888,
            4 => TexFormat::DXT5,
            6 => TexFormat::DXT3,
            7 => TexFormat::DXT1,
            8 => TexFormat::R8,
            9 => TexFormat::RG88,
            _ => TexFormat::Unknown(value),
        }
    }
}

impl TexFormat {
    /// Check if this format is valid/known.
    pub fn is_valid(&self) -> bool {
        !matches!(self, TexFormat::Unknown(_))
    }

    /// Get the format value as u32.
    pub fn as_u32(&self) -> u32 {
        match self {
            TexFormat::RGBA8888 => 0,
            TexFormat::DXT5 => 4,
            TexFormat::DXT3 => 6,
            TexFormat::DXT1 => 7,
            TexFormat::R8 => 8,
            TexFormat::RG88 => 9,
            TexFormat::Unknown(v) => *v,
        }
    }
}

/// Format of mipmap data after decompression.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MipmapFormat {
    /// Invalid/unknown format
    Invalid,

    // Raw pixel formats
    /// RGBA with 8 bits per channel (4 bytes per pixel)
    RGBA8888,
    /// Single channel red (1 byte per pixel)
    R8,
    /// Two channel red-green (2 bytes per pixel)
    RG88,

    // Compressed formats (before decompression)
    /// DXT5/BC3 compressed
    CompressedDXT5,
    /// DXT3/BC2 compressed
    CompressedDXT3,
    /// DXT1/BC1 compressed
    CompressedDXT1,

    // Video format
    /// MP4 video data (passthrough)
    VideoMp4,

    // Image file formats (embedded images)
    /// BMP image
    ImageBMP,
    /// JPEG image
    ImageJPEG,
    /// PNG image
    ImagePNG,
    /// GIF image
    ImageGIF,
    /// TGA/Targa image
    ImageTGA,
    /// DDS image
    ImageDDS,
    /// TIFF image
    ImageTIFF,
    /// WebP image
    ImageWEBP,
}

impl MipmapFormat {
    /// Check if this is a compressed format (DXT).
    pub fn is_compressed(&self) -> bool {
        matches!(
            self,
            MipmapFormat::CompressedDXT1
                | MipmapFormat::CompressedDXT3
                | MipmapFormat::CompressedDXT5
        )
    }

    /// Check if this is a raw pixel format.
    pub fn is_raw(&self) -> bool {
        matches!(
            self,
            MipmapFormat::RGBA8888 | MipmapFormat::R8 | MipmapFormat::RG88
        )
    }

    /// Check if this is an embedded image format.
    pub fn is_image(&self) -> bool {
        matches!(
            self,
            MipmapFormat::ImageBMP
                | MipmapFormat::ImageJPEG
                | MipmapFormat::ImagePNG
                | MipmapFormat::ImageGIF
                | MipmapFormat::ImageTGA
                | MipmapFormat::ImageDDS
                | MipmapFormat::ImageTIFF
                | MipmapFormat::ImageWEBP
        )
    }

    /// Get the file extension for this format.
    pub fn file_extension(&self) -> &'static str {
        match self {
            MipmapFormat::Invalid => "",
            MipmapFormat::RGBA8888 | MipmapFormat::R8 | MipmapFormat::RG88 => ".png",
            MipmapFormat::CompressedDXT1
            | MipmapFormat::CompressedDXT3
            | MipmapFormat::CompressedDXT5 => ".png",
            MipmapFormat::VideoMp4 => ".mp4",
            MipmapFormat::ImageBMP => ".bmp",
            MipmapFormat::ImageJPEG => ".jpg",
            MipmapFormat::ImagePNG => ".png",
            MipmapFormat::ImageGIF => ".gif",
            MipmapFormat::ImageTGA => ".tga",
            MipmapFormat::ImageDDS => ".dds",
            MipmapFormat::ImageTIFF => ".tiff",
            MipmapFormat::ImageWEBP => ".webp",
        }
    }

    /// Get bytes per pixel for raw formats.
    pub fn bytes_per_pixel(&self) -> Option<u32> {
        match self {
            MipmapFormat::RGBA8888 => Some(4),
            MipmapFormat::R8 => Some(1),
            MipmapFormat::RG88 => Some(2),
            _ => None,
        }
    }
}

/// Version of the TEX image container format.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum TexImageContainerVersion {
    /// Version 1 (TEXB0001)
    Version1,
    /// Version 2 (TEXB0002)
    Version2,
    /// Version 3 (TEXB0003)
    Version3,
    /// Version 4 (TEXB0004)
    Version4,
    /// Unknown version
    Unknown(String),
}

impl TexImageContainerVersion {
    /// Parse from magic string.
    pub fn from_magic(magic: &str) -> Self {
        match magic {
            "TEXB0001" => TexImageContainerVersion::Version1,
            "TEXB0002" => TexImageContainerVersion::Version2,
            "TEXB0003" => TexImageContainerVersion::Version3,
            "TEXB0004" => TexImageContainerVersion::Version4,
            _ => TexImageContainerVersion::Unknown(magic.to_string()),
        }
    }

    /// Check if this version is supported.
    pub fn is_supported(&self) -> bool {
        !matches!(self, TexImageContainerVersion::Unknown(_))
    }

    /// Get the version number.
    pub fn version_number(&self) -> Option<u32> {
        match self {
            TexImageContainerVersion::Version1 => Some(1),
            TexImageContainerVersion::Version2 => Some(2),
            TexImageContainerVersion::Version3 => Some(3),
            TexImageContainerVersion::Version4 => Some(4),
            TexImageContainerVersion::Unknown(_) => None,
        }
    }
}

/// FreeImage format codes (used in TEX container).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(i32)]
pub enum FreeImageFormat {
    /// Unknown format
    Unknown = -1,
    /// BMP
    BMP = 0,
    /// ICO
    ICO = 1,
    /// JPEG
    JPEG = 2,
    /// JNG
    JNG = 3,
    /// KOALA
    KOALA = 4,
    /// LBM/IFF
    LBM = 5,
    /// MNG
    MNG = 6,
    /// PBM
    PBM = 7,
    /// PBMRAW
    PBMRAW = 8,
    /// PCD
    PCD = 9,
    /// PCX
    PCX = 10,
    /// PGM
    PGM = 11,
    /// PGMRAW
    PGMRAW = 12,
    /// PNG
    PNG = 13,
    /// PPM
    PPM = 14,
    /// PPMRAW
    PPMRAW = 15,
    /// RAS
    RAS = 16,
    /// TARGA
    TARGA = 17,
    /// TIFF
    TIFF = 18,
    /// WBMP
    WBMP = 19,
    /// PSD
    PSD = 20,
    /// CUT
    CUT = 21,
    /// XBM
    XBM = 22,
    /// XPM
    XPM = 23,
    /// DDS
    DDS = 24,
    /// GIF
    GIF = 25,
    /// HDR
    HDR = 26,
    /// FAXG3
    FAXG3 = 27,
    /// SGI
    SGI = 28,
    /// EXR
    EXR = 29,
    /// J2K
    J2K = 30,
    /// JP2
    JP2 = 31,
    /// PFM
    PFM = 32,
    /// PICT
    PICT = 33,
    /// RAW
    RAW = 34,
    /// WEBP
    WEBP = 35,
    /// JXR
    JXR = 36,
    /// MP4 video (custom extension for Wallpaper Engine, not standard FreeImage)
    Mp4 = 37,
}

impl From<i32> for FreeImageFormat {
    fn from(value: i32) -> Self {
        match value {
            -1 => FreeImageFormat::Unknown,
            0 => FreeImageFormat::BMP,
            1 => FreeImageFormat::ICO,
            2 => FreeImageFormat::JPEG,
            3 => FreeImageFormat::JNG,
            4 => FreeImageFormat::KOALA,
            5 => FreeImageFormat::LBM,
            6 => FreeImageFormat::MNG,
            7 => FreeImageFormat::PBM,
            8 => FreeImageFormat::PBMRAW,
            9 => FreeImageFormat::PCD,
            10 => FreeImageFormat::PCX,
            11 => FreeImageFormat::PGM,
            12 => FreeImageFormat::PGMRAW,
            13 => FreeImageFormat::PNG,
            14 => FreeImageFormat::PPM,
            15 => FreeImageFormat::PPMRAW,
            16 => FreeImageFormat::RAS,
            17 => FreeImageFormat::TARGA,
            18 => FreeImageFormat::TIFF,
            19 => FreeImageFormat::WBMP,
            20 => FreeImageFormat::PSD,
            21 => FreeImageFormat::CUT,
            22 => FreeImageFormat::XBM,
            23 => FreeImageFormat::XPM,
            24 => FreeImageFormat::DDS,
            25 => FreeImageFormat::GIF,
            26 => FreeImageFormat::HDR,
            27 => FreeImageFormat::FAXG3,
            28 => FreeImageFormat::SGI,
            29 => FreeImageFormat::EXR,
            30 => FreeImageFormat::J2K,
            31 => FreeImageFormat::JP2,
            32 => FreeImageFormat::PFM,
            33 => FreeImageFormat::PICT,
            34 => FreeImageFormat::RAW,
            35 => FreeImageFormat::WEBP,
            36 => FreeImageFormat::JXR,
            _ => FreeImageFormat::Unknown,
        }
    }
}

impl FreeImageFormat {
    /// Convert to MipmapFormat for image formats.
    pub fn to_mipmap_format(&self) -> MipmapFormat {
        match self {
            FreeImageFormat::BMP => MipmapFormat::ImageBMP,
            FreeImageFormat::JPEG => MipmapFormat::ImageJPEG,
            FreeImageFormat::PNG => MipmapFormat::ImagePNG,
            FreeImageFormat::GIF => MipmapFormat::ImageGIF,
            FreeImageFormat::TARGA => MipmapFormat::ImageTGA,
            FreeImageFormat::DDS => MipmapFormat::ImageDDS,
            FreeImageFormat::TIFF => MipmapFormat::ImageTIFF,
            FreeImageFormat::WEBP => MipmapFormat::ImageWEBP,
            FreeImageFormat::Mp4 => MipmapFormat::VideoMp4,
            _ => MipmapFormat::Invalid,
        }
    }

    /// Check if this format represents video content.
    pub fn is_video(&self) -> bool {
        matches!(self, FreeImageFormat::Mp4)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tex_flags() {
        let flags = TexFlags::IS_GIF | TexFlags::CLAMP_UVS;
        assert!(flags.contains(TexFlags::IS_GIF));
        assert!(flags.contains(TexFlags::CLAMP_UVS));
        assert!(!flags.contains(TexFlags::IS_VIDEO_TEXTURE));
    }

    #[test]
    fn test_tex_format_from_u32() {
        assert_eq!(TexFormat::from(0), TexFormat::RGBA8888);
        assert_eq!(TexFormat::from(4), TexFormat::DXT5);
        assert_eq!(TexFormat::from(99), TexFormat::Unknown(99));
    }

    #[test]
    fn test_mipmap_format_properties() {
        assert!(MipmapFormat::CompressedDXT5.is_compressed());
        assert!(!MipmapFormat::RGBA8888.is_compressed());
        assert!(MipmapFormat::RGBA8888.is_raw());
        assert!(MipmapFormat::ImagePNG.is_image());
        assert_eq!(MipmapFormat::RGBA8888.bytes_per_pixel(), Some(4));
        assert_eq!(MipmapFormat::R8.bytes_per_pixel(), Some(1));
    }

    #[test]
    fn test_container_version() {
        assert_eq!(
            TexImageContainerVersion::from_magic("TEXB0003"),
            TexImageContainerVersion::Version3
        );
        assert!(TexImageContainerVersion::Version3.is_supported());
        assert!(!TexImageContainerVersion::Unknown("TEXB9999".to_string()).is_supported());
    }
}
