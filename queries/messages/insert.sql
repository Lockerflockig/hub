-- Fügt eine neue Nachrichten-ID ein (für Duplikat-Tracking)
INSERT INTO messages (external_id)
VALUES (?)
ON CONFLICT(external_id) DO NOTHING;
