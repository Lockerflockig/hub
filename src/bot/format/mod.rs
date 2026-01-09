use serenity::all::{CreateEmbed, Colour};
use crate::db::models::{BotSpyReport, InactivePlayer, NewPlanet};
use crate::tr;

/// Format a spy report as Discord embeds
pub fn format_spy_report(report: &BotSpyReport, lang: &str) -> Vec<CreateEmbed> {
    let coords = format!("{}:{}:{}", report.galaxy, report.system, report.planet);
    let unknown = tr!(lang, "bot.spy.unknown");
    let timestamp = report.created_at.as_deref().unwrap_or(&unknown);
    let reporter = report.reporter_name.as_deref().unwrap_or(&unknown);
    let player = report.player_name.as_deref().unwrap_or(&unknown);
    let alliance = report.alliance_name.as_deref().unwrap_or("-");

    let footer_text = tr!(lang, "bot.spy.spiedBy", "name" => reporter);

    vec![
        // Header Embed
        CreateEmbed::new()
            .author(serenity::all::CreateEmbedAuthor::new(tr!(lang, "bot.spy.title")))
            .title(coords)
            .description(format!(
                "**{}:** {}\n**{}:** {}\n{}",
                tr!(lang, "hub.overview.table.player"), player,
                tr!(lang, "hub.overview.table.ally"), alliance,
                timestamp
            ))
            .colour(Colour::from_rgb(26, 237, 44))
            .footer(serenity::all::CreateEmbedFooter::new(footer_text)),

        // Resources
        CreateEmbed::new()
            .title(tr!(lang, "bot.spy.resources"))
            .colour(Colour::from_rgb(235, 225, 52))
            .description(format_resources(report, lang)),

        // Buildings
        CreateEmbed::new()
            .title(tr!(lang, "bot.spy.buildings"))
            .colour(Colour::from_rgb(52, 152, 219))
            .description(format_buildings(report, lang)),

        // Defense
        CreateEmbed::new()
            .title(tr!(lang, "bot.spy.defense"))
            .colour(Colour::from_rgb(227, 26, 237))
            .description(format_defense(report, lang)),

        // Fleet
        CreateEmbed::new()
            .title(tr!(lang, "bot.spy.fleet"))
            .colour(Colour::from_rgb(235, 33, 50))
            .description(format_fleet(report, lang)),
    ]
}

/// Format top inactive players as Discord embed
pub fn format_inactive_players(players: &[InactivePlayer], lang: &str) -> CreateEmbed {
    let mut desc = String::new();

    let points_label = tr!(lang, "bot.inactive.points");
    let fleet_label = tr!(lang, "bot.inactive.fleet");
    let since_label = tr!(lang, "bot.inactive.since");

    for (i, player) in players.iter().enumerate() {
        let name = player.name.as_deref().unwrap_or("?");
        let score = player.score_total.unwrap_or(0);
        let fleet = player.score_fleet.unwrap_or(0);
        let inactive_date = player.inactive_since.as_deref().unwrap_or("?");

        desc.push_str(&format!(
            "**{}. {}**\n{}: {} | {}: {} | {}: {}\n\n",
            i + 1, name,
            points_label, format_number(score),
            fleet_label, format_number(fleet),
            since_label, inactive_date
        ));
    }

    if desc.is_empty() {
        desc = tr!(lang, "bot.inactive.noPlayers");
    }

    CreateEmbed::new()
        .title(tr!(lang, "bot.inactive.title"))
        .colour(Colour::from_rgb(241, 196, 15))
        .description(desc)
}

// === Private helper functions ===

fn format_resources(r: &BotSpyReport, lang: &str) -> String {
    let mut s = String::new();
    append_value(&mut s, &tr!(lang, "gameIds.resources.901"), r.resources.get("901"));
    append_value(&mut s, &tr!(lang, "gameIds.resources.902"), r.resources.get("902"));
    append_value(&mut s, &tr!(lang, "gameIds.resources.903"), r.resources.get("903"));
    append_value(&mut s, &tr!(lang, "gameIds.resources.904"), r.resources.get("904"));
    if s.is_empty() { tr!(lang, "bot.spy.noData") } else { s }
}

fn format_buildings(r: &BotSpyReport, lang: &str) -> String {
    let mut s = String::new();
    append_value(&mut s, &tr!(lang, "gameIds.buildings.1"), r.buildings.get("1"));
    append_value(&mut s, &tr!(lang, "gameIds.buildings.2"), r.buildings.get("2"));
    append_value(&mut s, &tr!(lang, "gameIds.buildings.3"), r.buildings.get("3"));
    append_value(&mut s, &tr!(lang, "gameIds.buildings.4"), r.buildings.get("4"));
    append_value(&mut s, &tr!(lang, "gameIds.buildings.14"), r.buildings.get("14"));
    append_value(&mut s, &tr!(lang, "gameIds.buildings.15"), r.buildings.get("15"));
    if s.is_empty() { tr!(lang, "bot.spy.noData") } else { s }
}

fn format_defense(r: &BotSpyReport, lang: &str) -> String {
    let mut s = String::new();
    append_value(&mut s, &tr!(lang, "gameIds.defense.401"), r.defense.get("401"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.402"), r.defense.get("402"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.403"), r.defense.get("403"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.404"), r.defense.get("404"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.405"), r.defense.get("405"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.406"), r.defense.get("406"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.407"), r.defense.get("407"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.408"), r.defense.get("408"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.502"), r.defense.get("502"));
    append_value(&mut s, &tr!(lang, "gameIds.defense.503"), r.defense.get("503"));
    if s.is_empty() { tr!(lang, "bot.spy.noDefense") } else { s }
}

fn format_fleet(r: &BotSpyReport, lang: &str) -> String {
    let mut s = String::new();
    append_value(&mut s, &tr!(lang, "gameIds.ships.202"), r.fleet.get("202"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.203"), r.fleet.get("203"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.204"), r.fleet.get("204"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.205"), r.fleet.get("205"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.206"), r.fleet.get("206"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.207"), r.fleet.get("207"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.208"), r.fleet.get("208"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.209"), r.fleet.get("209"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.210"), r.fleet.get("210"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.211"), r.fleet.get("211"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.213"), r.fleet.get("213"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.214"), r.fleet.get("214"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.215"), r.fleet.get("215"));
    append_value(&mut s, &tr!(lang, "gameIds.ships.212"), r.fleet.get("212"));
    if s.is_empty() { tr!(lang, "bot.spy.noFleet") } else { s }
}

fn append_value(s: &mut String, label: &str, value: Option<&i64>) {
    if let Some(&v) = value {
        if v > 0 {
            if !s.is_empty() {
                s.push('\n');
            }
            s.push_str(&format!("{}: **{}**", label, format_number(v)));
        }
    }
}

fn format_number(n: i64) -> String {
    let abs_n = n.abs();
    let sign = if n < 0 { "-" } else { "" };
    if abs_n >= 1_000_000 {
        format!("{}{:.1}M", sign, abs_n as f64 / 1_000_000.0)
    } else if abs_n >= 1_000 {
        format!("{}{:.1}K", sign, abs_n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}

/// Discord limits: 6000 chars per embed, 25 fields, 10 embeds per message
const MAX_EMBED_DESC_LEN: usize = 4000; // Leave some buffer

/// Format new planets as Discord embeds
/// Splits into multiple embeds if content exceeds Discord limits
pub fn format_new_planets(planets: &[NewPlanet], lang: &str) -> Vec<CreateEmbed> {
    if planets.is_empty() {
        return vec![
            CreateEmbed::new()
                .title(tr!(lang, "bot.planets.newPlanets"))
                .colour(Colour::from_rgb(52, 152, 219))
                .description(tr!(lang, "bot.planets.noNewPlanets"))
        ];
    }

    let mut embeds = Vec::new();
    let mut current_desc = String::new();
    let total_count = planets.len();
    let unknown = tr!(lang, "bot.spy.unknown");
    let new_planets_title = tr!(lang, "bot.planets.newPlanets");

    for planet in planets {
        let coords = format!("{}:{}:{}", planet.galaxy, planet.system, planet.planet);
        let player = planet.player_name.as_deref().unwrap_or(&unknown);
        let alliance = planet.alliance_tag.as_deref().map(|t| format!(" [{}]", t)).unwrap_or_default();

        let line = format!("**{}** - {}{}\n", coords, player, alliance);

        // Check if adding this line would exceed the limit
        if current_desc.len() + line.len() > MAX_EMBED_DESC_LEN && !current_desc.is_empty() {
            // Save current embed and start new one
            embeds.push(
                CreateEmbed::new()
                    .title(format!("{} ({}/{})", new_planets_title, embeds.len() + 1, (total_count / 80) + 1))
                    .colour(Colour::from_rgb(52, 152, 219))
                    .description(current_desc.clone())
            );
            current_desc.clear();
        }

        current_desc.push_str(&line);
    }

    // Add final embed
    if !current_desc.is_empty() {
        let title = if embeds.is_empty() {
            tr!(lang, "bot.planets.newPlanetsCount", "count" => &total_count.to_string())
        } else {
            format!("{} ({}/{})", new_planets_title, embeds.len() + 1, embeds.len() + 1)
        };

        embeds.push(
            CreateEmbed::new()
                .title(title)
                .colour(Colour::from_rgb(52, 152, 219))
                .description(current_desc)
                .footer(serenity::all::CreateEmbedFooter::new(
                    tr!(lang, "bot.planets.total", "count" => &total_count.to_string())
                ))
        );
    }

    embeds
}
