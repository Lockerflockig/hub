/**
 * PlayerCard page enhancements
 * - Add sync button to player popup
 * - Extract player data and sync to backend
 * - Show notice textarea for notes
 */

import { api } from '../../api/client';
import { storage } from '../../utils/storage';
import { debugLog } from '../../utils/formatting';

interface PlayerData {
  id: number;
  name: string;
  allianceId: number | null;
  allianceTag: string | null;
  mainCoordinates: string | null;
  // Scores with ranks
  scoreBuildings: number | null;
  scoreBuildingsRank: number | null;
  scoreResearch: number | null;
  scoreResearchRank: number | null;
  scoreFleet: number | null;
  scoreFleetRank: number | null;
  scoreDefense: number | null;
  scoreDefenseRank: number | null;
  scoreTotal: number | null;
  scoreTotalRank: number | null;
  // Combat stats
  combatsWon: number | null;
  combatsDraw: number | null;
  combatsLost: number | null;
  combatsTotal: number | null;
  // Honorpoints
  honorpoints: number | null;
  honorpointsRank: number | null;
  // Honorfights
  fightsHonorable: number | null;
  fightsDishonorable: number | null;
  fightsNeutral: number | null;
  // Destruction stats (involved in)
  destructionUnitsKilled: number | null;
  destructionUnitsLost: number | null;
  destructionRecycledMetal: number | null;
  destructionRecycledCrystal: number | null;
  // Destruction stats (actually destroyed)
  realDestructionUnitsKilled: number | null;
  realDestructionUnitsLost: number | null;
  realDestructionRecycledMetal: number | null;
  realDestructionRecycledCrystal: number | null;
}

interface BackendPlayer {
  id: number;
  name: string;
  main_coordinates: string | null;
  notice: string | null;
}

interface BackendPlanet {
  id: number;
  coordinates: string;
  name: string | null;
  type: string;
  galaxy: number;
  system: number;
  planet: number;
  buildings: Record<string, number> | null;
}

let currentPlayerId: number | null = null;
let currentNotice: string = '';

/**
 * Initialize PlayerCard page enhancements
 */
export function initPlayerCardPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'playerCard') {
    return;
  }

  const playerId = params.get('id');
  if (!playerId) {
    debugLog('No player ID in URL');
    return;
  }

  currentPlayerId = parseInt(playerId, 10);
  if (isNaN(currentPlayerId)) {
    debugLog('Invalid player ID');
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] PlayerCard: Not configured, skipping');
    return;
  }

  console.log('[HG Hub] PlayerCard: Initializing for player', currentPlayerId);

  // Wait for page to be fully loaded
  setTimeout(() => {
    void enhancePlayerCard();
  }, 300);
}

async function enhancePlayerCard(): Promise<void> {
  if (!currentPlayerId) return;

  // Check if player exists (error page check)
  const body = document.body.innerHTML;
  if (body.includes('ShowPlayerCardPage.class.php')) {
    debugLog('Player not found (error page)');
    showDeletedPlayerUI();
    return;
  }

  // Parse player data from page
  const playerData = parsePlayerData();
  if (!playerData) {
    console.warn('[HG Hub] PlayerCard: Could not parse player data');
    return;
  }

  debugLog('Parsed player data:', playerData);

  // Load existing data from backend (notice, planets, etc.)
  await loadPlayerInfo();

  // Add notice textarea
  addNoticeTextarea();

  // Add sync button
  addSyncButton(playerData);

  // Add known planets section
  await addPlanetsSection();
}

function showDeletedPlayerUI(): void {
  const content = document.getElementById('content');
  if (!content) return;

  const container = document.createElement('div');
  container.style.cssText = `
    margin: 20px auto;
    padding: 15px;
    background: #2a1a1a;
    border: 1px solid #c55;
    border-radius: 4px;
    text-align: center;
    max-width: 400px;
  `;

  container.innerHTML = `
    <p style="color: #c55; margin-bottom: 15px;">Spieler existiert nicht mehr im Spiel.</p>
    <button id="hg-hub-mark-deleted-btn" type="button" style="
      background: #a33;
      border: none;
      color: #fff;
      padding: 8px 20px;
      cursor: pointer;
      font-size: 13px;
      border-radius: 4px;
    ">Als gelöscht markieren</button>
    <span id="hg-hub-delete-status" style="margin-left: 10px; font-size: 12px;"></span>
  `;

  content.insertBefore(container, content.firstChild);

  document.getElementById('hg-hub-mark-deleted-btn')?.addEventListener('click', async () => {
    const button = document.getElementById('hg-hub-mark-deleted-btn') as HTMLButtonElement;
    const status = document.getElementById('hg-hub-delete-status');

    if (!button || !status || !currentPlayerId) return;

    button.disabled = true;
    button.textContent = '...';

    try {
      const response = await api.post(`/players/${currentPlayerId}/delete`, {});
      if (response.ok) {
        status.textContent = '✓ Markiert';
        status.style.color = '#5c5';
        button.style.display = 'none';
      } else {
        status.textContent = `✗ ${response.error}`;
        status.style.color = '#c55';
        button.disabled = false;
        button.textContent = 'Als gelöscht markieren';
      }
    } catch (e) {
      status.textContent = '✗ Fehler';
      status.style.color = '#c55';
      button.disabled = false;
      button.textContent = 'Als gelöscht markieren';
    }
  });
}

function parsePlayerData(): PlayerData | null {
  const content = document.getElementById('content');
  if (!content) {
    debugLog('parsePlayerData: No content element found');
    return null;
  }

  const table = content.querySelector('table');
  if (!table) {
    debugLog('parsePlayerData: No table found in content');
    return null;
  }

  const rows = Array.from(table.querySelectorAll('tr'));
  debugLog('parsePlayerData: Found', rows.length, 'rows');
  if (rows.length < 10) {
    debugLog('parsePlayerData: Not enough rows (need 10, have', rows.length, ')');
    return null;
  }

  // Helper to parse number from text (handles thousand separators)
  const parseNumber = (text: string | null | undefined): number | null => {
    if (!text) return null;
    // Remove dots (thousand separator) and parse
    const clean = text.trim().replace(/\./g, '').replace(/,/g, '');
    const num = parseInt(clean, 10);
    return isNaN(num) ? null : num;
  };

  // Find all section headers (rows with <th colspan>) for structural parsing
  // This approach works for ALL languages as it doesn't rely on keywords
  const findAllSectionHeaders = (): number[] => {
    const headers: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const th = rows[i].querySelector('th');
      if (th && th.getAttribute('colspan')) {
        headers.push(i);
      }
    }
    return headers;
  };

  // Parse player info from first rows (after Player Profile header)
  // Structure: Row 0 = header, Row 1 = Username, Row 2 = Home planet, Row 3 = Alliance
  // The first row with a header is the player profile section
  let playerProfileStart = 0;
  for (let i = 0; i < rows.length; i++) {
    const th = rows[i].querySelector('th');
    if (th && th.getAttribute('colspan')) {
      playerProfileStart = i;
      break;
    }
  }
  debugLog('parsePlayerData: Player profile header at row', playerProfileStart);

  // Username row (first data row after header)
  const usernameRow = rows[playerProfileStart + 1];
  const name = usernameRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';
  debugLog('parsePlayerData: Player name =', name);
  if (!name) {
    // Fallback: try to find name in a different way - look for first row with player name link
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const cells = rows[i].querySelectorAll('td');
      for (const cell of cells) {
        const text = cell.textContent?.trim();
        if (text && text.length > 0 && text.length < 50 && !text.includes(':') && !text.includes('[')) {
          debugLog('parsePlayerData: Found name via fallback:', text);
          // Continue with this name - we'll set it below
        }
      }
    }
    debugLog('parsePlayerData: Could not find player name');
    return null;
  }

  // Home planet row
  const homePlanetRow = rows[playerProfileStart + 2];
  let mainCoordinates: string | null = null;
  if (homePlanetRow) {
    const coordText = homePlanetRow.querySelectorAll('td')[1]?.textContent?.trim() || '';
    const match = coordText.match(/\[(\d+:\d+:\d+)]/);
    if (match) {
      mainCoordinates = match[1];
    }
  }

  // Alliance row
  const allianceRow = rows[playerProfileStart + 3];
  let allianceId: number | null = null;
  let allianceTag: string | null = null;
  if (allianceRow) {
    const allianceLink = allianceRow.querySelector('a');
    if (allianceLink) {
      const onclick = allianceLink.getAttribute('onclick') || '';
      const href = allianceLink.getAttribute('href') || '';
      const idMatch = onclick.match(/id=(\d+)/) || href.match(/id=(\d+)/);
      if (idMatch) {
        allianceId = parseInt(idMatch[1], 10);
      }
      // Extract alliance tag/name from link text
      const tagText = allianceLink.textContent?.trim();
      if (tagText) {
        allianceTag = tagText;
      }
    }
  }

  // Find Points/Rank header - this is the row that has 2+ <th> elements with one being empty
  // Structure: <th>&nbsp;</th><th>Points</th><th>Rank</th>
  let scoreStartIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const ths = rows[i].querySelectorAll('th');
    if (ths.length >= 2) {
      // This row has multiple th elements - it's the Points/Rank header row
      scoreStartIndex = i;
      break;
    }
  }

  // Score rows follow Points/Rank header in order: Buildings, Research, Fleet, Defense, Total
  // Structure: [empty, label, points, percentage, rank]
  const parseScoreRow = (row: Element | undefined): { points: number | null; rank: number | null } => {
    if (!row) return { points: null, rank: null };
    const cells = row.querySelectorAll('td');
    // cells[0] = empty, cells[1] = label, cells[2] = points, cells[3] = %, cells[4] = rank
    return {
      points: parseNumber(cells[2]?.textContent),
      rank: parseNumber(cells[4]?.textContent)
    };
  };

  let buildings = { points: null as number | null, rank: null as number | null };
  let research = { points: null as number | null, rank: null as number | null };
  let fleet = { points: null as number | null, rank: null as number | null };
  let defense = { points: null as number | null, rank: null as number | null };
  let total = { points: null as number | null, rank: null as number | null };

  if (scoreStartIndex !== -1) {
    buildings = parseScoreRow(rows[scoreStartIndex + 1]);
    research = parseScoreRow(rows[scoreStartIndex + 2]);
    fleet = parseScoreRow(rows[scoreStartIndex + 3]);
    defense = parseScoreRow(rows[scoreStartIndex + 4]);
    total = parseScoreRow(rows[scoreStartIndex + 5]);
  }

  // Get all section headers for structural navigation
  // After the score section (which ends at scoreStartIndex + 5), remaining sections are:
  // 1. Fight Statistics (header at some point after scores)
  // 2. Honor Points
  // 3. Honor Fights
  // 4. Destruction (involved)
  // 5. Destruction (actual)
  // 6. Achievements
  const allHeaders = findAllSectionHeaders();
  debugLog('parsePlayerData: Found section headers at rows:', allHeaders);

  // Find the fight stats section - it's the first section header after the score rows
  // The score section ends at scoreStartIndex + 5 (Total row)
  let fightStatsStart = -1;
  for (const headerIdx of allHeaders) {
    if (headerIdx > scoreStartIndex + 5) {
      fightStatsStart = headerIdx;
      break;
    }
  }
  debugLog('parsePlayerData: Fight stats header at row', fightStatsStart);

  // Fight rows follow header: header row, then Fights subheader, then Won, Drawn, Lost, Total
  // Structure varies: [empty, empty, label, count, quota] or similar
  let combatsWon: number | null = null;
  let combatsDraw: number | null = null;
  let combatsLost: number | null = null;
  let combatsTotal: number | null = null;

  if (fightStatsStart !== -1) {
    // Skip header row and "Fights/Fight quota" subheader row
    // Data rows: Won (index+2), Drawn (index+3), Lost (index+4), Total fights (index+5)
    const parseFightRow = (row: Element | undefined): number | null => {
      if (!row) return null;
      const cells = row.querySelectorAll('td');
      // Find first numeric cell (skip empty/label cells)
      for (const cell of cells) {
        const val = parseNumber(cell.textContent);
        if (val !== null) return val;
      }
      return null;
    };

    combatsWon = parseFightRow(rows[fightStatsStart + 2]);
    combatsDraw = parseFightRow(rows[fightStatsStart + 3]);
    combatsLost = parseFightRow(rows[fightStatsStart + 4]);
    combatsTotal = parseFightRow(rows[fightStatsStart + 5]);
  }

  // Find Honor Points section - it's the next section header after fight stats
  let honorStart = -1;
  for (const headerIdx of allHeaders) {
    if (fightStatsStart !== -1 && headerIdx > fightStatsStart + 5) {
      honorStart = headerIdx;
      break;
    }
  }
  debugLog('parsePlayerData: Honor points header at row', honorStart);

  let honorpoints: number | null = null;
  let honorpointsRank: number | null = null;

  if (honorStart !== -1) {
    // First data row after header has honorpoints value
    const honorRow = rows[honorStart + 1];
    if (honorRow) {
      const cells = honorRow.querySelectorAll('td');
      // Find numeric values - typically points then rank
      const nums: number[] = [];
      for (const cell of cells) {
        const val = parseNumber(cell.textContent);
        if (val !== null) nums.push(val);
      }
      if (nums.length >= 1) honorpoints = nums[0];
    }
    // Rank is in next row
    const rankRow = rows[honorStart + 2];
    if (rankRow) {
      const cells = rankRow.querySelectorAll('td');
      for (const cell of cells) {
        const val = parseNumber(cell.textContent);
        if (val !== null) {
          honorpointsRank = val;
          break;
        }
      }
    }
  }

  // Find honorfights section - it's the next section header after honor points
  let honorfightsStart = -1;
  for (const headerIdx of allHeaders) {
    if (honorStart !== -1 && headerIdx > honorStart + 2) {
      honorfightsStart = headerIdx;
      break;
    }
  }
  debugLog('parsePlayerData: Honorfights header at row', honorfightsStart);

  let fightsHonorable: number | null = null;
  let fightsDishonorable: number | null = null;
  let fightsNeutral: number | null = null;

  if (honorfightsStart !== -1) {
    // Skip header and subheader, then: Honorable, Dishonorable, Neutral
    const parseHonorFightRow = (row: Element | undefined): number | null => {
      if (!row) return null;
      const cells = row.querySelectorAll('td');
      for (const cell of cells) {
        const val = parseNumber(cell.textContent);
        if (val !== null) return val;
      }
      return null;
    };

    fightsHonorable = parseHonorFightRow(rows[honorfightsStart + 2]);
    fightsDishonorable = parseHonorFightRow(rows[honorfightsStart + 3]);
    fightsNeutral = parseHonorFightRow(rows[honorfightsStart + 4]);
  }

  // Find destruction sections - they follow honorfights in order
  // There are two sections: "involved in" and "actually destroyed"
  // Each has: Units Killed, Units Lost, Recycled Metal, Recycled Crystal
  let destructionUnitsKilled: number | null = null;
  let destructionUnitsLost: number | null = null;
  let destructionRecycledMetal: number | null = null;
  let destructionRecycledCrystal: number | null = null;
  let realDestructionUnitsKilled: number | null = null;
  let realDestructionUnitsLost: number | null = null;
  let realDestructionRecycledMetal: number | null = null;
  let realDestructionRecycledCrystal: number | null = null;

  // Find destruction sections - they are the headers after honorfights
  const destructionSections: number[] = [];
  for (const headerIdx of allHeaders) {
    const afterHonorfights = honorfightsStart !== -1 ? headerIdx > honorfightsStart + 4 : headerIdx > honorStart + 2;
    if (afterHonorfights) {
      destructionSections.push(headerIdx);
      if (destructionSections.length >= 2) break; // We only need 2 destruction sections
    }
  }
  debugLog('parsePlayerData: Destruction sections at rows:', destructionSections);

  const parseDestructionValue = (row: Element | undefined): number | null => {
    if (!row) return null;
    const cells = row.querySelectorAll('td');
    // Value is typically in last cell with content
    for (let i = cells.length - 1; i >= 0; i--) {
      const val = parseNumber(cells[i]?.textContent);
      if (val !== null) return val;
    }
    return null;
  };

  // First destruction section (involved in)
  if (destructionSections.length >= 1) {
    const start = destructionSections[0];
    destructionUnitsKilled = parseDestructionValue(rows[start + 1]);
    destructionUnitsLost = parseDestructionValue(rows[start + 2]);
    destructionRecycledMetal = parseDestructionValue(rows[start + 3]);
    destructionRecycledCrystal = parseDestructionValue(rows[start + 4]);
  }

  // Second destruction section (actually destroyed)
  if (destructionSections.length >= 2) {
    const start = destructionSections[1];
    realDestructionUnitsKilled = parseDestructionValue(rows[start + 1]);
    realDestructionUnitsLost = parseDestructionValue(rows[start + 2]);
    realDestructionRecycledMetal = parseDestructionValue(rows[start + 3]);
    realDestructionRecycledCrystal = parseDestructionValue(rows[start + 4]);
  }

  return {
    id: currentPlayerId!,
    name,
    allianceId,
    allianceTag,
    mainCoordinates,
    scoreBuildings: buildings.points,
    scoreBuildingsRank: buildings.rank,
    scoreResearch: research.points,
    scoreResearchRank: research.rank,
    scoreFleet: fleet.points,
    scoreFleetRank: fleet.rank,
    scoreDefense: defense.points,
    scoreDefenseRank: defense.rank,
    scoreTotal: total.points,
    scoreTotalRank: total.rank,
    combatsWon,
    combatsDraw,
    combatsLost,
    combatsTotal,
    honorpoints,
    honorpointsRank,
    fightsHonorable,
    fightsDishonorable,
    fightsNeutral,
    destructionUnitsKilled,
    destructionUnitsLost,
    destructionRecycledMetal,
    destructionRecycledCrystal,
    realDestructionUnitsKilled,
    realDestructionUnitsLost,
    realDestructionRecycledMetal,
    realDestructionRecycledCrystal
  };
}

async function loadPlayerInfo(): Promise<void> {
  if (!currentPlayerId) return;

  try {
    const response = await api.get<BackendPlayer>(`/players/${currentPlayerId}`);
    if (response.ok && response.data) {
      currentNotice = response.data.notice || '';
      debugLog('Loaded player info, notice:', currentNotice);
    }
  } catch (e) {
    debugLog('Failed to load player info (may not exist yet)', e);
  }
}

function addNoticeTextarea(): void {
  const content = document.getElementById('content');
  if (!content) return;

  // Check if already added
  if (document.getElementById('hg-hub-notice')) return;

  const textarea = document.createElement('textarea');
  textarea.id = 'hg-hub-notice';
  textarea.placeholder = 'Hub Notiz...';
  textarea.value = currentNotice;
  textarea.style.cssText = `
    display: block;
    width: 94%;
    margin: 10px auto;
    padding: 8px;
    background: #1a1a2e;
    border: 1px solid #444;
    color: #ddd;
    border-radius: 4px;
    font-size: 13px;
    resize: vertical;
    min-height: 60px;
  `;

  textarea.addEventListener('input', () => {
    currentNotice = textarea.value;
  });

  // Insert at the top of content
  content.insertBefore(textarea, content.firstChild);
}

function addSyncButton(playerData: PlayerData): void {
  const content = document.getElementById('content');
  if (!content) return;

  // Check if already added
  if (document.getElementById('hg-hub-sync-container')) return;

  const container = document.createElement('div');
  container.id = 'hg-hub-sync-container';
  container.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px auto;
    width: 94%;
  `;

  container.innerHTML = `
    <button id="hg-hub-sync-btn" type="button" style="
      background: #c50;
      border: none;
      color: #fff;
      padding: 6px 16px;
      cursor: pointer;
      font-size: 13px;
      border-radius: 4px;
    ">Sync</button>
    <span id="hg-hub-sync-status" style="font-size: 12px;"></span>
  `;

  // Insert after notice textarea or at top
  const notice = document.getElementById('hg-hub-notice');
  if (notice) {
    notice.after(container);
  } else {
    content.insertBefore(container, content.firstChild);
  }

  // Add click handler
  document.getElementById('hg-hub-sync-btn')?.addEventListener('click', () => {
    void syncPlayer(playerData);
  });
}

async function syncPlayer(playerData: PlayerData): Promise<void> {
  const button = document.getElementById('hg-hub-sync-btn') as HTMLButtonElement;
  const status = document.getElementById('hg-hub-sync-status');

  if (!button || !status) return;

  button.disabled = true;
  button.textContent = '...';
  status.textContent = '';

  try {
    const payload = {
      id: playerData.id,
      name: playerData.name,
      alliance_id: playerData.allianceId,
      alliance_tag: playerData.allianceTag,
      main_coordinates: playerData.mainCoordinates,
      notice: currentNotice,  // Send empty string to clear notice
      // Scores
      score_buildings: playerData.scoreBuildings,
      score_buildings_rank: playerData.scoreBuildingsRank,
      score_research: playerData.scoreResearch,
      score_research_rank: playerData.scoreResearchRank,
      score_fleet: playerData.scoreFleet,
      score_fleet_rank: playerData.scoreFleetRank,
      score_defense: playerData.scoreDefense,
      score_defense_rank: playerData.scoreDefenseRank,
      score_total: playerData.scoreTotal,
      score_total_rank: playerData.scoreTotalRank,
      // Combat stats
      combats_won: playerData.combatsWon,
      combats_draw: playerData.combatsDraw,
      combats_lost: playerData.combatsLost,
      combats_total: playerData.combatsTotal,
      // Honorpoints
      honorpoints: playerData.honorpoints,
      honorpoints_rank: playerData.honorpointsRank,
      // Honorfights
      fights_honorable: playerData.fightsHonorable,
      fights_dishonorable: playerData.fightsDishonorable,
      fights_neutral: playerData.fightsNeutral,
      // Destruction stats (involved)
      destruction_units_killed: playerData.destructionUnitsKilled,
      destruction_units_lost: playerData.destructionUnitsLost,
      destruction_recycled_metal: playerData.destructionRecycledMetal,
      destruction_recycled_crystal: playerData.destructionRecycledCrystal,
      // Destruction stats (actually)
      real_destruction_units_killed: playerData.realDestructionUnitsKilled,
      real_destruction_units_lost: playerData.realDestructionUnitsLost,
      real_destruction_recycled_metal: playerData.realDestructionRecycledMetal,
      real_destruction_recycled_crystal: playerData.realDestructionRecycledCrystal
    };

    debugLog('Sync payload:', payload);

    const response = await api.post('/players', payload);

    if (response.ok) {
      status.textContent = '✓ Gespeichert';
      status.style.color = '#5c5';
    } else {
      status.textContent = `✗ ${response.error}`;
      status.style.color = '#c55';
    }
  } catch (error) {
    status.textContent = '✗ Fehler';
    status.style.color = '#c55';
    console.error('[HG Hub] Sync error:', error);
  }

  button.disabled = false;
  button.textContent = 'Sync';
}

async function addPlanetsSection(): Promise<void> {
  if (!currentPlayerId) return;

  const content = document.getElementById('content');
  if (!content) return;

  // Find the main table
  const table = content.querySelector('table');
  if (!table) return;

  try {
    const response = await api.get<BackendPlanet[]>(`/players/${currentPlayerId}/planets`);
    if (!response.ok || !response.data) {
      debugLog('No planets data');
      return;
    }

    const planets = response.data;
    if (planets.length === 0) {
      debugLog('No planets for this player');
      return;
    }

    // Add planets header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
      <th colspan="2" style="text-align: left; padding-top: 15px;">Bekannte Planeten</th>
      <th colspan="2" style="text-align: left; padding-top: 15px;">Mond</th>
    `;
    table.appendChild(headerRow);

    // Group planets and moons by coordinates
    const planetMap = new Map<string, BackendPlanet>();
    const moonMap = new Map<string, BackendPlanet>();

    planets.forEach(p => {
      if (p.type === 'PLANET') {
        planetMap.set(p.coordinates, p);
      } else if (p.type === 'MOON') {
        moonMap.set(p.coordinates, p);
      }
    });

    // Render planet rows
    planetMap.forEach((planet, coords) => {
      const moon = moonMap.get(coords);
      const row = document.createElement('tr');

      const galaxyLink = `/uni6/game.php?page=galaxy&galaxy=${planet.galaxy}&system=${planet.system}`;
      const spyLinkPlanet = `/uni6/game.php?page=fleetTable&galaxy=${planet.galaxy}&system=${planet.system}&planet=${planet.planet}&planettype=1&target_mission=6`;
      const spyLinkMoon = moon ? `/uni6/game.php?page=fleetTable&galaxy=${planet.galaxy}&system=${planet.system}&planet=${planet.planet}&planettype=3&target_mission=6` : '';

      let moonHtml = '<td colspan="2">-</td>';
      if (moon) {
        // Get moon building info if available
        let moonInfo = 'M';
        if (moon.buildings) {
          const base = moon.buildings['41'] || moon.buildings['base'] || '-';
          const portal = moon.buildings['43'] || moon.buildings['portal'] || '-';
          const phalanx = moon.buildings['42'] || moon.buildings['phalanx'] || '-';
          moonInfo = `B${base} S${portal} P${phalanx}`;
        }
        moonHtml = `
          <td style="text-align: left;">
            [<a href="${spyLinkMoon}" style="color: #87ceeb;">S</a>] M
          </td>
          <td style="text-align: left;">${moonInfo}</td>
        `;
      }

      row.innerHTML = `
        <td colspan="2" style="text-align: left;">
          [<a href="${spyLinkPlanet}" style="color: #87ceeb;">S</a>]
          <a href="${galaxyLink}" style="color: #ddd;">${coords}</a>
          ${planet.name ? `(${planet.name})` : ''}
        </td>
        ${moonHtml}
      `;

      table.appendChild(row);
    });

  } catch (e) {
    debugLog('Failed to load planets', e);
  }
}
