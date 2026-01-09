mod export;
mod language;
mod planets;
mod spy;
mod user;
mod util;

use serenity::all::{
    ChannelId, Command, CommandInteraction, CommandOptionType, Context, CreateCommand,
    CreateCommandOption, CreateEmbed, CreateInteractionResponse, CreateInteractionResponseMessage,
    CreateMessage, GuildId,
};
use tracing::{error, info};

use crate::{tr, i18n, CONFIG};
use super::get_permission;

use export::handle_export;
use language::handle_setlanguage;
use planets::{handle_markallseen, handle_newplanets};
use spy::{handle_inactive, handle_spy};
use user::{handle_adduser, handle_removeuser, handle_sendkey, handle_users};
use util::{handle_info, handle_ping};

/// Clear all global commands (run once to remove duplicates)
pub async fn clear_global_commands(ctx: &Context) {
    match Command::set_global_commands(&ctx.http, vec![]).await {
        Ok(_) => info!("Global commands cleared"),
        Err(e) => error!("Error clearing global commands: {:?}", e),
    }
}

/// Register all slash commands with Discord for a specific guild
pub async fn register_commands(ctx: &Context, guild_id: GuildId) {
    let commands = vec![
        // === Utility Commands ===
        CreateCommand::new("ping").description("Check if bot is responding"),
        CreateCommand::new("info").description("Show bot information"),

        // === Spy/Stats Commands ===
        CreateCommand::new("inactive").description("Show top 20 inactive players (farms)"),
        CreateCommand::new("export").description("Export galaxy data as JSON file"),
        CreateCommand::new("spy")
            .description("Show spy report for coordinates")
            .add_option(
                CreateCommandOption::new(CommandOptionType::Integer, "galaxy", "Galaxy (1-9)")
                    .required(true)
                    .min_int_value(1)
                    .max_int_value(9),
            )
            .add_option(
                CreateCommandOption::new(CommandOptionType::Integer, "system", "System (1-499)")
                    .required(true)
                    .min_int_value(1)
                    .max_int_value(499),
            )
            .add_option(
                CreateCommandOption::new(CommandOptionType::Integer, "planet", "Planet (1-15)")
                    .required(true)
                    .min_int_value(1)
                    .max_int_value(15),
            ),

        // === Admin Commands (User Management) ===
        CreateCommand::new("adduser")
            .description("Add a new user (admin only)")
            .add_option(
                CreateCommandOption::new(CommandOptionType::String, "player", "Player name in game")
                    .required(true),
            )
            .add_option(
                CreateCommandOption::new(CommandOptionType::User, "discord_user", "Discord user (receives API key via DM)")
                    .required(false),
            ),
        CreateCommand::new("removeuser")
            .description("Remove a user (admin only)")
            .add_option(
                CreateCommandOption::new(CommandOptionType::String, "name", "Player name")
                    .required(true),
            ),
        CreateCommand::new("users").description("Show all users (admin only)"),
        CreateCommand::new("sendkey")
            .description("Resend API key to a user (admin only)")
            .add_option(
                CreateCommandOption::new(CommandOptionType::String, "name", "Player name")
                    .required(true),
            )
            .add_option(
                CreateCommandOption::new(CommandOptionType::User, "discord_user", "Discord user")
                    .required(true),
            ),

        // === Planet Status Commands ===
        CreateCommand::new("newplanets")
            .description("Show all new planets and mark them as seen (admin only)"),
        CreateCommand::new("markallseen")
            .description("Mark all new planets as seen without output (admin only)"),

        // === Language Command ===
        CreateCommand::new("setlanguage")
            .description("Set or show bot language (admin only)")
            .add_option(
                CreateCommandOption::new(CommandOptionType::String, "language", "Language code (en, de)")
                    .required(false),
            ),
    ];

    match guild_id.set_commands(&ctx.http, commands).await {
        Ok(cmds) => info!("{} slash commands registered for guild {}", cmds.len(), guild_id),
        Err(e) => error!("Error registering commands for guild {}: {:?}", guild_id, e),
    }
}

/// Route incoming commands to the right handler
pub async fn route_command(ctx: &Context, command: &CommandInteraction) {
    let lang = i18n::get_bot_language();

    // Check permissions
    let member = match &command.member {
        Some(m) => m,
        None => {
            let _ = respond_error(
                ctx,
                command,
                &tr!(&lang, "bot.errors.noPermission"),
            )
            .await;
            return;
        }
    };

    let role_ids: Vec<u64> = member.roles.iter().map(|r| r.get()).collect();
    let permission = get_permission(&role_ids);

    // Command routing
    let result = match command.data.name.as_str() {
        // Utility
        "ping" => handle_ping(ctx, command, permission).await,
        "info" => handle_info(ctx, command, permission).await,
        // Spy/Stats
        "inactive" => handle_inactive(ctx, command, permission).await,
        "export" => handle_export(ctx, command, permission).await,
        "spy" => handle_spy(ctx, command, permission).await,
        // Admin
        "adduser" => handle_adduser(ctx, command, permission).await,
        "removeuser" => handle_removeuser(ctx, command, permission).await,
        "users" => handle_users(ctx, command, permission).await,
        "sendkey" => handle_sendkey(ctx, command, permission).await,
        // Planet Status
        "newplanets" => handle_newplanets(ctx, command, permission).await,
        "markallseen" => handle_markallseen(ctx, command, permission).await,
        // Language
        "setlanguage" => handle_setlanguage(ctx, command, permission).await,
        _ => {
            let _ = respond_error(ctx, command, "Unknown command").await;
            return;
        }
    };

    if let Err(e) = result {
        error!("Error in command '{}': {:?}", command.data.name, e);
    }
}

/// Send error message as ephemeral response
pub async fn respond_error(
    ctx: &Context,
    command: &CommandInteraction,
    message: &str,
) -> Result<(), serenity::Error> {
    let response = CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .content(format!("Error: {}", message))
            .ephemeral(true),
    );
    command.create_response(&ctx.http, response).await
}

/// Post embed to spy channel
pub async fn post_to_spy_channel(
    ctx: &Context,
    command: &CommandInteraction,
    embeds: Vec<CreateEmbed>,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    let channel_id = match CONFIG.bot_spy_channel_id {
        Some(id) => ChannelId::new(id),
        None => {
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.channelNotConfigured")).await;
        }
    };

    // Post to spy channel
    let message = CreateMessage::new().embeds(embeds);
    channel_id.send_message(&ctx.http, message).await?;

    // Confirm to user
    let response = CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .content(format!("Spy report posted to <#{}>.", channel_id))
            .ephemeral(true),
    );
    command.create_response(&ctx.http, response).await
}

/// Post embed to bot channel
pub async fn post_to_bot_channel(
    ctx: &Context,
    command: &CommandInteraction,
    embed: CreateEmbed,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    let channel_id = match CONFIG.bot_channel_id {
        Some(id) => ChannelId::new(id),
        None => {
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.channelNotConfigured")).await;
        }
    };

    // Post to bot channel
    let message = CreateMessage::new().embed(embed);
    channel_id.send_message(&ctx.http, message).await?;

    // Confirm to user
    let response = CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .content(format!("Result posted to <#{}>.", channel_id))
            .ephemeral(true),
    );
    command.create_response(&ctx.http, response).await
}
