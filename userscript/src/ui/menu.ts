/**
 * Menu integration - adds HG Hub to pr0game's sidebar
 */

import { storage } from '../utils/storage';
import { t } from '../locales';

const MENU_GALAXY_ID = 'hg-hub-menu-galaxy';
const MENU_POINTS_ID = 'hg-hub-menu-points';
const MENU_RAIDEXPO_ID = 'hg-hub-menu-raidexpo';
const MENU_ESPIONAGE_ID = 'hg-hub-menu-espionage';
const MENU_FLIGHTCALC_ID = 'hg-hub-menu-flightcalc';

export type HubPage = 'galaxyStatus' | 'points' | 'raidExpo' | 'espionage' | 'flightCalc';
type PageHandler = (page: HubPage) => void;

let onPageHandler: PageHandler | null = null;

/**
 * Add the HG Hub menu items to the sidebar
 */
export function addMenuItem(onPage: PageHandler): void {
  onPageHandler = onPage;
  tryAddMenuItem();
}

function tryAddMenuItem(): void {
  const menu = document.querySelector('ul#menu');

  if (!menu) {
    // Menu not ready yet, retry
    setTimeout(tryAddMenuItem, 500);
    return;
  }

  // Already added?
  if (document.getElementById(MENU_GALAXY_ID)) {
    return;
  }

  // Create menu items (Planets/Fleet/Research consolidated into "Points")
  // Settings removed - now integrated into game's settings page
  const galaxyItem = createMenuItem(MENU_GALAXY_ID, t('hub.menu.galaxyStatus'), 'galaxyStatus');
  const pointsItem = createMenuItem(MENU_POINTS_ID, t('hub.menu.points'), 'points');
  const raidExpoItem = createMenuItem(MENU_RAIDEXPO_ID, t('hub.menu.raidExpo'), 'raidExpo');
  const espionageItem = createMenuItem(MENU_ESPIONAGE_ID, t('hub.menu.espionage'), 'espionage');
  const flightCalcItem = createMenuItem(MENU_FLIGHTCALC_ID, t('hub.menu.flightCalc'), 'flightCalc');

  // Create separator (only bottom, before Alliance menu item)
  const separatorBottom = document.createElement('li');
  separatorBottom.className = 'menu-separator hg-hub-separator';

  // Find menu item to insert before
  // Try multiple possible anchor values since game language may differ from hub language
  const possibleAnchors = ['allianz', 'alliance', 'alianza', 'альянс', 'aliança', 'sojusz', 'ittifak'];
  const allianzItem = Array.from(menu.querySelectorAll('li a')).find(a =>
    possibleAnchors.includes(a.textContent?.trim().toLowerCase() || '')
  )?.parentElement;

  if (allianzItem) {
    // Insert before Allianz: separator, then our items
    menu.insertBefore(separatorBottom, allianzItem);
    menu.insertBefore(flightCalcItem, separatorBottom);
    menu.insertBefore(espionageItem, flightCalcItem);
    menu.insertBefore(raidExpoItem, espionageItem);
    menu.insertBefore(pointsItem, raidExpoItem);
    menu.insertBefore(galaxyItem, pointsItem);
  } else {
    // Fallback: prepend at beginning
    menu.prepend(flightCalcItem);
    menu.prepend(espionageItem);
    menu.prepend(raidExpoItem);
    menu.prepend(pointsItem);
    menu.prepend(galaxyItem);
  }

  updateMenuState();
}

function createMenuItem(id: string, label: string, page: HubPage): HTMLLIElement {
  const li = document.createElement('li');
  li.id = id;
  li.className = 'hg-hub-menu-item';

  const anchor = document.createElement('a');
  anchor.href = 'javascript:void(0)';
  anchor.textContent = label;
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    onPageHandler?.(page);
  });

  li.appendChild(anchor);
  return li;
}

/**
 * Update menu visual state based on configuration
 * Shows warning indicator on Galaxy menu item if not configured
 */
export function updateMenuState(): void {
  const galaxyItem = document.getElementById(MENU_GALAXY_ID);
  const anchor = galaxyItem?.querySelector('a');
  if (!anchor) return;

  if (!storage.isConfigured()) {
    anchor.style.color = '#ff6b6b';
    anchor.title = t('messages.apiKeyRequired');
  } else {
    anchor.style.color = '';
    anchor.title = '';
  }
}
