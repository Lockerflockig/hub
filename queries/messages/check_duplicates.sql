-- Query für POST /api/messages
-- Prüft welche Nachrichten-IDs bereits existieren (Duplikat-Check)
SELECT external_id
FROM messages
WHERE external_id IN (SELECT value FROM json_each(?));
