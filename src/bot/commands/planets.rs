use serenity::all::{
    ChannelId, CommandInteraction, Context, CreateInteractionResponse,
    CreateInteractionResponseMessage, CreateMessage,
};
use tracing::{error, info};

use crate::{tr, i18n, CONFIG};
use crate::db::queries::bot::{get_new_planets, mark_all_planets_seen, mark_planets_seen_by_ids};
use super::super::format::format_new_planets;
use super::super::Permission;

use super::respond_error;

/// Maximum embeds per Discord message
const MAX_EMBEDS_PER_MESSAGE: usize = 10;

pub async fn handle_newplanets(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_manage_users() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.adminOnly")).await;
    }

    let channel_id = match CONFIG.bot_channel_id {
        Some(id) => ChannelId::new(id),
        None => {
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.channelNotConfigured")).await;
        }
    };

    // Get new planets
    let planets = match get_new_planets().await {
        Ok(p) => p,
        Err(e) => {
            error!("DB error in /newplanets: {:?}", e);
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.dbError")).await;
        }
    };

    if planets.is_empty() {
        let response = CreateInteractionResponse::Message(
            CreateInteractionResponseMessage::new()
                .content(tr!(&lang, "bot.planets.noNewPlanets"))
                .ephemeral(true),
        );
        return command.create_response(&ctx.http, response).await;
    }

    // Collect IDs before formatting
    let planet_ids: Vec<i64> = planets.iter().map(|p| p.id).collect();
    let planet_count = planets.len();

    // Format planets
    let embeds = format_new_planets(&planets, &lang);

    // Send embeds in batches (Discord limit: 10 embeds per message)
    for chunk in embeds.chunks(MAX_EMBEDS_PER_MESSAGE) {
        let message = CreateMessage::new().embeds(chunk.to_vec());
        if let Err(e) = channel_id.send_message(&ctx.http, message).await {
            error!("Error sending planet message: {:?}", e);
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.sendError")).await;
        }
    }

    // Mark planets as seen
    match mark_planets_seen_by_ids(&planet_ids).await {
        Ok(count) => {
            info!(count, "planets marked as seen");
        }
        Err(e) => {
            error!("Error marking planets as seen: {:?}", e);
        }
    }

    // Confirm to user
    let msg = tr!(&lang, "bot.planets.posted",
        "count" => &planet_count.to_string(),
        "channel" => &channel_id.to_string()
    );
    let response = CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .content(msg)
            .ephemeral(true),
    );
    command.create_response(&ctx.http, response).await
}

pub async fn handle_markallseen(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_manage_users() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.adminOnly")).await;
    }

    match mark_all_planets_seen().await {
        Ok(count) => {
            info!(count, "planets marked as seen");
            let msg = tr!(&lang, "bot.planets.markedSeen", "count" => &count.to_string());
            let response = CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .content(msg)
                    .ephemeral(true),
            );
            command.create_response(&ctx.http, response).await
        }
        Err(e) => {
            error!("DB error in /markallseen: {:?}", e);
            respond_error(ctx, command, &tr!(&lang, "bot.planets.markError")).await
        }
    }
}
