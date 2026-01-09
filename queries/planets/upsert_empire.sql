INSERT INTO planets (
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
    updated_at = CURRENT_TIMESTAMP
