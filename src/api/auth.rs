use axum::{
    extract::Request,
    http::header,
    middleware::Next,
    response::Response,
};
use tracing::debug;
use crate::db::models::UserRow;
use crate::db::queries::users;
use super::error::AppError;

#[derive(Clone)]
pub struct AuthUser(pub UserRow);

/// Mask an API key for safe logging (shows first 4 and last 4 chars)
pub fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        return "*".repeat(key.len());
    }
    format!("{}...{}", &key[..4], &key[key.len()-4..])
}

pub async fn auth_middleware(
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let api_key = request
        .headers()
        .get("X-API-Key")
        .or_else(|| request.headers().get(header::AUTHORIZATION))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim_start_matches("Bearer ").trim().to_string());

    debug!(api_key_masked = ?api_key.as_ref().map(|k| mask_api_key(k)), "Auth: extracted API key");

    let Some(api_key) = api_key else {
        debug!("Auth: no API key found in headers");
        return Err(AppError::Unauthorized);
    };

    let Some(user) = users::get_by_api_key(&api_key).await? else {
        debug!(api_key_masked = %mask_api_key(&api_key), "Auth: API key not found in database");
        return Err(AppError::Unauthorized);
    };

    debug!(user_id = user.id, "Auth: user authenticated");

    // Update last activity (fire and forget)
    let user_id = user.id;
    tokio::spawn(async move {
        let _ = users::update_activity(user_id).await;
    });

    request.extensions_mut().insert(AuthUser(user));
    Ok(next.run(request).await)
}
