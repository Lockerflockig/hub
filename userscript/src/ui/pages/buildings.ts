/**
 * Buildings page enhancements
 * - Show max alliance building level for each building
 */

import { api } from '../../api/client';
import { storage } from '../../utils/storage';
import { debugLog } from '../../utils/formatting';

interface MaxBuildingInfo {
  max_level: number;
  player_name: string;
}

interface HubBuildingsResponse {
  buildings: Record<string, MaxBuildingInfo>;
}

/**
 * Initialize buildings page enhancements
 */
export function initBuildingsPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'buildings') {
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] Buildings: Not configured, skipping');
    return;
  }

  console.log('[HG Hub] Buildings: Initializing...');

  // Wait for page to be fully loaded
  setTimeout(() => {
    void enhanceBuildingsPage();
  }, 300);
}

async function enhanceBuildingsPage(): Promise<void> {
  // Fetch max building levels from alliance
  try {
    const response = await api.get<HubBuildingsResponse>('/hub/buildings');
    if (response.ok && response.data) {
      debugLog('Max buildings:', response.data.buildings);
      addMaxLevelDisplays(response.data.buildings);
    }
  } catch (e) {
    debugLog('Failed to load max buildings', e);
  }
}

/**
 * Find all building cards and add max level display
 */
function addMaxLevelDisplays(maxBuildings: Record<string, MaxBuildingInfo>): void {
  // Find all building containers
  const buildingCards = document.querySelectorAll('.infos_prod, .infos');

  buildingCards.forEach(card => {
    // Find the hidden input with building ID
    const buildingInput = card.querySelector('input[name="building"]') as HTMLInputElement;
    if (!buildingInput) return;

    const buildingId = buildingInput.value;
    const maxInfo = maxBuildings[buildingId];

    if (!maxInfo) {
      debugLog(`No max info for building ${buildingId}`);
      return;
    }

    // Find the buildn div that shows current level
    const buildnDiv = card.querySelector('.buildn');
    if (!buildnDiv) return;

    // Check if we already added the max level
    if (buildnDiv.querySelector('.hg-hub-max-level')) return;

    // Get current level from text like "(Level 40)"
    const levelText = buildnDiv.textContent || '';
    const currentMatch = levelText.match(/\(Level\s*(\d+)\)/i);
    const currentLevel = currentMatch ? parseInt(currentMatch[1], 10) : 0;

    // Only show if there's a higher level in alliance
    if (maxInfo.max_level <= currentLevel) {
      debugLog(`Building ${buildingId}: current ${currentLevel} >= max ${maxInfo.max_level}`);
      return;
    }

    // Create max level display
    const maxLevelDiv = document.createElement('div');
    maxLevelDiv.className = 'hg-hub-max-level';
    maxLevelDiv.style.cssText = `
      font-size: 11px;
      color: #8cf;
      margin-top: 2px;
    `;
    maxLevelDiv.innerHTML = `Max Stufe: ${maxInfo.max_level}<br><span style="color: #888; font-size: 10px;">${maxInfo.player_name}</span>`;

    buildnDiv.appendChild(maxLevelDiv);
    debugLog(`Added max level for building ${buildingId}: ${maxInfo.max_level} (${maxInfo.player_name})`);
  });
}
