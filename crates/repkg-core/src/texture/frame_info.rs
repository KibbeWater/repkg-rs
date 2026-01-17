//! Frame information for animated GIF textures.

/// Container for GIF animation frame information.
#[derive(Debug, Clone)]
pub struct TexFrameInfoContainer {
    /// Width of the GIF output
    pub gif_width: u32,
    /// Height of the GIF output
    pub gif_height: u32,
    /// Individual frame information
    pub frames: Vec<TexFrameInfo>,
}

impl TexFrameInfoContainer {
    /// Create a new frame info container.
    pub fn new(gif_width: u32, gif_height: u32) -> Self {
        Self {
            gif_width,
            gif_height,
            frames: Vec::new(),
        }
    }

    /// Get the number of frames.
    pub fn frame_count(&self) -> usize {
        self.frames.len()
    }

    /// Calculate the total animation duration in seconds.
    pub fn total_duration(&self) -> f32 {
        self.frames.iter().map(|f| f.frametime).sum()
    }
}

/// Information about a single animation frame.
#[derive(Debug, Clone, Copy)]
pub struct TexFrameInfo {
    /// Index of the source image in the image container
    pub image_id: u32,
    /// Duration of this frame in seconds
    pub frametime: f32,
    /// X position in the sprite atlas
    pub x: f32,
    /// Y position in the sprite atlas
    pub y: f32,
    /// Width of the frame (can be 0 if using height_x for rotation)
    pub width: f32,
    /// Height of the frame (can be 0 if using width_y for rotation)
    pub height: f32,
    /// Width component for Y axis (used for rotated frames)
    pub width_y: f32,
    /// Height component for X axis (used for rotated frames)
    pub height_x: f32,
}

impl TexFrameInfo {
    /// Create a new frame info.
    pub fn new(image_id: u32, frametime: f32) -> Self {
        Self {
            image_id,
            frametime,
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.0,
            width_y: 0.0,
            height_x: 0.0,
        }
    }

    /// Get the actual width of the frame, accounting for rotation.
    pub fn actual_width(&self) -> f32 {
        if self.width != 0.0 {
            self.width.abs()
        } else {
            self.height_x.abs()
        }
    }

    /// Get the actual height of the frame, accounting for rotation.
    pub fn actual_height(&self) -> f32 {
        if self.height != 0.0 {
            self.height.abs()
        } else {
            self.width_y.abs()
        }
    }

    /// Calculate the rotation angle in radians.
    ///
    /// Frames can be rotated to fit better in the sprite atlas.
    /// This calculates the angle needed to un-rotate the frame.
    pub fn rotation_angle(&self) -> f64 {
        let width = if self.width != 0.0 {
            self.width
        } else {
            self.height_x
        };
        let height = if self.height != 0.0 {
            self.height
        } else {
            self.width_y
        };

        let sign_w: f64 = if width >= 0.0 { 1.0 } else { -1.0 };
        let sign_h: f64 = if height >= 0.0 { 1.0 } else { -1.0 };

        -(sign_h.atan2(sign_w) - std::f64::consts::FRAC_PI_4)
    }

    /// Calculate the crop rectangle (x, y, width, height).
    pub fn crop_rect(&self) -> (u32, u32, u32, u32) {
        let width = if self.width != 0.0 {
            self.width
        } else {
            self.height_x
        };
        let height = if self.height != 0.0 {
            self.height
        } else {
            self.width_y
        };

        let x = self.x.min(self.x + width);
        let y = self.y.min(self.y + height);

        (x as u32, y as u32, width.abs() as u32, height.abs() as u32)
    }

    /// Get frame delay in centiseconds (for GIF format).
    pub fn delay_centiseconds(&self) -> u16 {
        (self.frametime * 100.0).round() as u16
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frame_info_container() {
        let mut container = TexFrameInfoContainer::new(100, 100);
        container.frames.push(TexFrameInfo {
            image_id: 0,
            frametime: 0.1,
            x: 0.0,
            y: 0.0,
            width: 50.0,
            height: 50.0,
            width_y: 0.0,
            height_x: 0.0,
        });
        container.frames.push(TexFrameInfo {
            image_id: 1,
            frametime: 0.2,
            x: 50.0,
            y: 0.0,
            width: 50.0,
            height: 50.0,
            width_y: 0.0,
            height_x: 0.0,
        });

        assert_eq!(container.frame_count(), 2);
        assert!((container.total_duration() - 0.3).abs() < 0.001);
    }

    #[test]
    fn test_frame_info_dimensions() {
        let frame = TexFrameInfo {
            image_id: 0,
            frametime: 0.1,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 50.0,
            width_y: 0.0,
            height_x: 0.0,
        };

        assert_eq!(frame.actual_width(), 100.0);
        assert_eq!(frame.actual_height(), 50.0);
        assert_eq!(frame.crop_rect(), (0, 0, 100, 50));
        assert_eq!(frame.delay_centiseconds(), 10);
    }
}
