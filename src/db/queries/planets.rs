use crate::get_pool;
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
    sqlx::query(
        "INSERT INTO planets (name, player_id, coordinates, galaxy, system, planet, type, planet_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(coordinates, type) DO UPDATE SET
             name = excluded.name,
             player_id = excluded.player_id,
             planet_id = COALESCE(excluded.planet_id, planets.planet_id),
             updated_at = CURRENT_TIMESTAMP"
    )
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
    sqlx::query_file!("queries/planets/update_buildings.sql", buildings_json, coordinates, planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_fleet(coordinates: &str, planet_type: &str, fleet_json: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: update_fleet");
    let pool = get_pool().await;
    sqlx::query_file!("queries/planets/update_fleet.sql", fleet_json, coordinates, planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_defense(coordinates: &str, planet_type: &str, defense_json: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: update_defense");
    let pool = get_pool().await;
    sqlx::query_file!("queries/planets/update_defense.sql", defense_json, coordinates, planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_resources(coordinates: &str, planet_type: &str, resources_json: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: update_resources");
    let pool = get_pool().await;
    sqlx::query_file!("queries/planets/update_resources.sql", resources_json, coordinates, planet_type)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_deleted(coordinates: &str, planet_type: &str) -> Result<(), sqlx::Error> {
    debug!(coordinates, planet_type, "DB: mark_deleted planet");
    let pool = get_pool().await;
    sqlx::query("UPDATE planets SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE coordinates = ? AND type = ?")
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

    sqlx::query(
        r#"INSERT INTO planets (
            planet_id, player_id, name, coordinates, galaxy, system, planet, type,
            fields_used, fields_max, temperature, points,
            metal_prod_h, crystal_prod_h, deut_prod_h, energy_used, energy_max,
            resources, buildings, fleet, defense, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PLANET', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seen')
        ON CONFLICT(coordinates, type) DO UPDATE SET
            planet_id = excluded.planet_id,
            player_id = excluded.player_id,
            name = excluded.name,
            fields_used = excluded.fields_used,
            fields_max = excluded.fields_max,
            temperature = excluded.temperature,
            points = excluded.points,
            metal_prod_h = excluded.metal_prod_h,
            crystal_prod_h = excluded.crystal_prod_h,
            deut_prod_h = excluded.deut_prod_h,
            energy_used = excluded.energy_used,
            energy_max = excluded.energy_max,
            resources = excluded.resources,
            buildings = excluded.buildings,
            fleet = excluded.fleet,
            defense = excluded.defense,
            status = 'seen',
            updated_at = CURRENT_TIMESTAMP"#
    )
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
