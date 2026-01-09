use serenity::all::{
    ChannelId, CommandInteraction, Context, CreateAttachment, CreateInteractionResponse,
    CreateInteractionResponseMessage, CreateMessage,
};
use tracing::{error, info};

use crate::{tr, i18n, CONFIG};
use crate::db::queries::bot::build_export_json;
use super::super::Permission;

use super::respond_error;

pub async fn handle_export(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_use_commands() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.noPermission")).await;
    }

    let bot_channel_id = match CONFIG.bot_channel_id {
        Some(id) => id,
        None => {
            return respond_error(ctx, command, &tr!(&lang, "bot.errors.channelNotConfigured")).await;
        }
    };

    // Send initial "working" response
    let response = CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .content(tr!(&lang, "bot.export.exporting"))
            .ephemeral(true),
    );
    command.create_response(&ctx.http, response).await?;

    // Build the JSON export
    match build_export_json().await {
        Ok(json_data) => {
            let size_kb = json_data.len() / 1024;
            info!(size_kb, "JSON export created");

            // Create attachment from the JSON string
            let attachment = CreateAttachment::bytes(json_data.as_bytes(), "galaxy_export.json");

            // Send to bot channel with the file
            let channel_id = ChannelId::new(bot_channel_id);
            let message = CreateMessage::new()
                .content(format!("Galaxy-Export ({} KB)", size_kb))
                .add_file(attachment);

            match channel_id.send_message(&ctx.http, message).await {
                Ok(_) => {
                    let msg = tr!(&lang, "bot.export.success",
                        "channel" => &bot_channel_id.to_string(),
                        "size" => &size_kb.to_string()
                    );
                    command
                        .edit_response(
                            &ctx.http,
                            serenity::all::EditInteractionResponse::new().content(msg),
                        )
                        .await?;
                    Ok(())
                }
                Err(e) => {
                    error!("Error sending export file: {:?}", e);
                    command
                        .edit_response(
                            &ctx.http,
                            serenity::all::EditInteractionResponse::new()
                                .content(tr!(&lang, "bot.errors.sendError")),
                        )
                        .await?;
                    Ok(())
                }
            }
        }
        Err(e) => {
            error!("DB error in /export: {:?}", e);
            command
                .edit_response(
                    &ctx.http,
                    serenity::all::EditInteractionResponse::new()
                        .content(tr!(&lang, "bot.export.error")),
                )
                .await?;
            Ok(())
        }
    }
}
