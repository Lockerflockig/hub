use crate::get_pool;
use super::sql;
use tracing::debug;

pub async fn upsert(
    player_id: i64,
    coordinates: &str,
    galaxy: i64,
    system: i64,
    planet: i64,
    planet_type: &str,
    name: Option<&str>,
    pr0_planet_id: Option<i64>,
) -> Result<(), sqlx::Error> {
    debug!(player_id, coordinates, ?name, ?pr0_planet_id, "DB: upsert planet");
    let pool = get_pool().await;
    sqlx::query(sql!(planets, upsert_galaxy))
        .bind(name)
        .bind(player_id)
        .bind(coordinates)
        .bind(galaxy)
        .bind(system)
        .bind(planet)
        .bind(planet_type)
        .bind(pr0_planet_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_buildings(coordinates: &str, planet_type: &str, buildings_json: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: update_buildings");
    let pool = get_pool().await;
    sqlx::query(sql!(planets, update_buildings))
        .bind(buildings_json)
        .bind(coordinates)
        .bind(planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_fleet(coordinates: &str, planet_type: &str, fleet_json: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: update_fleet");
    let pool = get_pool().await;
    sqlx::query(sql!(planets, update_fleet))
        .bind(fleet_json)
        .bind(coordinates)
        .bind(planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_defense(coordinates: &str, planet_type: &str, defense_json: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: update_defense");
    let pool = get_pool().await;
    sqlx::query(sql!(planets, update_defense))
        .bind(defense_json)
        .bind(coordinates)
        .bind(planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_resources(coordinates: &str, planet_type: &str, resources_json: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: update_resources");
    let pool = get_pool().await;
    sqlx::query(sql!(planets, update_resources))
        .bind(resources_json)
        .bind(coordinates)
        .bind(planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_deleted(coordinates: &str, planet_type: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: mark_deleted planet");
    let pool = get_pool().await;
    sqlx::query(sql!(planets, mark_deleted))
        .bind(coordinates)
        .bind(planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

/// Full upsert from Empire page with all data
pub async fn upsert_empire(
    player_id: i64,
    pr0_planet_id: i64,
    name: &str,
    coordinates: &str,
    galaxy: i64,
    system: i64,
    planet: i64,
    fields_used: i64,
    fields_max: i64,
    temperature: i64,
    points: i64,
    production: &crate::api::handlers::empire::EmpireProduction,
    resources: &std::collections::HashMap<String, i64>,
    buildings: &std::collections::HashMap<String, i64>,
    fleet: &std::collections::HashMap<String, i64>,
    defense: &std::collections::HashMap<String, i64>,
) -> Result<(), sqlx::Error> {
    debug!(player_id, coordinates, name, "DB: upsert_empire");
    let pool = get_pool().await;

    let resources_json = serde_json::to_string(resources).unwrap_or_default();
    let buildings_json = serde_json::to_string(buildings).unwrap_or_default();
    let fleet_json = serde_json::to_string(fleet).unwrap_or_default();
    let defense_json = serde_json::to_string(defense).unwrap_or_default();

    sqlx::query(sql!(planets, upsert_empire))
        .bind(pr0_planet_id)
        .bind(player_id)
        .bind(name)
        .bind(coordinates)
        .bind(galaxy)
        .bind(system)
        .bind(planet)
        .bind(fields_used)
        .bind(fields_max)
        .bind(temperature)
        .bind(points)
        .bind(production.metal)
        .bind(production.crystal)
        .bind(production.deuterium)
        .bind(production.energy_used)
        .bind(production.energy_max)
        .bind(&resources_json)
        .bind(&buildings_json)
        .bind(&fleet_json)
        .bind(&defense_json)
        .execute(pool)
        .await?;
    Ok(())
}
