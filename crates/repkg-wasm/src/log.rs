//! Logging system for WASM module.
//!
//! This module provides a callback-based logging system that allows JavaScript
//! to receive detailed logs from Rust/WASM operations. The feature is opt-in
//! via the `console-log` cargo feature.

#[cfg(feature = "console-log")]
mod inner {
    use js_sys::Function;
    use serde::Serialize;
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;

    thread_local! {
        static LOG_CALLBACK: RefCell<Option<Function>> = const { RefCell::new(None) };
    }

    /// Set the logging callback function.
    ///
    /// The callback receives three arguments:
    /// - `level`: string ("debug", "info", "warn")
    /// - `operation`: string (e.g., "pkg_parse", "tex_decompress")
    /// - `data`: object with operation-specific details
    #[wasm_bindgen]
    pub fn set_log_callback(callback: JsValue) {
        LOG_CALLBACK.with(|cb| {
            if callback.is_function() {
                *cb.borrow_mut() = Some(callback.unchecked_into());
            } else if callback.is_null() || callback.is_undefined() {
                *cb.borrow_mut() = None;
            }
        });
    }

    /// Clear the logging callback.
    #[wasm_bindgen]
    pub fn clear_log_callback() {
        LOG_CALLBACK.with(|cb| {
            *cb.borrow_mut() = None;
        });
    }

    /// Internal function to emit a log entry.
    pub fn emit_log<T: Serialize>(level: &str, operation: &str, data: &T) {
        LOG_CALLBACK.with(|cb| {
            if let Some(callback) = cb.borrow().as_ref() {
                let level_js = JsValue::from_str(level);
                let op_js = JsValue::from_str(operation);
                let data_js = serde_wasm_bindgen::to_value(data).unwrap_or(JsValue::NULL);

                // Ignore errors from callback
                let _ = callback.call3(&JsValue::NULL, &level_js, &op_js, &data_js);
            }
        });
    }

    /// Check if logging is enabled (callback is set).
    pub fn is_enabled() -> bool {
        LOG_CALLBACK.with(|cb| cb.borrow().is_some())
    }
}

#[cfg(not(feature = "console-log"))]
mod inner {
    use serde::Serialize;

    /// Stub when console-log feature is disabled.
    #[inline(always)]
    pub fn emit_log<T: Serialize>(_level: &str, _operation: &str, _data: &T) {}

    /// Always returns false when feature is disabled.
    #[inline(always)]
    pub fn is_enabled() -> bool {
        false
    }
}

pub use inner::*;

/// Convenience macro for logging.
#[macro_export]
macro_rules! wasm_log {
    ($level:expr, $op:expr, $data:expr) => {
        if $crate::log::is_enabled() {
            $crate::log::emit_log($level, $op, $data);
        }
    };
}

/// Log at debug level.
#[macro_export]
macro_rules! wasm_debug {
    ($op:expr, $data:expr) => {
        $crate::wasm_log!("debug", $op, $data)
    };
}

/// Log at info level.
#[macro_export]
macro_rules! wasm_info {
    ($op:expr, $data:expr) => {
        $crate::wasm_log!("info", $op, $data)
    };
}
