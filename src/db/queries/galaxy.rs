use crate::db::models::PlanetRow;
use crate::get_pool;
use tracing::debug;

pub async fn get_system(galaxy: i64, system: i64) -> Result<Vec<PlanetRow>, sqlx::Error> {
    debug!(galaxy, system, "DB: get_system");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlanetRow>(
        "SELECT id, name, player_id, coordinates, galaxy, system, planet,
                type, planet_id, buildings, fleet, defense, resources, prod_h,
                status, created_at, updated_at
         FROM planets
         WHERE galaxy = ? AND system = ? AND planet > 0 AND (status IS NULL OR status != 'deleted')
         ORDER BY planet, type"
    )
        .bind(galaxy)
        .bind(system)
        .fetch_all(pool)
        .await
}
