use axum::{extract::Extension, Json};
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::*;
use crate::db::queries::messages;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CheckMessagesRequest {
    pub message_ids: Vec<i64>,
}

/// POST /api/messages
pub async fn check_messages(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<CheckMessagesRequest>,
) -> Result<Json<MessageCheckResponse>, AppError> {
    let existing = messages::get_existing_ids(&req.message_ids).await?;

    let new_ids: Vec<i64> = req.message_ids
        .into_iter()
        .filter(|id| !existing.contains(id))
        .collect();

    // Neue IDs speichern
    if !new_ids.is_empty() {
        messages::insert_batch(&new_ids).await?;
    }

    Ok(Json(MessageCheckResponse { new_ids }))
}
