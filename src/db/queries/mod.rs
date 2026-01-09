/// Macro to include SQL files from the queries directory
/// Usage: sql!(bot, get_player_name) -> includes "queries/bot/get_player_name.sql"
macro_rules! sql {
    ($folder:ident, $file:ident) => {
        include_str!(concat!("../../../queries/", stringify!($folder), "/", stringify!($file), ".sql"))
    };
}

pub(crate) use sql;

pub mod players;
pub mod planets;
pub mod galaxy;
pub mod alliances;
pub mod hub;
pub mod spy_reports;
pub mod battle_reports;
pub mod expedition_reports;
pub mod recycle_reports;
pub mod hostile_spying;
pub mod messages;
pub mod users;
pub mod config;
pub mod bot;