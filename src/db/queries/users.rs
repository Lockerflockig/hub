use crate::db::models::{UserRow, UserListRow, UserRole};
use crate::get_pool;
use crate::api::auth::mask_api_key;
use tracing::debug;

pub async fn get_by_api_key(api_key: &str) -> Result<Option<UserRow>, sqlx::Error> {
    debug!(api_key_len = api_key.len(), api_key_masked = %mask_api_key(api_key), "DB: users::get_by_api_key");
    let pool = get_pool().await;

    sqlx::query_file_as!(UserRow, "queries/users/get_by_api_key.sql", api_key)
        .fetch_optional(pool)
        .await
}

pub async fn get_by_player_id(player_id: i64) -> Result<Option<UserRow>, sqlx::Error> {
    debug!(player_id, "DB: users::get_by_player_id");
    let pool = get_pool().await;
    sqlx::query_file_as!(UserRow, "queries/users/get_by_player_id.sql", player_id)
        .fetch_optional(pool)
        .await
}

pub async fn get_all() -> Result<Vec<UserListRow>, sqlx::Error> {
    debug!("DB: users::get_all");
    let pool = get_pool().await;
    sqlx::query_file_as!(UserListRow, "queries/users/get_all.sql")
        .fetch_all(pool)
        .await
}

pub async fn update_activity(user_id: i64) -> Result<(), sqlx::Error> {
    debug!(user_id, "DB: users::update_activity");
    let pool = get_pool().await;
    sqlx::query_file!("queries/users/update_activity.sql", user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn create(api_key: &str, player_id: Option<i64>, alliance_id: Option<i64>) -> Result<i64, sqlx::Error> {
    debug!(?player_id, ?alliance_id, "DB: users::create");
    let pool = get_pool().await;
    let result = sqlx::query_file!("queries/users/create.sql", api_key, player_id, alliance_id)
        .execute(pool)
        .await?;
    Ok(result.last_insert_rowid())
}

pub async fn delete(user_id: i64) -> Result<bool, sqlx::Error> {
    debug!(user_id, "DB: users::delete");
    let pool = get_pool().await;
    let result = sqlx::query_file!("queries/users/delete.sql", user_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn update_role(user_id: i64, role: UserRole) -> Result<bool, sqlx::Error> {
    debug!(user_id, ?role, "DB: users::update_role");
    let pool = get_pool().await;
    let role_str = role.as_str();
    let result = sqlx::query_file!("queries/users/update_role.sql", role_str, user_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn update_language(user_id: i64, language: &str) -> Result<(), sqlx::Error> {
    debug!(user_id, language, "DB: users::update_language");
    let pool = get_pool().await;
    sqlx::query_file!("queries/users/update_language.sql", language, user_id)
        .execute(pool)
        .await?;
    Ok(())
}
