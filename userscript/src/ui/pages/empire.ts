/**
 * Empire page enhancements
 * - Parse and sync player empire data (planets, buildings, fleet, defense, research)
 */

import { api } from '../../api/client';
import { storage } from '../../utils/storage';
import { t } from '../../locales';
import { debugLog, parseGermanNumber } from '../../utils/formatting';

interface EmpirePlanet {
  external_id: number;
  name: string;
  coordinates: string;
  fields_used: number;
  fields_max: number;
  temperature: number;
  points: number;
  resources: Record<string, number>;
  production: {
    metal: number;
    crystal: number;
    deuterium: number;
    energy_used: number;
    energy_max: number;
  };
  buildings: Record<string, number>;
  fleet: Record<string, number>;
  defense: Record<string, number>;
}

interface EmpireData {
  player_id: number;
  player_name: string;
  research: Record<string, number>;
  planets: EmpirePlanet[];
}

/**
 * Initialize empire page enhancements
 */
export function initEmpirePage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'Empire') {
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] Empire: Not configured, skipping');
    return;
  }

  console.log('[HG Hub] Empire page detected');

  // Add sync button after a short delay to ensure page is loaded
  setTimeout(() => addSyncButton(), 500);
}

/**
 * Add sync button to the empire page
 */
function addSyncButton(): void {
  // Find the header row
  const header = document.querySelector('table tbody tr th');
  if (!header) {
    debugLog('Header not found');
    return;
  }

  // Remove existing button
  const existingBtn = document.getElementById('hg-hub-empire-sync-btn');
  if (existingBtn) existingBtn.remove();

  const syncBtn = document.createElement('button');
  syncBtn.id = 'hg-hub-empire-sync-btn';
  syncBtn.style.cssText = `
    background: #2a4a6a;
    border: 1px solid #4a8aba;
    color: #8cf;
    padding: 4px 10px;
    margin-left: 10px;
    cursor: pointer;
    font-size: 12px;
    border-radius: 3px;
  `;
  syncBtn.innerHTML = `⬆ ${t('sync.empire')}`;
  syncBtn.title = t('sync.empireTitle');

  syncBtn.addEventListener('click', async () => {
    debugLog('Sync button clicked');
    syncBtn.disabled = true;
    syncBtn.innerHTML = `⏳ ${t('sync.parsing')}`;

    try {
      const data = parseEmpireData();
      if (!data) {
        syncBtn.innerHTML = `❌ ${t('sync.parseError')}`;
        syncBtn.style.color = '#f88';
        return;
      }

      debugLog('Parsed empire data:', data);
      syncBtn.innerHTML = `⏳ ${t('sync.syncing')}`;

      const result = await api.post('/empire', data);

      if (result.ok) {
        syncBtn.innerHTML = `✓ ${t('sync.done')}`;
        syncBtn.style.color = '#8f8';
        // Keep button in "done" state - user can reload page to sync again
        syncBtn.disabled = true;
      } else {
        syncBtn.innerHTML = `❌ ${t('sync.error')}`;
        syncBtn.style.color = '#f88';
        syncBtn.disabled = false;
      }
    } catch (e) {
      console.error('[HG Hub] Empire sync error:', e);
      syncBtn.innerHTML = `❌ ${t('sync.error')}`;
      syncBtn.style.color = '#f88';
      syncBtn.disabled = false;
    }
  });

  header.appendChild(syncBtn);
}

/**
 * Parse all empire data from the page
 */
function parseEmpireData(): EmpireData | null {
  try {
    // Player ID is optional - backend can get it from API key
    // Try multiple patterns, but don't fail if not found
    let playerId = 0;
    const patterns = [
      /const userId = (\d+);/,
      /playerId["\s:=]+(\d+)/i,
      /user_?id["\s:=]+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = document.body.innerHTML.match(pattern);
      if (match) {
        playerId = parseInt(match[1], 10);
        break;
      }
    }

    debugLog('Player ID:', playerId || '(will use API key)');

    // Get player name from header (optional)
    const playerNameEl = document.querySelector('.planetImage b');
    const playerName = playerNameEl?.textContent?.trim() || 'Unknown';

    // Get planet selector options to get planet IDs
    const planetSelector = document.querySelector('#planetSelector');
    const planetOptions = planetSelector?.querySelectorAll('option') || [];

    // Build planet ID to external_id mapping
    const planetIdMap: Record<string, number> = {};
    planetOptions.forEach(opt => {
      const externalId = parseInt(opt.getAttribute('value') || '0', 10);
      const coordsMatch = opt.textContent?.match(/\[(\d+:\d+:\d+)]/);
      if (coordsMatch && externalId) {
        planetIdMap[coordsMatch[1]] = externalId;
      }
    });

    debugLog('Planet ID map:', planetIdMap);

    // Parse planets (columns in the table)
    const planets = parsePlanets(planetIdMap);
    debugLog('Parsed planets:', planets);

    // Parse research (global for player)
    const research = parseResearch();
    debugLog('Parsed research:', research);

    return {
      player_id: playerId,
      player_name: playerName,
      research,
      planets,
    };
  } catch (e) {
    console.error('[HG Hub] Parse error:', e);
    return null;
  }
}

/**
 * Parse planets data from table rows
 */
function parsePlanets(planetIdMap: Record<string, number>): EmpirePlanet[] {
  const planets: EmpirePlanet[] = [];

  // Find rows by content patterns (language-independent)
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  let coordsRow: Element | null = null;
  let nameRow: Element | null = null;
  let fieldsRow: Element | null = null;
  let tempRow: Element | null = null;
  let pointsRow: Element | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) continue;

    // Check third cell (first planet column) for pattern detection
    const thirdCell = cells[2];
    const cellText = thirdCell?.textContent?.trim() || '';
    const cellHtml = thirdCell?.innerHTML || '';

    // Coordinates: contains link with [X:Y:Z] pattern
    if (!coordsRow && cellHtml.includes('<a') && /\[\d+:\d+:\d+]/.test(cellText)) {
      coordsRow = row;
      // Name row is the one before coordinates
      if (i > 0) nameRow = rows[i - 1];
      continue;
    }

    // After finding coords, look for fields, temp, points in order
    if (coordsRow && !fieldsRow && /\d+\s*\/\s*\d+/.test(cellText)) {
      fieldsRow = row;
      continue;
    }

    if (fieldsRow && !tempRow && /°C/.test(cellText)) {
      tempRow = row;
      continue;
    }

    if (tempRow && !pointsRow && /^\d+$/.test(cellText.replace(/\./g, ''))) {
      pointsRow = row;
      break; // Found all rows we need
    }
  }

  if (!coordsRow) {
    debugLog('Coordinates row not found');
    return planets;
  }

  // Get all coordinate cells (skip first two: label and total)
  const coordCells = coordsRow.querySelectorAll('td');
  const numPlanets = coordCells.length - 2;

  debugLog(`Found ${numPlanets} planets`);

  for (let i = 0; i < numPlanets; i++) {
    const colIndex = i + 2; // Skip label and total columns

    // Get coordinates
    const coordLink = coordCells[colIndex]?.querySelector('a');
    const coordText = coordLink?.textContent?.trim() || '';
    const coordsMatch = coordText.match(/\[(\d+:\d+:\d+)]/);
    const coords = coordsMatch ? coordsMatch[1] : '';

    if (!coords) continue;

    // Get external ID from map
    const externalId = planetIdMap[coords] || 0;

    // Get name
    const nameCells = nameRow?.querySelectorAll('td') || [];
    const name = nameCells[colIndex]?.textContent?.trim() || 'Unknown';

    // Get fields
    const fieldsCells = fieldsRow?.querySelectorAll('td') || [];
    const fieldsText = fieldsCells[colIndex]?.textContent?.trim() || '0 / 0';
    const fieldsMatch = fieldsText.match(/(\d+)\s*\/\s*(\d+)/);
    const fieldsUsed = fieldsMatch ? parseInt(fieldsMatch[1], 10) : 0;
    const fieldsMax = fieldsMatch ? parseInt(fieldsMatch[2], 10) : 0;

    // Get temperature
    const tempCells = tempRow?.querySelectorAll('td') || [];
    const tempText = tempCells[colIndex]?.textContent?.trim() || '0';
    const temperature = parseInt(tempText.replace(/[^-\d]/g, ''), 10) || 0;

    // Get points
    const pointsCells = pointsRow?.querySelectorAll('td') || [];
    const pointsText = pointsCells[colIndex]?.textContent?.trim() || '0';
    const points = parseGermanNumber(pointsText);

    // Get resources and production
    const resources: Record<string, number> = {};
    const production = { metal: 0, crystal: 0, deuterium: 0, energy_used: 0, energy_max: 0 };

    // Parse resource rows (data-info="r_XXX")
    const resourceRows = document.querySelectorAll('tr.ressources[data-info]');
    resourceRows.forEach(row => {
      const dataInfo = row.getAttribute('data-info');
      if (!dataInfo) return;

      const resourceId = dataInfo.replace('r_', '');
      const cells = row.querySelectorAll('td');
      const cell = cells[colIndex];
      if (!cell) return;

      // Current value is the first number
      const cellText = cell.innerHTML;
      const valueMatch = cellText.match(/^\s*([\d.]+)/);
      if (valueMatch) {
        resources[resourceId] = parseGermanNumber(valueMatch[1]);
      }

      // Production is in the colorPositive span
      const prodSpan = cell.querySelector('.colorPositive');
      if (prodSpan) {
        const prodText = prodSpan.textContent || '';
        const prodMatch = prodText.match(/([\d.]+)\s*\/h/);
        if (prodMatch) {
          const prodValue = parseGermanNumber(prodMatch[1]);
          if (resourceId === '901') production.metal = prodValue;
          else if (resourceId === '902') production.crystal = prodValue;
          else if (resourceId === '903') production.deuterium = prodValue;
        }
      }

      // Energy is special (no production, but current/max)
      if (resourceId === '911') {
        const energyText = cell.textContent || '';
        production.energy_used = parseGermanNumber(energyText);
        // Energy max not shown per planet, set to same as used for now
        production.energy_max = production.energy_used;
      }
    });

    // Get buildings
    const buildings = parseCategory('buildings', 'b_', colIndex);

    // Get fleet
    const fleet = parseCategory('ships', 'f_', colIndex);

    // Get defense
    const defense = { ...parseCategory('defenses', 'd_', colIndex), ...parseCategory('missile', 'd_', colIndex) };

    planets.push({
      external_id: externalId,
      name,
      coordinates: coords,
      fields_used: fieldsUsed,
      fields_max: fieldsMax,
      temperature,
      points,
      resources,
      production,
      buildings,
      fleet,
      defense,
    });
  }

  return planets;
}

/**
 * Parse a category (buildings, ships, defenses) from the table
 */
function parseCategory(className: string, prefix: string, colIndex: number): Record<string, number> {
  const result: Record<string, number> = {};

  const rows = document.querySelectorAll(`tr.${className}[data-info]`);
  rows.forEach(row => {
    const dataInfo = row.getAttribute('data-info');
    if (!dataInfo || !dataInfo.startsWith(prefix)) return;

    const itemId = dataInfo.replace(prefix, '');
    const cells = row.querySelectorAll('td');
    const cell = cells[colIndex];
    if (!cell) return;

    // Get the value from the span (level or count)
    const span = cell.querySelector('span');
    const text = span?.textContent?.trim() || cell.textContent?.trim() || '0';
    const value = parseGermanNumber(text);

    if (value > 0) {
      result[itemId] = value;
    }
  });

  return result;
}

/**
 * Parse research levels (global for player)
 */
function parseResearch(): Record<string, number> {
  const result: Record<string, number> = {};

  const rows = document.querySelectorAll('tr.technology[data-info]');
  rows.forEach(row => {
    const dataInfo = row.getAttribute('data-info');
    if (!dataInfo || !dataInfo.startsWith('t_')) return;

    const techId = dataInfo.replace('t_', '');
    const cells = row.querySelectorAll('td');
    // Research level is in the second cell (total column)
    const cell = cells[1];
    if (!cell) return;

    const text = cell.textContent?.trim() || '0';
    const value = parseGermanNumber(text);

    if (value > 0) {
      result[techId] = value;
    }
  });

  return result;
}
