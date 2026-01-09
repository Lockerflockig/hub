//! Internationalization module
//!
//! Provides translation support for both frontend (served as JSON) and backend.

use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, RwLock};

/// Supported languages
pub const SUPPORTED_LANGUAGES: &[&str] = &["en", "de"];
pub const DEFAULT_LANGUAGE: &str = "en";

/// Current bot language (runtime modifiable)
static BOT_LANGUAGE: LazyLock<RwLock<String>> = LazyLock::new(|| {
    RwLock::new(crate::CONFIG.bot_language.clone())
});

/// Get the current bot language
pub fn get_bot_language() -> String {
    BOT_LANGUAGE.read().unwrap().clone()
}

/// Set the bot language (returns true if successful)
pub fn set_bot_language(lang: &str) -> bool {
    if is_valid_language(lang) {
        *BOT_LANGUAGE.write().unwrap() = lang.to_string();
        true
    } else {
        false
    }
}

/// Embedded locale files (loaded at compile time)
static LOCALE_DE: &str = include_str!("../../locales/de.json");
static LOCALE_EN: &str = include_str!("../../locales/en.json");

/// Parsed locale data
static LOCALES: LazyLock<HashMap<&'static str, Value>> = LazyLock::new(|| {
    let mut map = HashMap::new();

    if let Ok(de) = serde_json::from_str(LOCALE_DE) {
        map.insert("de", de);
    }
    if let Ok(en) = serde_json::from_str(LOCALE_EN) {
        map.insert("en", en);
    }

    map
});

/// Check if a language is supported
pub fn is_valid_language(lang: &str) -> bool {
    SUPPORTED_LANGUAGES.contains(&lang)
}

/// Get locale JSON for serving to frontend
pub fn get_locale_json(lang: &str) -> &'static str {
    match lang {
        "de" => LOCALE_DE,
        _ => LOCALE_EN,
    }
}

/// Translate a key with optional parameters
///
/// # Arguments
/// * `lang` - Language code ("en", "de")
/// * `key` - Dot-notated key like "bot.errors.noPermission"
/// * `params` - Optional parameters for interpolation (replaces {{key}})
///
/// # Example
/// ```
/// let msg = t("en", "bot.user.created", &[("name", "Player1")]);
/// // Returns: "User for **Player1** created!"
/// ```
pub fn t(lang: &str, key: &str, params: &[(&str, &str)]) -> String {
    let lang = if is_valid_language(lang) { lang } else { DEFAULT_LANGUAGE };

    let locale = match LOCALES.get(lang) {
        Some(l) => l,
        None => return key.to_string(),
    };

    // Navigate to the key
    let mut current = locale;
    for part in key.split('.') {
        match current.get(part) {
            Some(v) => current = v,
            None => return key.to_string(),
        }
    }

    // Get the string value
    let text = match current.as_str() {
        Some(s) => s.to_string(),
        None => return key.to_string(),
    };

    // Replace parameters {{param}}
    let mut result = text;
    for (name, value) in params {
        result = result.replace(&format!("{{{{{}}}}}", name), value);
    }

    result
}

/// Convenience macro for translation without parameters
#[macro_export]
macro_rules! tr {
    ($lang:expr, $key:expr) => {
        $crate::i18n::t($lang, $key, &[])
    };
    ($lang:expr, $key:expr, $($name:expr => $value:expr),+ $(,)?) => {
        $crate::i18n::t($lang, $key, &[$(($name, $value)),+])
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_translation() {
        let msg = t("en", "bot.util.pong", &[]);
        assert_eq!(msg, "Pong!");

        let msg = t("de", "bot.util.pong", &[]);
        assert_eq!(msg, "Pong!");
    }

    #[test]
    fn test_params() {
        let msg = t("en", "bot.user.created", &[("name", "TestPlayer")]);
        assert_eq!(msg, "User for **TestPlayer** created!");
    }

    #[test]
    fn test_fallback() {
        let msg = t("xx", "bot.util.pong", &[]);
        assert_eq!(msg, "Pong!"); // Falls back to English
    }

    #[test]
    fn test_missing_key() {
        let msg = t("en", "nonexistent.key", &[]);
        assert_eq!(msg, "nonexistent.key");
    }
}
