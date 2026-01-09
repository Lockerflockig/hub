/**
 * Statistics page sync
 * Syncs player rankings from the statistics page
 * Only syncs the currently displayed page - user must manually navigate to each page
 */

import { api } from '../../api/client';
import { storage } from '../../utils/storage';
import { debugLog } from '../../utils/formatting';

// Stat types from the dropdown
type StatType = 'total' | 'fleet' | 'research' | 'buildings' | 'defense' | 'honor';

const STAT_TYPE_MAP: Record<string, StatType> = {
  '1': 'total',
  '2': 'fleet',
  '3': 'research',
  '4': 'buildings',
  '5': 'defense',
  '6': 'honor',
};

interface PlayerStatRow {
  player_id: number;
  player_name: string;
  alliance_tag: string | null;
  rank: number;
  score: number;
  // NOTE: is_inactive and is_long_inactive removed - sending activity data is forbidden by pr0game rules
}

interface StatsSyncRequest {
  stat_type: StatType;
  players: PlayerStatRow[];
}

/**
 * Initialize statistics page enhancements
 */
export function initStatisticsPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'statistics') {
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] Statistics: Not configured, skipping');
    return;
  }

  // Only sync player stats (who=1), not alliance stats (who=2)
  const who = params.get('who') || '1';
  if (who !== '1') {
    debugLog('Alliance stats view, skipping sync');
    return;
  }

  setTimeout(() => addSyncButton(), 500);
}

/**
 * Add sync button to the statistics page
 */
function addSyncButton(): void {
  // Find the form/table header
  const formTable = document.querySelector('form[name="stats"]');
  if (!formTable) {
    debugLog('Stats form not found');
    return;
  }

  // Check if button already exists
  if (document.getElementById('hg-hub-stats-sync-btn')) {
    return;
  }

  const syncBtn = document.createElement('button');
  syncBtn.id = 'hg-hub-stats-sync-btn';
  syncBtn.type = 'button';
  syncBtn.style.cssText = `
    background: #2a4a6a;
    border: 1px solid #4a8aba;
    color: #8cf;
    padding: 4px 10px;
    margin: 5px;
    cursor: pointer;
    font-size: 12px;
    border-radius: 3px;
  `;
  syncBtn.innerHTML = `⬆ Sync Stats`;
  syncBtn.title = 'Sync current statistics page to Hub';

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '⏳ Syncing...';

    try {
      await syncCurrentPage(syncBtn);
    } catch (e) {
      console.error('[HG Hub] Stats sync error:', e);
      syncBtn.innerHTML = '❌ Error';
      syncBtn.style.color = '#f88';
      setTimeout(() => {
        syncBtn.innerHTML = '⬆ Sync Stats';
        syncBtn.style.color = '#8cf';
        syncBtn.disabled = false;
      }, 2000);
    }
  });

  // Insert after the form
  formTable.insertAdjacentElement('afterend', syncBtn);
}

/**
 * Parse the current statistics table (only what's visible on the page)
 */
function parseStatsTable(): PlayerStatRow[] {
  const players: PlayerStatRow[] = [];

  // Find the stats table (second table on the page)
  const tables = document.querySelectorAll('table.table519');
  if (tables.length < 2) {
    debugLog('Stats table not found');
    return players;
  }

  const statsTable = tables[1];
  const rows = statsTable.querySelectorAll('tr');

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');

    if (cells.length < 5) continue;

    // Extract rank from first cell
    const rankText = cells[0].textContent?.trim() || '0';
    const rank = parseInt(rankText, 10);

    // Extract player ID and name from second cell
    // Pattern: Dialog.Playercard(218, 'Mijhiatar')
    const playerCell = cells[1];
    const playerLink = playerCell.querySelector('a[onclick*="Playercard"]');

    if (!playerLink) continue;

    const onclick = playerLink.getAttribute('onclick') || '';
    const playerMatch = onclick.match(/Playercard\((\d+),\s*'([^']+)'\)/);

    if (!playerMatch) continue;

    const playerId = parseInt(playerMatch[1], 10);
    const playerName = playerMatch[2];

    // NOTE: Activity indicators (inactive/longinactive) are NOT sent - forbidden by pr0game rules

    // Extract alliance from fourth cell
    const allianceCell = cells[3];
    let allianceTag: string | null = null;

    if (allianceCell.textContent?.trim() !== '-') {
      const allianceLink = allianceCell.querySelector('a');
      if (allianceLink) {
        allianceTag = allianceLink.textContent?.trim() || null;
      }
    }

    // Extract score from fifth cell
    const scoreText = cells[4].textContent?.trim().replace(/\./g, '') || '0';
    const score = parseInt(scoreText, 10);

    players.push({
      player_id: playerId,
      player_name: playerName,
      alliance_tag: allianceTag,
      rank,
      score,
    });
  }

  debugLog(`Parsed ${players.length} players`);
  return players;
}

/**
 * Get current stat type from dropdown
 */
function getCurrentStatType(): StatType {
  const typeSelect = document.getElementById('type') as HTMLSelectElement;
  const typeValue = typeSelect?.value || '1';
  return STAT_TYPE_MAP[typeValue] || 'total';
}

/**
 * Sync the current page (only what user has navigated to)
 */
async function syncCurrentPage(btn: HTMLButtonElement): Promise<void> {
  const players = parseStatsTable();

  if (players.length === 0) {
    btn.innerHTML = '⚠ No data';
    btn.style.color = '#fa0';
    return;
  }

  const statType = getCurrentStatType();

  const request: StatsSyncRequest = {
    stat_type: statType,
    players,
  };

  debugLog('Syncing stats:', request);

  const result = await api.post('/statistics/sync', request);

  if (result.ok) {
    btn.innerHTML = `✓ Synced ${players.length}`;
    btn.style.color = '#8f8';
    // Keep button in "done" state - user can reload page to sync again
    btn.disabled = true;
  } else {
    btn.innerHTML = '❌ Failed';
    btn.style.color = '#f88';
    setTimeout(() => {
      btn.innerHTML = '⬆ Sync Stats';
      btn.style.color = '#8cf';
      btn.disabled = false;
    }, 2000);
  }
}
