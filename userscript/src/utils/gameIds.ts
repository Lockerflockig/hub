/**
 * pr0game ID to name mappings using the locale system
 * IDs are stored as strings in JSON (e.g., "1": 10 for level 10 metal mine)
 */

import { getTranslations } from '../locales';

type GameIdCategory = 'buildings' | 'ships' | 'research' | 'defense';

/**
 * Get the full name map for a category from the current locale
 */
function getGameIdMap(category: GameIdCategory): Record<string, string> {
  const translations = getTranslations();
  return (translations.gameIds?.[category] as Record<string, string>) || {};
}

/**
 * Format a category (buildings, ships, etc.) as readable HTML
 */
export function formatCategory(
  data: Record<string, number> | null | undefined,
  category: GameIdCategory,
  color: string
): string {
  if (!data || Object.keys(data).length === 0) {
    return '<span style="color: #666;">-</span>';
  }

  const nameMap = getGameIdMap(category);
  const items: string[] = [];
  for (const [id, value] of Object.entries(data)) {
    const name = nameMap[id] || `ID ${id}`;
    items.push(`<span title="${name}">${name}: ${value}</span>`);
  }

  return `<div style="color: ${color}; font-size: 12px; line-height: 1.5;">${items.join('<br>')}</div>`;
}
