/**
 * HG Hub - Main Entry Point
 */

import './types';
import { initI18n } from './locales';
import { addMenuItem, HubPage } from './ui/menu';
import { initGalaxyPage } from './ui/pages/galaxy';
import { initPlayerCardPage } from './ui/pages/playercard';
import { initBuildingsPage } from './ui/pages/buildings';
import { initResearchPage } from './ui/pages/research';
import { initMessagesPage } from './ui/pages/messages';
import { initEmpirePage } from './ui/pages/empire';
import { initStatisticsPage } from './ui/pages/statistics';
import { initBattleReportPage } from './ui/pages/battleReport';
import { initSettingsPage } from './ui/pages/settings';
import { initMarketplacePage } from './ui/pages/marketplace';
import { renderGalaxyStatusPage } from './ui/pages/hub/galaxyStatus';
import { initOverviewPage } from './ui/pages/hub/overview';
import { renderPointsPage } from './ui/pages/hub/points';
import { renderRaidExpoPage } from './ui/pages/hub/raidExpo';
import { renderEspionagePage } from './ui/pages/hub/espionage';
import { initFlightCalcPage } from './ui/pages/hub/flightCalc';

/**
 * Handle Hub page navigation
 */
function navigateToHubPage(page: HubPage): void {
  switch (page) {
    case 'galaxyStatus':
      renderGalaxyStatusPage();
      break;
    case 'points':
      renderPointsPage();
      break;
    case 'raidExpo':
      renderRaidExpoPage();
      break;
    case 'espionage':
      renderEspionagePage();
      break;
    case 'flightCalc':
      renderFlightCalcPage();
      break;
  }
}

/**
 * Render flight calculator page in content area
 */
function renderFlightCalcPage(): void {
  const contentArea = document.getElementById('content') || document.querySelector('content');
  if (!contentArea) return;

  // Clear content and create container
  contentArea.innerHTML = '';
  const container = document.createElement('div');
  container.id = 'hg-hub-flight-calc';
  container.style.cssText = 'padding: 10px;';
  contentArea.appendChild(container);

  initFlightCalcPage(container);
}

function init(): void {
  // Verify Tampermonkey loader is present
  if (typeof window.HG_HUB === 'undefined') {
    console.error('[HG Hub] HG_HUB not found. Is the Tampermonkey script installed?');
    return;
  }

  console.log('[HG Hub] Initializing...');

  // Initialize i18n
  initI18n();

  // Check if we're in the main page or iframe (PlayerCard)
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');

  // PlayerCard is loaded in iframe - only initialize playercard functionality
  if (page === 'playerCard') {
    initPlayerCardPage();
    console.log('[HG Hub] PlayerCard Ready');
    return;
  }

  // Add menu item to sidebar (only for main pages)
  addMenuItem(navigateToHubPage);

  // Initialize page-specific enhancements
  initGalaxyPage();
  initOverviewPage();
  initBuildingsPage();
  initResearchPage();
  initMessagesPage();
  initEmpirePage();
  initStatisticsPage();
  initBattleReportPage();
  initSettingsPage();
  initMarketplacePage();

  console.log('[HG Hub] Ready');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
