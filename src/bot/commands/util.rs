use serenity::all::{
    CommandInteraction, Context, CreateInteractionResponse, CreateInteractionResponseMessage,
};

use crate::{tr, i18n, CONFIG, get_pool};
use super::super::Permission;

use super::respond_error;

pub async fn handle_ping(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_use_commands() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.noPermission")).await;
    }

    let pool = get_pool().await;
    let db_status = match sqlx::query("SELECT 1").execute(pool).await {
        Ok(_) => tr!(&lang, "bot.util.connected"),
        Err(e) => tr!(&lang, "bot.util.queryFailed", "error" => &e.to_string()),
    };

    let content = format!(
        "**{}**\n\n**{}:** {}",
        tr!(&lang, "bot.util.pong"),
        tr!(&lang, "bot.util.database"),
        db_status
    );

    let response = CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new().content(content),
    );
    command.create_response(&ctx.http, response).await
}

pub async fn handle_info(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_use_commands() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.noPermission")).await;
    }

    let content = format!(
        "**{}**\n{}: {}\n{}: {:?}",
        tr!(&lang, "bot.util.botInfo"),
        tr!(&lang, "bot.util.allyId"), CONFIG.bot_ally_id,
        tr!(&lang, "bot.util.permission"), permission
    );

    let response = CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new().content(content),
    );
    command.create_response(&ctx.http, response).await
}
