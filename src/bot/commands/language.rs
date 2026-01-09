use serenity::all::{
    CommandInteraction, Context, CreateInteractionResponse, CreateInteractionResponseMessage,
};
use tracing::info;

use crate::{tr, i18n};
use super::super::Permission;

use super::respond_error;

pub async fn handle_setlanguage(
    ctx: &Context,
    command: &CommandInteraction,
    permission: Permission,
) -> Result<(), serenity::Error> {
    let lang = i18n::get_bot_language();

    if !permission.can_manage_users() {
        return respond_error(ctx, command, &tr!(&lang, "bot.errors.adminOnly")).await;
    }

    let new_lang = command
        .data
        .options
        .iter()
        .find(|o| o.name == "language")
        .and_then(|o| o.value.as_str());

    match new_lang {
        Some(new_lang) => {
            if i18n::set_bot_language(new_lang) {
                info!("Bot language changed to '{}'", new_lang);
                let response = CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(tr!(new_lang, "bot.language.changed", "lang" => new_lang))
                        .ephemeral(true),
                );
                command.create_response(&ctx.http, response).await
            } else {
                let supported = i18n::SUPPORTED_LANGUAGES.join(", ");
                respond_error(
                    ctx,
                    command,
                    &tr!(&lang, "bot.language.invalid", "languages" => &supported),
                )
                .await
            }
        }
        None => {
            // No language specified - show current language
            let supported = i18n::SUPPORTED_LANGUAGES.join(", ");
            let content = format!(
                "{}\n{}",
                tr!(&lang, "bot.language.current", "lang" => &lang),
                tr!(&lang, "bot.language.supported", "languages" => &supported)
            );
            let response = CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .content(content)
                    .ephemeral(true),
            );
            command.create_response(&ctx.http, response).await
        }
    }
}
