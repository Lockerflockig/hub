//! Discord Bot Module
//!
//! Integrated Discord bot that runs as a tokio task within the main hg_hub process.

pub mod commands;
pub mod format;
pub mod handler;

use serenity::prelude::GatewayIntents;
use serenity::Client;
use tracing::{error, info, warn};

use crate::CONFIG;

pub use handler::Handler;

/// Permission levels for Discord commands
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    Admin,
    User,
    None,
}

impl Permission {
    /// Check if user can manage other users
    pub fn can_manage_users(&self) -> bool {
        matches!(self, Permission::Admin)
    }

    /// Check if user can use standard commands
    pub fn can_use_commands(&self) -> bool {
        matches!(self, Permission::Admin | Permission::User)
    }
}

/// Check user permission based on their Discord roles
pub fn get_permission(role_ids: &[u64]) -> Permission {
    if role_ids.iter().any(|r| CONFIG.bot_admin_role_ids.contains(r)) {
        Permission::Admin
    } else if role_ids.iter().any(|r| CONFIG.bot_user_role_ids.contains(r)) {
        Permission::User
    } else {
        Permission::None
    }
}

/// Check if bot is fully configured and can start
pub fn bot_enabled() -> bool {
    CONFIG.bot_token.is_some()
        && !CONFIG.bot_admin_role_ids.is_empty()
        && CONFIG.bot_spy_channel_id.is_some()
        && CONFIG.bot_channel_id.is_some()
}

/// Run the Discord bot
///
/// This function runs indefinitely and should be spawned as a tokio task.
/// It will log an error and return if the bot is not properly configured.
pub async fn run_bot() {
    if !bot_enabled() {
        if CONFIG.bot_token.is_none() {
            warn!("Bot disabled: BOT_TOKEN not set");
        } else {
            warn!("Bot disabled: Missing configuration (ADMIN_ROLE_IDS, SPY_CHANNEL_ID, BOT_CHANNEL_ID)");
        }
        return;
    }

    let token = CONFIG.bot_token.as_ref().unwrap();

    info!("Starting Discord bot...");
    info!("Ally ID: {}", CONFIG.bot_ally_id);
    info!("Admin Roles: {:?}", CONFIG.bot_admin_role_ids);
    info!("User Roles: {:?}", CONFIG.bot_user_role_ids);

    let intents = GatewayIntents::GUILD_MESSAGES | GatewayIntents::GUILDS;

    let client = Client::builder(token, intents)
        .event_handler(Handler)
        .await;

    match client {
        Ok(mut client) => {
            if let Err(e) = client.start().await {
                error!("Discord bot error: {:?}", e);
            }
        }
        Err(e) => {
            error!("Could not create Discord client: {:?}", e);
        }
    }
}
