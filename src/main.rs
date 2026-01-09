use hub::{get_pool, api, bot, CONFIG};
use std::net::SocketAddr;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing subscriber with log level from .env
    let filter = EnvFilter::try_new(&CONFIG.log_level)
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!(log_level = %CONFIG.log_level, "Tracing initialized");

    // Pool initialisieren
    let _pool = get_pool().await;

    // Start Discord bot as tokio task if configured
    if bot::bot_enabled() {
        info!("Discord bot enabled, starting...");
        tokio::spawn(bot::run_bot());
    } else {
        info!("Discord bot disabled (missing configuration)");
    }

    let app = api::routes::create_router();

    let host: std::net::IpAddr = CONFIG.host.parse()
        .expect("HOST must be a valid IP address");
    let addr = SocketAddr::from((host, CONFIG.port));
    info!(%addr, "Server running");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
