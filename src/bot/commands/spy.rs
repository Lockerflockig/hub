use serenity::all::{CommandInteraction, Context};
use tracing::error;

use crate::{tr, i18n};
use crate::db::queries::bot::{get_spy_report, get_top_inactive};
use super::super::format::{format_inactive_players, format_spy_report};
use super::super::Permission;

use super::{post_to_bot_channel, post_to_spy_channel, respond_error};

pub async fn handle_inactive(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_use_commands() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.noPermission")).await;
    }

    match get_top_inactive().await {
        Ok(players) => {
            let embed = format_inactive_players(&players, &lang);
            post_to_bot_channel(ctx, command, embed).await
        }
        Err(e) => {
            error!("DB error in /inactive: {:?}", e);
            respond_error(ctx, command, &tr!(&lang, "bot.errors.dbError")).await
        }
    }
}

pub async fn handle_spy(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_use_commands() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.noPermission")).await;
    }

    let galaxy = command
        .data
        .options
        .iter()
        .find(|o| o.name == "galaxy")
        .and_then(|o| o.value.as_i64())
        .unwrap_or(1);

    let system = command
        .data
        .options
        .iter()
        .find(|o| o.name == "system")
        .and_then(|o| o.value.as_i64())
        .unwrap_or(1);

    let planet = command
        .data
        .options
        .iter()
        .find(|o| o.name == "planet")
        .and_then(|o| o.value.as_i64())
        .unwrap_or(1);

    match get_spy_report(galaxy, system, planet).await {
        Ok(report) => {
            let embeds = format_spy_report(&report, &lang);
            post_to_spy_channel(ctx, command, embeds).await
        }
        Err(e) => {
            let coords = format!("{}:{}:{}", galaxy, system, planet);
            error!("DB error in /spy {}: {:?}", coords, e);
            respond_error(
                ctx,
                command,
                &tr!(&lang, "bot.spy.noReport", "coords" => &coords),
            )
            .await
        }
    }
}
