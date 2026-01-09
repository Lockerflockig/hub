/**
 * Research page enhancements
 * - Show max alliance research level for each technology
 */

import { api } from '../../api/client';
import { storage } from '../../utils/storage';
import { debugLog } from '../../utils/formatting';

interface MaxResearchInfo {
  max_level: number;
  player_name: string;
}

interface HubResearchResponse {
  research: Record<string, MaxResearchInfo>;
}

/**
 * Initialize research page enhancements
 */
export function initResearchPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'research') {
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] Research: Not configured, skipping');
    return;
  }

  console.log('[HG Hub] Research: Initializing...');

  // Wait for page to be fully loaded
  setTimeout(() => {
    void enhanceResearchPage();
  }, 300);
}

async function enhanceResearchPage(): Promise<void> {
  // Fetch max research levels from alliance
  try {
    const response = await api.get<HubResearchResponse>('/hub/playerresearch');
    if (response.ok && response.data) {
      debugLog('Max research:', response.data.research);
      addMaxLevelDisplays(response.data.research);
    }
  } catch (e) {
    debugLog('Failed to load max research', e);
  }
}

/**
 * Find all research cards and add max level display
 */
function addMaxLevelDisplays(maxResearch: Record<string, MaxResearchInfo>): void {
  // Find all research containers (same structure as buildings)
  const researchCards = document.querySelectorAll('.infos, .infoso');

  researchCards.forEach(card => {
    // Find the buildn div that contains research info
    const buildnDiv = card.querySelector('.buildn');
    if (!buildnDiv) return;

    // Extract research ID from the onclick attribute: .info(ID)
    const link = buildnDiv.querySelector('a[onclick*=".info("]');
    if (!link) return;

    const onclick = link.getAttribute('onclick') || '';
    const idMatch = onclick.match(/\.info\((\d+)\)/);
    if (!idMatch) return;

    const researchId = idMatch[1];
    const maxInfo = maxResearch[researchId];

    if (!maxInfo) {
      debugLog(`No max info for research ${researchId}`);
      return;
    }

    // Check if we already added the max level
    if (buildnDiv.querySelector('.hg-hub-max-level')) return;

    // Get current level from text like "Stufe 40"
    const levelText = buildnDiv.textContent || '';
    const currentMatch = levelText.match(/Stufe\s*(\d+)/i);
    const currentLevel = currentMatch ? parseInt(currentMatch[1], 10) : 0;

    // Only show if there's a higher level in alliance
    if (maxInfo.max_level <= currentLevel) {
      debugLog(`Research ${researchId}: current ${currentLevel} >= max ${maxInfo.max_level}`);
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
    debugLog(`Added max level for research ${researchId}: ${maxInfo.max_level} (${maxInfo.player_name})`);
  });
}
