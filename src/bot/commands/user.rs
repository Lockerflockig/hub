use serenity::all::{
    CommandInteraction, Context, CreateInteractionResponse, CreateInteractionResponseMessage,
    CreateMessage, UserId,
};
use tracing::{error, info, warn};

use crate::{tr, i18n, CONFIG};
use crate::db::queries::bot::{create_user, get_all_users, get_player_by_name, get_user_by_player_name, remove_user};
use super::super::Permission;

use super::respond_error;

pub async fn handle_adduser(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_manage_users() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.adminOnly")).await;
    }

    let player_name = command
        .data
        .options
        .iter()
        .find(|o| o.name == "player")
        .and_then(|o| o.value.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let discord_user_id: Option<UserId> = command
        .data
        .options
        .iter()
        .find(|o| o.name == "discord_user")
        .and_then(|o| o.value.as_user_id());

    if player_name.is_empty() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.playerNotFound", "name" => "")).await;
    }

    let player = match get_player_by_name(&player_name).await {
        Ok(p) => p,
        Err(e) => {
            error!("Player not found: {:?}", e);
            return respond_error(
                ctx,
                command,
                &tr!(&lang, "bot.errors.playerNotFound", "name" => &player_name),
            )
            .await;
        }
    };

    let ally_id = player.alliance_id.unwrap_or(CONFIG.bot_ally_id as i64);

    match create_user(player.id, ally_id).await {
        Ok(api_key) => {
            info!("User created for player '{}'", player_name);

            if let Some(user_id) = discord_user_id {
                let dm_content = format!(
                    "**{}**\n\n\
                    **{}:** {}\n\
                    **{}:** `{}`\n\n\
                    {}",
                    tr!(&lang, "bot.user.sendKeyTitle"),
                    tr!(&lang, "bot.user.sendKeyPlayer"), player_name,
                    tr!(&lang, "bot.user.apiKey"), api_key,
                    tr!(&lang, "bot.user.sendKeyWarning")
                );

                match user_id.create_dm_channel(&ctx.http).await {
                    Ok(dm_channel) => {
                        let message = CreateMessage::new().content(dm_content);
                        if let Err(e) = dm_channel.send_message(&ctx.http, message).await {
                            warn!("Could not send DM: {:?}", e);
                            let content = format!(
                                "{}\n\n{}\n**{}:** `{}`",
                                tr!(&lang, "bot.user.created", "name" => &player_name),
                                tr!(&lang, "bot.user.dmFailed"),
                                tr!(&lang, "bot.user.apiKey"),
                                api_key
                            );
                            let response = CreateInteractionResponse::Message(
                                CreateInteractionResponseMessage::new()
                                    .content(content)
                                    .ephemeral(true),
                            );
                            return command.create_response(&ctx.http, response).await;
                        }

                        let content = format!(
                            "{}\n\n{}",
                            tr!(&lang, "bot.user.created", "name" => &player_name),
                            tr!(&lang, "bot.user.apiKeySent", "user" => &user_id.to_string())
                        );
                        let response = CreateInteractionResponse::Message(
                            CreateInteractionResponseMessage::new()
                                .content(content)
                                .ephemeral(true),
                        );
                        command.create_response(&ctx.http, response).await
                    }
                    Err(e) => {
                        warn!("Could not create DM channel: {:?}", e);
                        let content = format!(
                            "{}\n\n{}\n**{}:** `{}`",
                            tr!(&lang, "bot.user.created", "name" => &player_name),
                            tr!(&lang, "bot.errors.dmError"),
                            tr!(&lang, "bot.user.apiKey"),
                            api_key
                        );
                        let response = CreateInteractionResponse::Message(
                            CreateInteractionResponseMessage::new()
                                .content(content)
                                .ephemeral(true),
                        );
                        command.create_response(&ctx.http, response).await
                    }
                }
            } else {
                let content = format!(
                    "{}\n\n**{}:** `{}`\n\n{}",
                    tr!(&lang, "bot.user.created", "name" => &player_name),
                    tr!(&lang, "bot.user.apiKey"),
                    api_key,
                    tr!(&lang, "bot.user.apiKeyDirect")
                );
                let response = CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(content)
                        .ephemeral(true),
                );
                command.create_response(&ctx.http, response).await
            }
        }
        Err(e) => {
            error!("Error creating user for '{}': {:?}", player_name, e);
            respond_error(ctx, command, &tr!(&lang, "bot.user.createError")).await
        }
    }
}

pub async fn handle_removeuser(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_manage_users() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.adminOnly")).await;
    }

    let player_name = command
        .data
        .options
        .iter()
        .find(|o| o.name == "name")
        .and_then(|o| o.value.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if player_name.is_empty() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.playerNotFound", "name" => "")).await;
    }

    let user = match get_user_by_player_name(&player_name).await {
        Ok(u) => u,
        Err(_) => {
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.userNotFound", "name" => &player_name)).await;
        }
    };

    match remove_user(user.id).await {
        Ok(true) => {
            info!("User for '{}' removed", player_name);
            let response = CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .content(tr!(&lang, "bot.user.removed", "name" => &player_name)),
            );
            command.create_response(&ctx.http, response).await
        }
        Ok(false) => {
            respond_error(ctx, command, &tr!(&lang, "bot.errors.userNotFound", "name" => &player_name)).await
        }
        Err(e) => {
            error!("Error removing user for '{}': {:?}", player_name, e);
            respond_error(ctx, command, &tr!(&lang, "bot.user.removeError")).await
        }
    }
}

pub async fn handle_users(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_manage_users() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.adminOnly")).await;
    }

    match get_all_users().await {
        Ok(users) => {
            if users.is_empty() {
                let response = CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(tr!(&lang, "bot.user.noUsers"))
                        .ephemeral(true),
                );
                return command.create_response(&ctx.http, response).await;
            }

            let mut content = format!("**{}**\n```\n", tr!(&lang, "bot.user.listTitle", "count" => &users.len().to_string()));
            content.push_str(&tr!(&lang, "bot.user.tableHeader"));
            content.push('\n');
            content.push_str(&"-".repeat(50));
            content.push('\n');

            for user in &users {
                let activity = user
                    .last_activity_at
                    .as_deref()
                    .map(|s| {
                        s.split(' ').next().unwrap_or("-").to_string()
                    })
                    .unwrap_or_else(|| "-".to_string());

                let player_name = user
                    .player_name
                    .as_deref()
                    .unwrap_or("-");

                content.push_str(&format!(
                    "{:<4} {:<20} {:<10} {:<10}\n",
                    user.id,
                    truncate(player_name, 18),
                    &user.role,
                    activity
                ));
            }
            content.push_str("```");

            let response = CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .content(content)
                    .ephemeral(true),
            );
            command.create_response(&ctx.http, response).await
        }
        Err(e) => {
            error!("Error loading users: {:?}", e);
            respond_error(ctx, command, &tr!(&lang, "bot.errors.dbError")).await
        }
    }
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() > max_len {
        format!("{}...", &s[..max_len - 3])
    } else {
        s.to_string()
    }
}

pub async fn handle_sendkey(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_manage_users() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.adminOnly")).await;
    }

    let player_name = command
        .data
        .options
        .iter()
        .find(|o| o.name == "name")
        .and_then(|o| o.value.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let discord_user_id = command
        .data
        .options
        .iter()
        .find(|o| o.name == "discord_user")
        .and_then(|o| o.value.as_user_id());

    if player_name.is_empty() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.playerNotFound", "name" => "")).await;
    }

    let user_id = match discord_user_id {
        Some(id) => id,
        None => return respond_error(ctx, command, &tr!(&lang, "bot.errors.playerNotFound", "name" => "")).await,
    };

    let user = match get_user_by_player_name(&player_name).await {
        Ok(u) => u,
        Err(e) => {
            error!("User not found: {:?}", e);
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.userNotFound", "name" => &player_name)).await;
        }
    };

    let api_key = &user.api_key;

    let dm_content = format!(
        "**{}**\n\n\
        **{}:** {}\n\
        **{}:** `{}`\n\n\
        {}",
        tr!(&lang, "bot.user.sendKeyTitle"),
        tr!(&lang, "bot.user.sendKeyPlayer"), player_name,
        tr!(&lang, "bot.user.apiKey"), api_key,
        tr!(&lang, "bot.user.sendKeyWarning")
    );

    match user_id.create_dm_channel(&ctx.http).await {
        Ok(dm_channel) => {
            let message = CreateMessage::new().content(dm_content);
            if let Err(e) = dm_channel.send_message(&ctx.http, message).await {
                warn!("Could not send DM: {:?}", e);
                return respond_error(ctx, command, &tr!(&lang, "bot.errors.dmError")).await;
            }

            info!("API key for '{}' sent to <@{}>", player_name, user_id);
            let response = CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .content(tr!(&lang, "bot.user.apiKeySent", "user" => &user_id.to_string()))
                    .ephemeral(true),
            );
            command.create_response(&ctx.http, response).await
        }
        Err(e) => {
            warn!("Could not create DM channel: {:?}", e);
            respond_error(ctx, command, &tr!(&lang, "bot.errors.dmError")).await
        }
    }
}
