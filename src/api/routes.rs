use axum::{
    routing::{get, post, put, delete},
    Router,
    middleware,
};
use tower_http::services::ServeDir;
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use crate::api::auth::auth_middleware;
use crate::api::handlers::{admin, players, planets, hub, reports, galaxy, empire, statistics};

pub fn create_router() -> Router {
    let protected = Router::new()
        // Auth
        .route("/login", get(players::login))

        // Users
        .route("/users/language", post(players::update_language))

        // Players
        .route("/players/{id}", get(players::get_player))
        .route("/players/{id}/planets", get(players::get_player_planets))
        .route("/players/{id}/delete", post(players::delete_player))
        .route("/players", post(players::upsert_player))

        // Planets
        .route("/planets/new", post(planets::create_planets_batch))

        // Hub
        .route("/hub/planets", get(hub::get_planets))
        .route("/hub/research", get(hub::get_research))
        .route("/hub/playerresearch", get(hub::get_max_research))
        .route("/hub/fleet", get(hub::get_fleet))
        .route("/hub/galaxy", get(hub::get_galaxy_status))
        .route("/hub/buildings", get(hub::get_buildings))
        .route("/hub/config", get(hub::get_config))
        .route("/hub/stats", get(hub::get_stats))
        .route("/hub/overview", get(hub::get_overview))

        // Galaxy
        .route("/galaxy/{galaxy}/{system}", get(galaxy::get_system))

        // Reports
        .route("/spy-reports/{galaxy}/{system}/{planet}", get(reports::get_spy_reports))
        .route("/spy-reports/{galaxy}/{system}/{planet}/history", get(reports::get_spy_report_history))
        .route("/spy-reports", post(reports::create_spy_report))
        .route("/battle-reports/{galaxy}/{system}/{planet}/history", get(reports::get_battle_report_history))
        .route("/battle-reports", post(reports::create_battle_report))
        .route("/expedition-reports", post(reports::create_expedition_report))
        .route("/recycle-reports", post(reports::create_recycle_report))
        .route("/hostile-spying", get(reports::get_hostile_spying).post(reports::create_hostile_spying))
        .route("/hostile-spying/overview", get(reports::get_hostile_spying_overview))

        // Empire
        .route("/empire", post(empire::sync_empire))

        // Statistics
        .route("/statistics/sync", post(statistics::sync_statistics))

        // Admin
        .route("/admin/check", get(admin::check_admin))
        .route("/admin/users", get(admin::list_users).post(admin::create_user))
        .route("/admin/users/{id}", delete(admin::delete_user))
        .route("/admin/users/{id}/role", put(admin::update_user_role))
        .route("/admin/users/{id}/apikey", get(admin::get_user_api_key))
        .route("/admin/config", put(admin::update_config))

        .layer(middleware::from_fn(auth_middleware));

    // CORS layer for cross-origin requests from pr0game
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Serve static files from /static folder
    let static_files = ServeDir::new("static");

    Router::new()
        .nest("/api", protected)
        .nest_service("/static", static_files)
        .layer(cors)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|request: &axum::http::Request<_>| {
                    tracing::debug_span!(
                        "http_request",
                        method = %request.method(),
                        uri = %request.uri(),
                    )
                })
                .on_request(|request: &axum::http::Request<_>, _span: &tracing::Span| {
                    tracing::debug!(
                        method = %request.method(),
                        uri = %request.uri(),
                        "Incoming request"
                    );
                })
                .on_response(|response: &axum::http::Response<_>, latency: std::time::Duration, _span: &tracing::Span| {
                    tracing::debug!(
                        status = %response.status(),
                        latency = ?latency,
                        "Response sent"
                    );
                })
        )
}
