use sqlx::SqlitePool;

pub async fn connect(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
    let pool = SqlitePool::connect(database_url).await?;

    // Enable foreign key constraints
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;

    // Run migrations
    sqlx::migrate!()
        .run(&pool)
        .await?;

    Ok(pool)
}
