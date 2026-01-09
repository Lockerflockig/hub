use serenity::all::Interaction;
use serenity::async_trait;
use serenity::client::{Context, EventHandler};
use serenity::model::gateway::Ready;
use tracing::info;

use super::commands::{clear_global_commands, register_commands, route_command};

pub struct Handler;

#[async_trait]
impl EventHandler for Handler {
    async fn ready(&self, ctx: Context, ready: Ready) {
        info!("Bot ist online als: {}", ready.user.name);

        // Clear old global commands (they cause duplicates)
        clear_global_commands(&ctx).await;

        // Register commands for all guilds (instant sync, no 1-hour delay)
        for guild in &ready.guilds {
            register_commands(&ctx, guild.id).await;
        }
    }

    async fn interaction_create(&self, ctx: Context, interaction: Interaction) {
        if let Interaction::Command(command) = interaction {
            route_command(&ctx, &command).await;
        }
    }
}
