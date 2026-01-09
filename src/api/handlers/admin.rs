use axum::{
    extract::{Extension, Path},
    Json,
};
use serde::Deserialize;
use tracing::info;
use uuid::Uuid;

use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::{
    AdminCheckResponse, AdminUserCreatedResponse, AdminUserInfo, AdminUsersResponse, SuccessResponse,
};
use crate::db::models::UserRole;
use crate::db::queries::{config, players, users};

/// Helper function to check if user is admin
fn require_admin(user: &crate::db::models::UserRow) -> Result<(), AppError> {
    if user.role != UserRole::Admin {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

/// GET /api/admin/check - Check if current user is admin
pub async fn check_admin(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<AdminCheckResponse>, AppError> {
    Ok(Json(AdminCheckResponse {
        is_admin: user.role == UserRole::Admin,
    }))
}

/// GET /api/admin/users - List all users (admin only)
pub async fn list_users(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<AdminUsersResponse>, AppError> {
    require_admin(&user)?;

    let user_rows = users::get_all().await?;

    let users: Vec<AdminUserInfo> = user_rows
        .into_iter()
        .map(|u| AdminUserInfo {
            id: u.id,
            player_id: u.player_id,
            player_name: u.player_name,
            alliance_id: u.alliance_id,
            alliance_name: u.alliance_name,
            language: u.language,
            role: u.role.as_str().to_string(),
            last_activity_at: u.last_activity_at,
            created_at: u.created_at,
        })
        .collect();

    Ok(Json(AdminUsersResponse { users }))
}

/// POST /api/admin/users - Create a new user (admin only)
#[derive(Deserialize)]
pub struct CreateUserRequest {
    /// Player ID (pr0game internal ID)
    pub player_id: Option<i64>,
    /// Player name (alternative to player_id)
    pub player_name: Option<String>,
    /// Alliance ID (optional)
    pub alliance_id: Option<i64>,
}

pub async fn create_user(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<AdminUserCreatedResponse>, AppError> {
    require_admin(&user)?;

    // Resolve player_id from name if not provided
    let player_id = match (req.player_id, req.player_name) {
        (Some(id), _) => Some(id),
        (None, Some(name)) => {
            let player = players::get_by_name(&name)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("Spieler '{}' nicht gefunden", name)))?;
            Some(player.id)
        }
        (None, None) => None,
    };

    // Check if user already exists for this player
    if let Some(pid) = player_id {
        if users::get_by_player_id(pid).await?.is_some() {
            return Err(AppError::BadRequest(
                "Für diesen Spieler existiert bereits ein User".into(),
            ));
        }
    }

    // Generate API key
    let api_key = Uuid::new_v4().to_string();

    // Create user
    let user_id = users::create(&api_key, player_id, req.alliance_id).await?;

    // Also ensure player exists and set alliance_id
    if let Some(pid) = player_id {
        // Get player name if we have it
        let player_name = players::get_by_id(pid).await?.map(|p| p.name).unwrap_or_default();
        players::ensure_exists(pid, &player_name).await?;

        if let Some(alliance_id) = req.alliance_id {
            players::update_alliance(pid, alliance_id).await?;
        }
    }

    info!(user_id, ?player_id, "Admin created new user");

    Ok(Json(AdminUserCreatedResponse {
        success: true,
        user_id,
        api_key,
    }))
}

/// DELETE /api/admin/users/{id} - Delete a user (admin only)
pub async fn delete_user(
    Path(user_id): Path<i64>,
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<SuccessResponse>, AppError> {
    require_admin(&user)?;

    // Prevent self-deletion
    if user_id == user.id {
        return Err(AppError::BadRequest(
            "Du kannst dich nicht selbst löschen".into(),
        ));
    }

    let deleted = users::delete(user_id).await?;

    if !deleted {
        return Err(AppError::NotFound("User nicht gefunden".into()));
    }

    info!(user_id, admin_id = user.id, "Admin deleted user");

    Ok(Json(SuccessResponse { success: true }))
}

/// PUT /api/admin/users/{id}/role - Update user role (admin only)
#[derive(Deserialize)]
pub struct UpdateRoleRequest {
    pub role: String,
}

pub async fn update_user_role(
    Path(user_id): Path<i64>,
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<UpdateRoleRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    require_admin(&user)?;

    // Prevent self-demotion (last admin)
    if user_id == user.id && req.role != "admin" {
        // Check if there are other admins
        let all_users = users::get_all().await?;
        let admin_count = all_users.iter().filter(|u| u.role == UserRole::Admin).count();
        if admin_count <= 1 {
            return Err(AppError::BadRequest(
                "Du bist der letzte Admin und kannst dich nicht selbst herabstufen".into(),
            ));
        }
    }

    let role = match req.role.as_str() {
        "admin" => UserRole::Admin,
        "user" => UserRole::User,
        _ => return Err(AppError::BadRequest("Ungültige Rolle. Erlaubt: admin, user".into())),
    };

    let updated = users::update_role(user_id, role).await?;

    if !updated {
        return Err(AppError::NotFound("User nicht gefunden".into()));
    }

    info!(user_id, ?role, admin_id = user.id, "Admin updated user role");

    Ok(Json(SuccessResponse { success: true }))
}

/// GET /api/admin/users/{id}/apikey - Get API key for a user (admin only)
pub async fn get_user_api_key(
    Path(user_id): Path<i64>,
    Extension(AuthUser(admin)): Extension<AuthUser>,
) -> Result<Json<ApiKeyResponse>, AppError> {
    require_admin(&admin)?;

    // Find the user
    let all_users_raw = users::get_all().await?;

    // We need to get the full user row with api_key
    // Let's use the player_id to look up the user
    let target_user = all_users_raw.iter().find(|u| u.id == user_id);

    let player_id = target_user
        .and_then(|u| u.player_id)
        .ok_or_else(|| AppError::NotFound("User nicht gefunden".into()))?;

    let user_row = users::get_by_player_id(player_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User nicht gefunden".into()))?;

    Ok(Json(ApiKeyResponse {
        api_key: user_row.api_key,
    }))
}

#[derive(serde::Serialize)]
pub struct ApiKeyResponse {
    pub api_key: String,
}

/// PUT /api/admin/config - Update universe configuration (admin only)
#[derive(Deserialize)]
pub struct UpdateConfigRequest {
    pub galaxies: Option<i64>,
    pub systems: Option<i64>,
    pub galaxy_wrapped: Option<bool>,
}

pub async fn update_config(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<UpdateConfigRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    require_admin(&user)?;

    // Validate values
    if let Some(galaxies) = req.galaxies {
        if galaxies < 1 || galaxies > 20 {
            return Err(AppError::BadRequest("Galaxien muss zwischen 1 und 20 sein".into()));
        }
        config::set_config("galaxies", &galaxies.to_string()).await?;
        info!(galaxies, admin_id = user.id, "Admin updated galaxies config");
    }

    if let Some(systems) = req.systems {
        if systems < 1 || systems > 999 {
            return Err(AppError::BadRequest("Systeme muss zwischen 1 und 999 sein".into()));
        }
        config::set_config("systems", &systems.to_string()).await?;
        info!(systems, admin_id = user.id, "Admin updated systems config");
    }

    if let Some(galaxy_wrapped) = req.galaxy_wrapped {
        config::set_config("galaxy_wrapped", if galaxy_wrapped { "true" } else { "false" }).await?;
        info!(galaxy_wrapped, admin_id = user.id, "Admin updated galaxy_wrapped config");
    }

    Ok(Json(SuccessResponse { success: true }))
}
