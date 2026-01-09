/**
 * Messages page enhancements
 * - Parse and sync spy reports
 */

import { api } from '../../api/client';
import { storage } from '../../utils/storage';
import { t } from '../../locales';
import { debugLog, parseGermanNumber } from '../../utils/formatting';

// LocalStorage keys for synced report IDs
const SYNCED_SPY_REPORTS_KEY = 'hg-hub-synced-spy-reports';
const SYNCED_HOSTILE_SPYING_KEY = 'hg-hub-synced-hostile-spying';
const SYNCED_BATTLE_REPORTS_KEY = 'hg-hub-synced-battle-reports';
const SYNCED_EXPEDITION_REPORTS_KEY = 'hg-hub-synced-expedition-reports';
const SYNCED_RECYCLE_REPORTS_KEY = 'hg-hub-synced-recycle-reports';

// Category mappings from data-info prefix
const CATEGORY_RESOURCES = '900';
const CATEGORY_BUILDINGS = '0';
const CATEGORY_RESEARCH = '100';
const CATEGORY_FLEET = '200';
const CATEGORY_DEFENSE = '400';

// Planet keywords for all supported languages (checked at start of report text)
const PLANET_KEYWORDS = [
  'planet',    // English, Deutsch, Polish, Spanish, Português
  'planète',   // French
  'планета',   // Русский
  'gezegen',   // Türkçe
  'hafen',     // SetSails
  'blanedne',  // Ogerfränkisch
];

interface SpyReportData {
  id: number;
  galaxy: number;
  system: number;
  planet: number;
  type: string;
  report_time?: string;
  resources?: Record<string, number>;
  buildings?: Record<string, number>;
  research?: Record<string, number>;
  fleet?: Record<string, number>;
  defense?: Record<string, number>;
}

interface SpyReportElement {
  messageId: number;
  element: HTMLElement;
  messageItem: Element;
}

// ============================================================================
// Synced Reports Storage (generic)
// ============================================================================

function getSyncedIds(storageKey: string): Set<number> {
  try {
    const stored = localStorage.getItem(storageKey);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function markIdsSynced(storageKey: string, ids: number[]): void {
  const synced = getSyncedIds(storageKey);
  ids.forEach(id => synced.add(id));
  localStorage.setItem(storageKey, JSON.stringify([...synced]));
}

function isIdSynced(storageKey: string, id: number): boolean {
  return getSyncedIds(storageKey).has(id);
}

// Message categories (URL parameter)
const MSG_CATEGORY_SPY_REPORTS = '0';
const MSG_CATEGORY_COMBAT = '3';
const MSG_CATEGORY_FLEET = '5';
const MSG_CATEGORY_ESPIONAGE_DEFENCE = '7';
const MSG_CATEGORY_EXPEDITION = '15';
const MSG_CATEGORY_ALL = '100';

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize messages page enhancements
 */
export function initMessagesPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'messages') {
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] Messages: Not configured, skipping');
    return;
  }

  const category = params.get('category');
  console.log('[HG Hub] Messages: Category', category);

  // Initialize based on category
  switch (category) {
    case MSG_CATEGORY_SPY_REPORTS:
      setTimeout(() => enhanceSpyReports(), 500);
      observeMessageChanges(() => enhanceSpyReports());
      break;
    case MSG_CATEGORY_COMBAT:
      setTimeout(() => enhanceBattleReports(), 500);
      observeMessageChanges(() => enhanceBattleReports());
      break;
    case MSG_CATEGORY_FLEET:
      setTimeout(() => enhanceRecycleReports(), 500);
      observeMessageChanges(() => enhanceRecycleReports());
      break;
    case MSG_CATEGORY_ESPIONAGE_DEFENCE:
      setTimeout(() => enhanceHostileSpying(), 500);
      observeMessageChanges(() => enhanceHostileSpying());
      break;
    case MSG_CATEGORY_EXPEDITION:
      setTimeout(() => enhanceExpeditionReports(), 500);
      observeMessageChanges(() => enhanceExpeditionReports());
      break;
    case MSG_CATEGORY_ALL:
      setTimeout(() => enhanceAllMessages(), 500);
      observeMessageChanges(() => enhanceAllMessages());
      break;
  }
}

/**
 * Watch for message content changes (AJAX loading)
 * Debounced to prevent infinite loops when we modify the DOM
 */
function observeMessageChanges(callback: () => void): void {
  const content = document.querySelector('#content, .content, body');
  if (!content) return;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessing = false;

  const observer = new MutationObserver((mutations) => {
    // Skip if we're already processing
    if (isProcessing) return;

    // Check if any mutation is NOT from our own elements
    const hasExternalChange = mutations.some(mutation => {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Ignore our own elements (all have 'hg-hub' prefix in id or class)
          if (node.id?.startsWith('hg-hub') || node.className?.includes('hg-hub')) {
            continue;
          }
          return true;
        }
      }
      return false;
    });

    if (!hasExternalChange) return;

    // Debounce the callback
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      isProcessing = true;
      callback();
      // Reset after a short delay
      setTimeout(() => { isProcessing = false; }, 200);
    }, 100);
  });

  observer.observe(content, { childList: true, subtree: true });
}

// ============================================================================
// UI Enhancement
// ============================================================================

/**
 * Find all spy reports and add sync functionality
 */
function enhanceSpyReports(): void {
  const spyReports = findSpyReports();
  debugLog(`Found ${spyReports.length} spy reports`);

  if (spyReports.length === 0) return;

  // Count new (unsynced) reports
  const newReports = spyReports.filter(r => !isIdSynced(SYNCED_SPY_REPORTS_KEY, r.messageId));
  const syncedReports = spyReports.filter(r => isIdSynced(SYNCED_SPY_REPORTS_KEY, r.messageId));

  debugLog(`New: ${newReports.length}, Already synced: ${syncedReports.length}`);

  // Mark synced reports visually
  syncedReports.forEach(r => markAsSynced(r.messageItem));

  // Add or update sync button if there are new reports
  addSyncAllButton(spyReports, newReports.length, syncAllSpyReports, t('sync.spyReports'));
}

/**
 * Find all spy report elements on the page
 */
function findSpyReports(): SpyReportElement[] {
  const reports: SpyReportElement[] = [];
  const spyReportElements = document.querySelectorAll('.spyRaport');

  spyReportElements.forEach(report => {
    const messageItem = report.closest('.message-item');
    if (!messageItem) return;

    const messageId = messageItem.id?.replace('message_', '');
    if (!messageId) return;

    reports.push({
      messageId: parseInt(messageId, 10),
      element: report as HTMLElement,
      messageItem
    });
  });

  return reports;
}

// Generic type for message elements
interface MessageElement {
  messageId: number;
  element: HTMLElement;
  messageItem: Element;
}

/**
 * Add "Sync All" button to the message group header
 */
function addSyncAllButton<T extends MessageElement>(
  allItems: T[],
  newCount: number,
  syncFn: (items: T[], btn: HTMLButtonElement) => Promise<void>,
  label: string
): void {
  // Find the message group header
  const messageGroup = document.querySelector('.message-group, #message-group, [id^="group_"]');
  if (!messageGroup) {
    debugLog('messageGroup not found');
    return;
  }

  // Remove existing button
  const existingBtn = document.getElementById('hg-hub-sync-all-btn');
  if (existingBtn) existingBtn.remove();

  // Don't show button if no new reports
  if (newCount === 0) return;

  const syncBtn = document.createElement('button');
  syncBtn.id = 'hg-hub-sync-all-btn';
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
  syncBtn.innerHTML = `⬆ ${t('sync.button', { count: newCount })}`;
  syncBtn.title = t('sync.buttonTitle', { count: newCount, label: label });

  syncBtn.addEventListener('click', async () => {
    debugLog('Sync button clicked');
    syncBtn.disabled = true;
    try {
      await syncFn(allItems, syncBtn);
    } catch (e) {
      console.error('[HG Hub] Sync error:', e);
      syncBtn.disabled = false;
    }
  });

  // Insert at the beginning of the message group
  messageGroup.insertBefore(syncBtn, messageGroup.firstChild);
}

/**
 * Mark a message as already synced
 */
function markAsSynced(messageItem: Element): void {
  if (messageItem.classList.contains('hg-hub-synced')) return;
  messageItem.classList.add('hg-hub-synced');

  // Add visual indicator
  const actionsDiv = messageItem.querySelector('.message-actions');
  if (actionsDiv && !actionsDiv.querySelector('.hg-hub-synced-indicator')) {
    const indicator = document.createElement('span');
    indicator.className = 'hg-hub-synced-indicator';
    indicator.style.cssText = 'color: #8f8; margin-left: 10px; font-size: 11px;';
    indicator.innerHTML = '✓';
    indicator.title = t('sync.alreadySynced');
    actionsDiv.appendChild(indicator);
  }
}

// ============================================================================
// Generic Sync Helper
// ============================================================================

interface SyncConfig<T extends MessageElement> {
  storageKey: string;
  endpoint: string;
  parseFn: (item: T) => unknown | null;
}

/**
 * Generic sync function for all message types
 * Reduces code duplication across syncAll* functions
 */
async function syncMessages<T extends MessageElement>(
  allItems: T[],
  syncBtn: HTMLButtonElement,
  config: SyncConfig<T>
): Promise<void> {
  const { storageKey, endpoint, parseFn } = config;
  const newItems = allItems.filter(item => !isIdSynced(storageKey, item.messageId));
  debugLog(`Syncing ${newItems.length} of ${allItems.length} items to ${endpoint}`);

  if (newItems.length === 0) {
    syncBtn.innerHTML = `✓ ${t('sync.allSynced')}`;
    syncBtn.style.color = '#8f8';
    return;
  }

  syncBtn.innerHTML = `⏳ ${t('sync.progress', { current: 0, total: newItems.length })}`;
  syncBtn.disabled = true;

  let synced = 0;
  let errors = 0;
  const syncedIds: number[] = [];

  for (const item of newItems) {
    try {
      const data = parseFn(item);

      if (!data) {
        errors++;
        debugLog(`Parse error for message ${item.messageId}`);
        continue;
      }

      const result = await api.post(endpoint, data);

      if (result.ok) {
        synced++;
        syncedIds.push(item.messageId);
        markAsSynced(item.messageItem);
      } else {
        errors++;
      }
    } catch (error) {
      errors++;
      debugLog('Sync error:', error);
    }

    syncBtn.innerHTML = `⏳ ${t('sync.progress', { current: synced + errors, total: newItems.length })}`;
  }

  if (syncedIds.length > 0) {
    markIdsSynced(storageKey, syncedIds);
  }

  syncBtn.disabled = false;
  if (errors === 0) {
    syncBtn.innerHTML = `✓ ${t('sync.synced', { count: synced })}`;
    syncBtn.style.color = '#8f8';
    setTimeout(() => syncBtn.remove(), 2000);
  } else {
    syncBtn.innerHTML = `⚠ ${t('sync.withErrors', { ok: synced, errors: errors })}`;
    syncBtn.style.color = '#fa0';
  }
}

// ============================================================================
// Spy Reports Sync
// ============================================================================

/**
 * Sync all new (unsynced) spy reports
 */
async function syncAllSpyReports(allReports: SpyReportElement[], syncBtn: HTMLButtonElement): Promise<void> {
  await syncMessages(allReports, syncBtn, {
    storageKey: SYNCED_SPY_REPORTS_KEY,
    endpoint: '/spy-reports',
    parseFn: (r) => parseSpyReport(r.element, r.messageId),
  });
}

// ============================================================================
// Hostile Spying (Espionage Defence)
// ============================================================================

interface HostileSpyingData {
  id: number;
  attacker_coordinates?: string;
  target_coordinates?: string;
  report_time?: string;
}

/**
 * Find all hostile spying messages and add sync functionality
 */
function enhanceHostileSpying(): void {
  const messages = findHostileSpyingMessages();
  debugLog(`Found ${messages.length} hostile spying messages`);

  if (messages.length === 0) return;

  const newMessages = messages.filter(m => !isIdSynced(SYNCED_HOSTILE_SPYING_KEY, m.messageId));
  const syncedMessages = messages.filter(m => isIdSynced(SYNCED_HOSTILE_SPYING_KEY, m.messageId));

  debugLog(`New: ${newMessages.length}, Already synced: ${syncedMessages.length}`);

  syncedMessages.forEach(m => markAsSynced(m.messageItem));
  addSyncAllButton(messages, newMessages.length, syncAllHostileSpying, t('sync.espionageDefence'));
}

/**
 * Find all hostile spying message elements
 */
function findHostileSpyingMessages(): MessageElement[] {
  const messages: MessageElement[] = [];
  const messageItems = document.querySelectorAll('.message-item');

  messageItems.forEach(item => {
    const messageId = item.id?.replace('message_', '');
    if (!messageId) return;

    const content = item.querySelector('.message-content');
    if (!content) return;

    messages.push({
      messageId: parseInt(messageId, 10),
      element: content as HTMLElement,
      messageItem: item
    });
  });

  return messages;
}

/**
 * Parse hostile spying message to extract coordinates
 */
function parseHostileSpying(content: HTMLElement, messageId: number): HostileSpyingData | null {
  // Find all links with coordinates
  const links = content.querySelectorAll('a[href*="galaxy"]');

  if (links.length < 2) {
    debugLog('Not enough coordinate links found');
    return null;
  }

  // Extract coordinates from link text (e.g., "[1:220:10]")
  const extractCoords = (link: Element): string | undefined => {
    const text = link.textContent || '';
    const match = text.match(/\[(\d+:\d+:\d+)]/);
    return match ? match[1] : undefined;
  };

  const attackerCoords = extractCoords(links[0]);
  const targetCoords = extractCoords(links[1]);

  // Get report time
  const messageItem = content.closest('.message-item');
  const reportTime = messageItem?.querySelector('.message-date')?.textContent?.trim();

  return {
    id: messageId,
    attacker_coordinates: attackerCoords,
    target_coordinates: targetCoords,
    report_time: reportTime,
  };
}

/**
 * Sync all hostile spying messages
 */
async function syncAllHostileSpying(allMessages: MessageElement[], syncBtn: HTMLButtonElement): Promise<void> {
  await syncMessages(allMessages, syncBtn, {
    storageKey: SYNCED_HOSTILE_SPYING_KEY,
    endpoint: '/hostile-spying',
    parseFn: (m) => parseHostileSpying(m.element, m.messageId),
  });
}

// ============================================================================
// Battle Reports (Combat Messages)
// ============================================================================

interface BattleReportData {
  id: number;
  galaxy: number;
  system: number;
  planet: number;
  type: string;
  report_time?: string;
  attacker_lost: number;
  defender_lost: number;
  metal: number;
  crystal: number;
  deuterium: number;
  debris_metal: number;
  debris_crystal: number;
}

/**
 * Find all battle reports and add sync functionality
 */
function enhanceBattleReports(): void {
  const reports = findBattleReports();
  debugLog(`Found ${reports.length} battle reports`);

  if (reports.length === 0) return;

  const newReports = reports.filter(r => !isIdSynced(SYNCED_BATTLE_REPORTS_KEY, r.messageId));
  const syncedReports = reports.filter(r => isIdSynced(SYNCED_BATTLE_REPORTS_KEY, r.messageId));

  debugLog(`New: ${newReports.length}, Already synced: ${syncedReports.length}`);

  syncedReports.forEach(r => markAsSynced(r.messageItem));
  addSyncAllButton(reports, newReports.length, syncAllBattleReports, t('sync.battleReports'));
}

/**
 * Find all battle report elements on the page
 */
function findBattleReports(): MessageElement[] {
  const reports: MessageElement[] = [];
  const battleReportElements = document.querySelectorAll('.raportMessage');

  battleReportElements.forEach(report => {
    const messageItem = report.closest('.message-item');
    if (!messageItem) return;

    const messageId = messageItem.id?.replace('message_', '');
    if (!messageId) return;

    reports.push({
      messageId: parseInt(messageId, 10),
      element: report as HTMLElement,
      messageItem
    });
  });

  return reports;
}

/**
 * Parse battle report HTML and extract all data
 */
function parseBattleReport(messageItem: Element, messageId: number): BattleReportData | null {
  const html = messageItem.innerHTML;
  const raportMessage = messageItem.querySelector('.raportMessage');

  if (!raportMessage) {
    debugLog('No .raportMessage found');
    return null;
  }

  // Extract coordinates from the message
  const coordMatch = raportMessage.innerHTML.match(/\[(\d+):(\d+):(\d+)]/);
  if (!coordMatch) {
    debugLog('No coordinates found in battle report');
    return null;
  }

  const galaxy = parseInt(coordMatch[1], 10);
  const system = parseInt(coordMatch[2], 10);
  const planet = parseInt(coordMatch[3], 10);

  // Detect planet type from planettype parameter or moon indicator
  const planetTypeMatch = html.match(/planettype=(\d)/);
  const type = planetTypeMatch && planetTypeMatch[1] === '3' ? 'MOON' : 'PLANET';

  // Extract attacker/defender losses
  const attackerLostMatch = html.match(/Angreifer[:\s]+([.\d]+)</i) ||
                            html.match(/Attacker[:\s]+([.\d]+)</i);
  const defenderLostMatch = html.match(/Verteidiger[:\s]+([.\d]+)</i) ||
                            html.match(/Defender[:\s]+([.\d]+)</i);

  const attackerLost = attackerLostMatch ? parseGermanNumber(attackerLostMatch[1]) : 0;
  const defenderLost = defenderLostMatch ? parseGermanNumber(defenderLostMatch[1]) : 0;

  // Extract stolen resources (from .reportSteal or .raportSteal elements)
  const metalStealMatch = html.match(/(reportSteal|raportSteal)[^>]*element901[^>]*>([.\d]+)</);
  const crystalStealMatch = html.match(/(reportSteal|raportSteal)[^>]*element902[^>]*>([.\d]+)</);
  const deutStealMatch = html.match(/(reportSteal|raportSteal)[^>]*element903[^>]*>([.\d]+)</);

  const metal = metalStealMatch ? parseGermanNumber(metalStealMatch[2]) : 0;
  const crystal = crystalStealMatch ? parseGermanNumber(crystalStealMatch[2]) : 0;
  const deuterium = deutStealMatch ? parseGermanNumber(deutStealMatch[2]) : 0;

  // Extract debris field
  const debrisMetalMatch = html.match(/(reportDebris|raportDebris)[^>]*element901[^>]*>([.\d]+)</);
  const debrisCrystalMatch = html.match(/(reportDebris|raportDebris)[^>]*element902[^>]*>([.\d]+)</);

  const debrisMetal = debrisMetalMatch ? parseGermanNumber(debrisMetalMatch[2]) : 0;
  const debrisCrystal = debrisCrystalMatch ? parseGermanNumber(debrisCrystalMatch[2]) : 0;

  // Get report time
  const reportTime = messageItem.querySelector('.message-date')?.textContent?.trim();

  debugLog('Parsed battle report:', { galaxy, system, planet, type, attackerLost, defenderLost, metal, crystal, deuterium, debrisMetal, debrisCrystal });

  return {
    id: messageId,
    galaxy,
    system,
    planet,
    type,
    report_time: reportTime,
    attacker_lost: attackerLost,
    defender_lost: defenderLost,
    metal,
    crystal,
    deuterium,
    debris_metal: debrisMetal,
    debris_crystal: debrisCrystal,
  };
}


/**
 * Sync all battle reports
 */
async function syncAllBattleReports(allReports: MessageElement[], syncBtn: HTMLButtonElement): Promise<void> {
  await syncMessages(allReports, syncBtn, {
    storageKey: SYNCED_BATTLE_REPORTS_KEY,
    endpoint: '/battle-reports',
    parseFn: (r) => parseBattleReport(r.messageItem, r.messageId),
  });
}

// ============================================================================
// Expedition Reports
// ============================================================================

interface ExpeditionReportData {
  id: number;
  message?: string;
  type?: string;  // resources, fleet, combat
  report_time?: string;
  resources?: Record<string, number>;
  fleet?: Record<string, number>;
}

/**
 * Find all expedition reports and add sync functionality
 */
function enhanceExpeditionReports(): void {
  const reports = findExpeditionReports();
  debugLog(`Found ${reports.length} expedition reports`);

  if (reports.length === 0) return;

  const newReports = reports.filter(r => !isIdSynced(SYNCED_EXPEDITION_REPORTS_KEY, r.messageId));
  const syncedReports = reports.filter(r => isIdSynced(SYNCED_EXPEDITION_REPORTS_KEY, r.messageId));

  debugLog(`New: ${newReports.length}, Already synced: ${syncedReports.length}`);

  syncedReports.forEach(r => markAsSynced(r.messageItem));
  addSyncAllButton(reports, newReports.length, syncAllExpeditionReports, t('sync.expeditionReports'));
}

/**
 * Find all expedition report elements on the page
 */
function findExpeditionReports(): MessageElement[] {
  const reports: MessageElement[] = [];
  const messageItems = document.querySelectorAll('.message-item');

  messageItems.forEach(item => {
    const messageId = item.id?.replace('message_', '');
    if (!messageId) return;

    const content = item.querySelector('.message-content');
    if (!content) return;

    reports.push({
      messageId: parseInt(messageId, 10),
      element: content as HTMLElement,
      messageItem: item
    });
  });

  return reports;
}

// Resource keywords for multi-language support
const METAL_KEYWORDS = ['metall', 'metal', 'métal', 'металл', 'metale'];
const CRYSTAL_KEYWORDS = ['kristall', 'crystal', 'cristal', 'кристалл', 'kryształ'];
const DEUTERIUM_KEYWORDS = ['deuterium', 'deut', 'дейтерий'];

/**
 * Parse expedition report and extract data
 * Type is determined by what was found:
 * - resources: if resources were found
 * - fleet: if ships were found
 * - combat: if there was a loss (pirates, aliens, black hole)
 */
function parseExpeditionReport(content: HTMLElement, messageId: number): ExpeditionReportData | null {
  const messageItem = content.closest('.message-item');
  const reportTime = messageItem?.querySelector('.message-date')?.textContent?.trim();
  const messageText = content.textContent?.trim() || '';

  // Try to extract resources from HTML elements first (some games use this)
  const resources: Record<string, number> = {};
  const resourceElements = content.querySelectorAll('[class*="element90"]');
  resourceElements.forEach(el => {
    const className = el.className;
    const match = className.match(/element(90[1-3])/);
    if (match) {
      const valueText = el.textContent?.trim().replace(/\./g, '').replace(/,/g, '') || '0';
      const value = parseInt(valueText, 10);
      if (!isNaN(value) && value > 0) {
        resources[match[1]] = value;
      }
    }
  });

  // If no HTML elements found, parse plain text for resources
  // Pattern: "number Resource" e.g. "750 Kristall", "1.234.567 Metal"
  if (Object.keys(resources).length === 0) {
    // Match numbers followed by text (resource name)
    const resourceMatches = messageText.match(/([\d.]+)\s+(\S+)/g) || [];

    for (const match of resourceMatches) {
      const parts = match.match(/([\d.]+)\s+(\S+)/);
      if (!parts) continue;

      const value = parseInt(parts[1].replace(/\./g, ''), 10);
      const resourceName = parts[2].toLowerCase().replace(/[.,!?]$/, ''); // Remove trailing punctuation

      if (isNaN(value) || value <= 0) continue;

      // Match resource type by keyword
      if (METAL_KEYWORDS.some(kw => resourceName.includes(kw))) {
        resources['901'] = value;
      } else if (CRYSTAL_KEYWORDS.some(kw => resourceName.includes(kw))) {
        resources['902'] = value;
      } else if (DEUTERIUM_KEYWORDS.some(kw => resourceName.includes(kw))) {
        resources['903'] = value;
      }
    }
  }

  // Try to extract fleet (look for elements with fleet IDs 202-215)
  const fleet: Record<string, number> = {};
  const fleetElements = content.querySelectorAll('[class*="element2"]');
  fleetElements.forEach(el => {
    const className = el.className;
    const match = className.match(/element(2\d{2})/);
    if (match) {
      const valueText = el.textContent?.trim().replace(/\./g, '').replace(/,/g, '') || '0';
      const value = parseInt(valueText, 10);
      if (!isNaN(value) && value > 0) {
        fleet[match[1]] = value;
      }
    }
  });

  // Determine type based on what was found
  let type: string | undefined;
  const hasResources = Object.keys(resources).length > 0;
  const hasFleet = Object.keys(fleet).length > 0;

  if (hasResources) {
    type = 'resources';
  } else if (hasFleet) {
    type = 'fleet';
  } else {
    // Check for combat/loss indicators in the message
    type = 'other';
  }

  debugLog('Parsed expedition report:', { messageId, type, resources, fleet, messageText: messageText.substring(0, 100) });

  return {
    id: messageId,
    message: messageText,
    type,
    report_time: reportTime,
    resources: hasResources ? resources : undefined,
    fleet: hasFleet ? fleet : undefined,
  };
}

/**
 * Sync all expedition reports
 */
async function syncAllExpeditionReports(allReports: MessageElement[], syncBtn: HTMLButtonElement): Promise<void> {
  await syncMessages(allReports, syncBtn, {
    storageKey: SYNCED_EXPEDITION_REPORTS_KEY,
    endpoint: '/expedition-reports',
    parseFn: (r) => parseExpeditionReport(r.element, r.messageId),
  });
}

// ============================================================================
// Recycle Reports (Category 5 - Fleet Messages)
// ============================================================================

interface RecycleReportData {
  id: number;
  galaxy: number;
  system: number;
  planet: number;
  report_time?: string;
  metal: number;
  crystal: number;
  metal_tf: number;
  crystal_tf: number;
}

/**
 * Find all recycle reports and add sync functionality
 * Recycle reports share category 5 with transports, but have only 1 coordinate link
 */
function enhanceRecycleReports(): void {
  const reports = findRecycleReports();
  debugLog(`Found ${reports.length} recycle reports`);

  if (reports.length === 0) return;

  const newReports = reports.filter(r => !isIdSynced(SYNCED_RECYCLE_REPORTS_KEY, r.messageId));
  const syncedReports = reports.filter(r => isIdSynced(SYNCED_RECYCLE_REPORTS_KEY, r.messageId));

  debugLog(`New: ${newReports.length}, Already synced: ${syncedReports.length}`);

  syncedReports.forEach(r => markAsSynced(r.messageItem));
  addSyncAllButton(reports, newReports.length, syncAllRecycleReports, t('sync.recycleReports'));
}

/**
 * Find recycle report elements (messages with exactly 1 coordinate link)
 * This filters out transport messages which have 2 coordinate links
 */
function findRecycleReports(): MessageElement[] {
  const reports: MessageElement[] = [];
  const messageItems = document.querySelectorAll('.message-item');

  messageItems.forEach(item => {
    const messageId = item.id?.replace('message_', '');
    if (!messageId) return;

    const content = item.querySelector('.message-content');
    if (!content) return;

    // Count coordinate links - recycling has 1, transport has 2
    const coordLinks = content.querySelectorAll('a[href*="galaxy"]');
    if (coordLinks.length !== 1) return; // Skip transports and other messages

    reports.push({
      messageId: parseInt(messageId, 10),
      element: content as HTMLElement,
      messageItem: item
    });
  });

  return reports;
}

/**
 * Parse recycle report and extract data
 * Format: "collected X Metal and Y Crystal from a total of A Metal and B Crystal at coordinates [g:s:p]"
 */
function parseRecycleReport(content: HTMLElement, messageId: number): RecycleReportData | null {
  const messageItem = content.closest('.message-item');
  const reportTime = messageItem?.querySelector('.message-date')?.textContent?.trim();
  const text = content.textContent || '';

  // Extract coordinates from link
  const coordLink = content.querySelector('a[href*="galaxy"]');
  const coordText = coordLink?.textContent || '';
  const coordMatch = coordText.match(/\[(\d+):(\d+):(\d+)]/);

  if (!coordMatch) {
    debugLog('No coordinates found in recycle report');
    return null;
  }

  const galaxy = parseInt(coordMatch[1], 10);
  const system = parseInt(coordMatch[2], 10);
  const planet = parseInt(coordMatch[3], 10);

  // Get text AFTER the coordinates link to avoid parsing coordinate numbers
  const coordIndex = text.indexOf(coordText);
  const textAfterCoords = coordIndex >= 0 ? text.substring(coordIndex + coordText.length) : text;

  // Extract numbers from text after coordinates
  // Format: "X Metall und Y Kristall von insgesamt A Metall und B Kristall"
  const numbers = textAfterCoords.match(/[\d.]+/g)?.map(n => parseInt(n.replace(/\./g, ''), 10)) || [];

  let metal = 0, crystal = 0, metalTf = 0, crystalTf = 0;

  if (numbers.length >= 4) {
    // First 2 numbers are collected, next 2 are total debris field
    metal = numbers[0] || 0;
    crystal = numbers[1] || 0;
    metalTf = numbers[2] || 0;
    crystalTf = numbers[3] || 0;
  }

  debugLog('Parsed recycle report:', { messageId, galaxy, system, planet, metal, crystal, metalTf, crystalTf });

  return {
    id: messageId,
    galaxy,
    system,
    planet,
    report_time: reportTime,
    metal,
    crystal,
    metal_tf: metalTf,
    crystal_tf: crystalTf,
  };
}

/**
 * Sync all recycle reports
 */
async function syncAllRecycleReports(allReports: MessageElement[], syncBtn: HTMLButtonElement): Promise<void> {
  await syncMessages(allReports, syncBtn, {
    storageKey: SYNCED_RECYCLE_REPORTS_KEY,
    endpoint: '/recycle-reports',
    parseFn: (r) => parseRecycleReport(r.element, r.messageId),
  });
}

// ============================================================================
// All Messages (Category 100)
// ============================================================================

type MessageType = 'spy' | 'battle' | 'expedition' | 'recycle' | 'hostile' | null;

interface TypedMessage extends MessageElement {
  type: MessageType;
}

/**
 * Detect the type of a message based on its HTML structure
 * Uses CSS classes and subject text to identify message types
 */
function detectMessageType(messageItem: Element): MessageType {
  // Check for spy report (.spyRaport element)
  if (messageItem.querySelector('.spyRaport')) {
    return 'spy';
  }

  // Check for battle report (.raportMessage element)
  if (messageItem.querySelector('.raportMessage')) {
    return 'battle';
  }

  // For other types, check the .message-subject text
  const subject = messageItem.querySelector('.message-subject')?.textContent?.toLowerCase() || '';

  // Expedition reports
  if (subject.includes('expedition')) {
    return 'expedition';
  }

  // Recycle reports
  if (subject.includes('recycl')) {
    return 'recycle';
  }

  // Hostile spying (espionage defence)
  if (subject.includes('spionage') || subject.includes('espionage')) {
    return 'hostile';
  }

  return null;
}

/**
 * Get the storage key for a message type
 */
function getStorageKeyForType(type: MessageType): string | null {
  switch (type) {
    case 'spy': return SYNCED_SPY_REPORTS_KEY;
    case 'battle': return SYNCED_BATTLE_REPORTS_KEY;
    case 'expedition': return SYNCED_EXPEDITION_REPORTS_KEY;
    case 'recycle': return SYNCED_RECYCLE_REPORTS_KEY;
    case 'hostile': return SYNCED_HOSTILE_SPYING_KEY;
    default: return null;
  }
}

/**
 * Find all messages and categorize them by type
 */
function findAllMessages(): TypedMessage[] {
  const messages: TypedMessage[] = [];
  const messageItems = document.querySelectorAll('.message-item');

  messageItems.forEach(item => {
    const messageId = item.id?.replace('message_', '');
    if (!messageId) return;

    const type = detectMessageType(item);
    if (!type) return; // Skip unknown message types

    const content = item.querySelector('.message-content, .spyRaport, .raportMessage');
    if (!content) return;

    messages.push({
      messageId: parseInt(messageId, 10),
      element: content as HTMLElement,
      messageItem: item,
      type,
    });
  });

  return messages;
}

/**
 * Enhance all messages page with sync button for all message types
 */
function enhanceAllMessages(): void {
  const messages = findAllMessages();
  debugLog(`Found ${messages.length} syncable messages on All Messages page`);

  if (messages.length === 0) return;

  // Count new messages by type
  const counts = { spy: 0, battle: 0, expedition: 0, recycle: 0, hostile: 0, total: 0 };

  messages.forEach(msg => {
    const storageKey = getStorageKeyForType(msg.type);
    if (!storageKey) return;

    if (!isIdSynced(storageKey, msg.messageId)) {
      if (msg.type) counts[msg.type]++;
      counts.total++;
    } else {
      markAsSynced(msg.messageItem);
    }
  });

  debugLog('New message counts:', counts);

  // Add sync all button if there are new messages
  addSyncAllMessagesButton(messages, counts);
}

/**
 * Add "Sync All" button for all message types
 */
function addSyncAllMessagesButton(
  allMessages: TypedMessage[],
  counts: { spy: number; battle: number; expedition: number; recycle: number; hostile: number; total: number }
): void {
  // Find the message group header
  const messageGroup = document.querySelector('.message-group, #message-group, [id^="group_"]');
  if (!messageGroup) {
    debugLog('messageGroup not found');
    return;
  }

  // Remove existing button
  const existingBtn = document.getElementById('hg-hub-sync-all-btn');
  if (existingBtn) existingBtn.remove();

  // Don't show button if no new messages
  if (counts.total === 0) return;

  const syncBtn = document.createElement('button');
  syncBtn.id = 'hg-hub-sync-all-btn';
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
  syncBtn.innerHTML = `⬆ ${t('sync.button', { count: counts.total })}`;
  syncBtn.title = t('sync.buttonTitle', { count: counts.total, label: t('sync.allMessages') });

  syncBtn.addEventListener('click', async () => {
    debugLog('Sync All button clicked');
    syncBtn.disabled = true;
    try {
      await syncAllMessages(allMessages, syncBtn);
    } catch (e) {
      console.error('[HG Hub] Sync error:', e);
      syncBtn.disabled = false;
    }
  });

  // Insert at the beginning of the message group
  messageGroup.insertBefore(syncBtn, messageGroup.firstChild);
}

/**
 * Sync all messages of all types
 */
async function syncAllMessages(allMessages: TypedMessage[], syncBtn: HTMLButtonElement): Promise<void> {
  // Filter to only new (unsynced) messages
  const newMessages = allMessages.filter(msg => {
    const storageKey = getStorageKeyForType(msg.type);
    return storageKey && !isIdSynced(storageKey, msg.messageId);
  });

  if (newMessages.length === 0) {
    syncBtn.innerHTML = `✓ ${t('sync.allSynced')}`;
    syncBtn.style.color = '#8f8';
    return;
  }

  syncBtn.innerHTML = `⏳ ${t('sync.progress', { current: 0, total: newMessages.length })}`;
  syncBtn.disabled = true;

  let synced = 0;
  let errors = 0;
  const syncedByType: Record<string, number[]> = {
    spy: [], battle: [], expedition: [], recycle: [], hostile: []
  };

  for (const msg of newMessages) {
    try {
      let data: unknown = null;
      let endpoint = '';

      // Parse and sync based on message type
      switch (msg.type) {
        case 'spy': {
          const spyReport = msg.messageItem.querySelector('.spyRaport');
          if (spyReport) {
            data = parseSpyReport(spyReport as HTMLElement, msg.messageId);
            endpoint = '/spy-reports';
          }
          break;
        }
        case 'battle': {
          data = parseBattleReport(msg.messageItem, msg.messageId);
          endpoint = '/battle-reports';
          break;
        }
        case 'expedition': {
          data = parseExpeditionReport(msg.element, msg.messageId);
          endpoint = '/expedition-reports';
          break;
        }
        case 'recycle': {
          data = parseRecycleReport(msg.element, msg.messageId);
          endpoint = '/recycle-reports';
          break;
        }
        case 'hostile': {
          data = parseHostileSpying(msg.element, msg.messageId);
          endpoint = '/hostile-spying';
          break;
        }
      }

      if (!data || !endpoint) {
        errors++;
        debugLog(`Parse error for ${msg.type} message ${msg.messageId}`);
        continue;
      }

      const result = await api.post(endpoint, data);

      if (result.ok) {
        synced++;
        if (msg.type) syncedByType[msg.type].push(msg.messageId);
        markAsSynced(msg.messageItem);
      } else {
        errors++;
      }
    } catch (error) {
      errors++;
      debugLog('Sync error:', error);
    }

    syncBtn.innerHTML = `⏳ ${t('sync.progress', { current: synced + errors, total: newMessages.length })}`;
  }

  // Save synced IDs to localStorage by type
  for (const [type, ids] of Object.entries(syncedByType)) {
    if (ids.length > 0) {
      const storageKey = getStorageKeyForType(type as MessageType);
      if (storageKey) {
        markIdsSynced(storageKey, ids);
      }
    }
  }

  // Update button state
  syncBtn.disabled = false;
  if (errors === 0) {
    syncBtn.innerHTML = `✓ ${t('sync.synced', { count: synced })}`;
    syncBtn.style.color = '#8f8';
  } else {
    syncBtn.innerHTML = `⚠ ${t('sync.withErrors', { ok: synced, errors: errors })}`;
    syncBtn.style.color = '#fa0';
  }

  if (errors === 0) {
    setTimeout(() => {
      syncBtn.remove();
    }, 2000);
  }
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Detect if report is for a moon or planet by checking the beginning of report text
 */
function detectPlanetType(reportText: string): string {
  const startText = reportText.substring(0, 50).toLowerCase();

  for (const keyword of PLANET_KEYWORDS) {
    if (startText.includes(keyword)) {
      return 'PLANET';
    }
  }

  return 'MOON';
}

/**
 * Parse spy report HTML and extract all data
 */
function parseSpyReport(report: HTMLElement, messageId: number): SpyReportData | null {
  const head = report.querySelector('.spyRaportHead');
  const coordsAttr = head?.getAttribute('coords');

  if (!coordsAttr) {
    debugLog('No coords attribute found');
    return null;
  }

  const coordParts = coordsAttr.split(':');
  if (coordParts.length !== 3) {
    debugLog('Invalid coords format:', coordsAttr);
    return null;
  }

  const galaxy = parseInt(coordParts[0], 10);
  const system = parseInt(coordParts[1], 10);
  const planet = parseInt(coordParts[2], 10);

  const reportText = head?.textContent?.toLowerCase() || '';
  const planetType = detectPlanetType(reportText);

  const messageItem = report.closest('.message-item');
  const reportTime = messageItem?.querySelector('.message-date')?.textContent?.trim();

  const resources: Record<string, number> = {};
  const buildings: Record<string, number> = {};
  const research: Record<string, number> = {};
  const fleet: Record<string, number> = {};
  const defense: Record<string, number> = {};

  const cells = report.querySelectorAll('.spyRaportContainerCell[data-info]');

  cells.forEach(cell => {
    const dataInfo = cell.getAttribute('data-info');
    if (!dataInfo) return;

    const valueText = cell.textContent?.trim().replace(/\./g, '') || '0';
    const value = parseInt(valueText, 10);

    if (isNaN(value)) return;

    const parts = dataInfo.split('_');
    if (parts.length !== 2) return;

    const category = parts[0];
    const itemId = parts[1];

    switch (category) {
      case CATEGORY_RESOURCES:
        resources[itemId] = value;
        break;
      case CATEGORY_BUILDINGS:
        buildings[itemId] = value;
        break;
      case CATEGORY_RESEARCH:
        research[itemId] = value;
        break;
      case CATEGORY_FLEET:
        fleet[itemId] = value;
        break;
      case CATEGORY_DEFENSE:
        defense[itemId] = value;
        break;
    }
  });

  debugLog('Parsed data:', { resources, buildings, research, fleet, defense });

  return {
    id: messageId,
    galaxy,
    system,
    planet,
    type: planetType,
    report_time: reportTime,
    resources: Object.keys(resources).length > 0 ? resources : undefined,
    buildings: Object.keys(buildings).length > 0 ? buildings : undefined,
    research: Object.keys(research).length > 0 ? research : undefined,
    fleet: Object.keys(fleet).length > 0 ? fleet : undefined,
    defense: Object.keys(defense).length > 0 ? defense : undefined,
  };
}
