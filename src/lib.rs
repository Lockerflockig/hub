use std::sync::LazyLock;
use sqlx::SqlitePool;
use tokio::sync::OnceCell;
use tracing::{debug, info};

pub mod db;
pub mod api;
pub mod bot;
pub mod i18n;

pub struct Config {
    pub database_url: String,
    pub log_level: String,
    pub host: String,
    pub port: u16,
    // Bot config
    pub bot_token: Option<String>,
    pub bot_ally_id: u32,
    pub bot_admin_role_ids: Vec<u64>,
    pub bot_user_role_ids: Vec<u64>,
    pub bot_spy_channel_id: Option<u64>,
    pub bot_channel_id: Option<u64>,
    pub bot_language: String,
}
static DB_POOL: OnceCell<SqlitePool> = OnceCell::const_new();
pub async fn get_pool() -> &'static SqlitePool {
    DB_POOL.get_or_init(|| async {
        debug!(database_url = %CONFIG.database_url, "Connecting to database");
        let pool = SqlitePool::connect(CONFIG.database_url.as_str())
            .await
            .expect("Failed to connect to database");

        // Enable foreign keys
        debug!("Enabling foreign keys");
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .expect("Failed to enable foreign keys");

        // Run migrations
        debug!("Running database migrations");
        sqlx::migrate!()
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        info!("Database pool initialized successfully");
        pool
    }).await
}
/// Parse comma-separated list of u64 values from env var
fn parse_role_ids(var_name: &str) -> Vec<u64> {
    std::env::var(var_name)
        .unwrap_or_default()
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect()
}

pub static CONFIG: LazyLock<Config> = LazyLock::new(|| {
    dotenvy::dotenv().ok();
    Config {
        database_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
        log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
        host: std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
        port: std::env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .expect("PORT must be a valid number"),
        // Bot config
        bot_token: std::env::var("BOT_TOKEN").ok(),
        bot_ally_id: std::env::var("ALLY_ID")
            .unwrap_or_else(|_| "0".to_string())
            .parse()
            .unwrap_or(0),
        bot_admin_role_ids: parse_role_ids("ADMIN_ROLE_IDS"),
        bot_user_role_ids: parse_role_ids("USER_ROLE_IDS"),
        bot_spy_channel_id: std::env::var("SPY_CHANNEL_ID").ok().and_then(|s| s.parse().ok()),
        bot_channel_id: std::env::var("BOT_CHANNEL_ID").ok().and_then(|s| s.parse().ok()),
        bot_language: std::env::var("BOT_LANGUAGE").unwrap_or_else(|_| "en".to_string()),
    }
});