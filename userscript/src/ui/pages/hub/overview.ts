/**
 * Overview page enhancement - Injects player data table on game's overview page
 */

import { api } from '../../../api/client';
import { t, getTranslations, getLanguage } from '../../../locales';
import { formatCategory } from '../../../utils/gameIds';
import { storage } from '../../../utils/storage';
import { updateMenuState } from '../../menu';

const CONTENT_ID = 'hg-hub-overview';
const SETTINGS_KEY = 'hg-hub-overview-settings';

interface OverviewPlanet {
  id: number;
  planet_id: number | null;  // pr0game internal planet ID (for Ajax spy)
  coordinates: string;
  galaxy: number;
  system: number;
  planet: number;
  player_id: number;
  player_name: string;
  alliance_id: number | null;
  alliance_tag: string | null;
  notice: string | null;  // Player notice for tooltip
  score_total: number | null;
  score_buildings: number | null;
  score_research: number | null;
  score_fleet: number | null;
  score_defense: number | null;
  diff06: number | null;
  diff12: number | null;
  diff18: number | null;
  diff24: number | null;
  inactive_since: string | null;
  vacation_since: string | null;
  last_spy_report: string | null;
  last_battle_report: string | null;
  spy_metal: number | null;
  spy_crystal: number | null;
  spy_deuterium: number | null;
}

interface OverviewResponse {
  planets: OverviewPlanet[];
}

interface OverviewSettings {
  // Index signature for dynamic property access
  [key: string]: string | number | null;
  // Filter
  filterInactive: 'show' | 'hide' | 'only';
  filterVacation: 'show' | 'hide' | 'only';
  filterSpyReport: 'show' | 'hide' | 'only';
  filterBattleReport: 'show' | 'hide' | 'only';
  // Thresholds
  scoreMin: number | null;
  scoreMax: number | null;
  scoreBuildingsMin: number | null;
  scoreBuildingsMax: number | null;
  scoreResearchMin: number | null;
  scoreResearchMax: number | null;
  scoreFleetMin: number | null;
  scoreFleetMax: number | null;
  scoreDefenseMin: number | null;
  scoreDefenseMax: number | null;
  // Freunde & Feinde
  friendAlliances: string;
  friendPlayers: string;
  enemyAlliances: string;
  enemyPlayers: string;
  // Container height
  tableHeight: number;
  // Overlay settings
  spyReportLimit: number;
  battleReportLimit: number;
  // Spy settings
  spyProbeCount: number;
}

const defaultSettings: OverviewSettings = {
  filterInactive: 'show',
  filterVacation: 'show',
  filterSpyReport: 'show',
  filterBattleReport: 'show',
  scoreMin: null,
  scoreMax: null,
  scoreBuildingsMin: null,
  scoreBuildingsMax: null,
  scoreResearchMin: null,
  scoreResearchMax: null,
  scoreFleetMin: null,
  scoreFleetMax: null,
  scoreDefenseMin: null,
  scoreDefenseMax: null,
  friendAlliances: '',
  friendPlayers: '',
  enemyAlliances: '',
  enemyPlayers: '',
  tableHeight: 550,
  spyReportLimit: 10,
  battleReportLimit: 10,
  spyProbeCount: 5,
};

// State
let cachedData: OverviewPlanet[] = [];
let settings: OverviewSettings = { ...defaultSettings };
let sortColumn = 'coordinates';
let sortDirection: 'ASC' | 'DESC' = 'ASC';
let settingsVisible = false;
let activeSettingsTab = 'filter';
let containerElement: HTMLElement | null = null;
let searchQuery = '';

/**
 * Initialize overview page enhancement
 * Only runs on the game's overview page (page=overview)
 */
export function initOverviewPage(): void {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');

  // Only run on the overview page
  if (page !== 'overview') {
    return;
  }

  // Wait for page to be fully loaded before adding our content
  // Use retry mechanism to handle slow page loads
  waitForContentArea(0);
}

function waitForContentArea(attempt: number): void {
  const maxAttempts = 10;
  const delay = 200; // 200ms between attempts

  // Try multiple selectors: id="content", id="inhalt", or <content> tag
  const contentArea = document.getElementById('content') ||
    document.getElementById('inhalt') ||
    document.querySelector('content');

  if (contentArea) {
    initOverviewContent(contentArea as HTMLElement);
  } else if (attempt < maxAttempts) {
    setTimeout(() => waitForContentArea(attempt + 1), delay);
  } else {
    console.error('[HG Hub] Content area not found after', maxAttempts, 'attempts');
  }
}

function initOverviewContent(contentArea: HTMLElement): void {

  // Load settings from localStorage
  loadSettings();

  // Create container for our content
  const container = document.createElement('div');
  container.id = CONTENT_ID;
  container.style.cssText = 'margin-top: 20px; padding: 10px;';
  container.innerHTML = `
    <div class="c" style="margin-bottom: 10px;">${t('hub.overview.title')}</div>
    <div style="text-align: center; padding: 20px;">${t('hub.overview.loading')}</div>
  `;

  // Append after existing content
  contentArea.appendChild(container);
  containerElement = container;

  // Fetch data
  void loadData();
}

async function loadData(): Promise<void> {
  if (!containerElement) return;

  // Check if API key is configured - if not, show setup form
  if (!storage.isConfigured()) {
    showSetupForm();
    return;
  }

  try {
    const response = await api.get<OverviewResponse>('/hub/overview');

    if (response.ok && response.data) {
      cachedData = response.data.planets;
      renderContent();
    } else if (response.status === 401) {
      // API key is invalid or not found - show setup form to allow user to fix it
      storage.setApiKey(''); // Clear invalid key
      updateMenuState();
      showSetupForm();
    } else {
      showError(response.error || 'Failed to load data');
    }
  } catch (error) {
    showError(String(error));
  }
}

function loadSettings(): void {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      settings = { ...defaultSettings, ...JSON.parse(saved) };
    }
  } catch {
    settings = { ...defaultSettings };
  }
}

function saveSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function renderContent(): void {
  if (!containerElement) return;

  const filteredData = filterData([...cachedData]);
  const sortedData = sortData(filteredData);
  const table = buildTable(sortedData);
  const settingsPanel = buildSettingsPanel();

  containerElement.innerHTML = `
    <div class="c" style="margin-bottom: 10px;">${t('hub.overview.title')}</div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="font-size: 12px; color: #888;">
        ${t('hub.overview.count')}: ${sortedData.length} / ${cachedData.length}
      </span>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input
          type="text"
          id="hg-search-input"
          placeholder="${t('hub.overview.searchPlaceholder')}"
          value="${searchQuery}"
          style="
            padding: 6px 10px;
            background: #1a2a3a;
            color: #fff;
            border: 1px solid #4a8aba;
            border-radius: 3px;
            font-size: 12px;
            width: 180px;
          "
        />
        <button id="hg-toggle-settings" style="
          background: ${settingsVisible ? '#4a8aba' : '#2a4a6a'};
          color: ${settingsVisible ? '#fff' : '#8cf'};
          border: 1px solid #4a8aba;
          padding: 6px 12px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 12px;
        ">
          ⚙ ${t('hub.overview.settings')}
        </button>
      </div>
    </div>
    ${settingsPanel}
    <div id="hg-table-container" style="
      overflow: auto;
      overscroll-behavior: contain;
      height: ${settings.tableHeight}px;
      border: 1px solid #4a8aba;
      border-radius: 3px;
      resize: vertical;
      scroll-behavior: smooth;
    ">
      ${table}
    </div>
  `;

  bindEvents();
}

function buildSettingsPanel(): string {
  if (!settingsVisible) return '';

  const tabs = [
    { id: 'filter', label: t('hub.overview.tabs.filter') },
    { id: 'thresholds', label: t('hub.overview.tabs.thresholds') },
    { id: 'friends', label: t('hub.overview.tabs.friends') },
    { id: 'overlay', label: t('hub.overview.tabs.overlay') },
  ];

  const tabsHtml = tabs.map(tab => `
    <button class="hg-settings-tab" data-tab="${tab.id}" style="
      background: ${activeSettingsTab === tab.id ? '#4a8aba' : '#2a4a6a'};
      color: ${activeSettingsTab === tab.id ? '#fff' : '#8cf'};
      border: 1px solid #4a8aba;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 3px 3px 0 0;
      margin-right: 2px;
      font-size: 11px;
    ">${tab.label}</button>
  `).join('');

  let contentHtml = '';
  if (activeSettingsTab === 'filter') {
    contentHtml = buildFilterTab();
  } else if (activeSettingsTab === 'thresholds') {
    contentHtml = buildThresholdsTab();
  } else if (activeSettingsTab === 'friends') {
    contentHtml = buildFriendsTab();
  } else if (activeSettingsTab === 'overlay') {
    contentHtml = buildOverlayTab();
  }

  return `
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; margin-bottom: 15px; padding: 10px;">
      <div style="margin-bottom: 10px;">
        ${tabsHtml}
      </div>
      <div style="padding: 10px;">
        ${contentHtml}
      </div>
    </div>
  `;
}

function buildFilterTab(): string {
  const buildSelect = (id: string, label: string, value: string) => `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="width: 200px; font-size: 12px;">${label}</span>
      <select id="${id}" style="background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; padding: 4px 8px; border-radius: 3px;">
        <option value="show" ${value === 'show' ? 'selected' : ''}>${t('hub.overview.filter.show')}</option>
        <option value="hide" ${value === 'hide' ? 'selected' : ''}>${t('hub.overview.filter.hide')}</option>
        <option value="only" ${value === 'only' ? 'selected' : ''}>${t('hub.overview.filter.only')}</option>
      </select>
    </div>
  `;

  return `
    <div style="font-size: 12px;">
      <div style="font-weight: bold; margin-bottom: 10px; color: #8cf;">${t('hub.overview.filter.title')}</div>
      ${buildSelect('filterInactive', t('hub.overview.filter.inactive'), settings.filterInactive)}
      ${buildSelect('filterVacation', t('hub.overview.filter.vacation'), settings.filterVacation)}
      ${buildSelect('filterSpyReport', t('hub.overview.filter.spyReport'), settings.filterSpyReport)}
      ${buildSelect('filterBattleReport', t('hub.overview.filter.battleReport'), settings.filterBattleReport)}
    </div>
  `;
}

function buildThresholdsTab(): string {
  const buildThreshold = (id: string, label: string, minVal: number | null, maxVal: number | null) => `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="width: 180px; font-size: 12px;">${label}</span>
      <input type="number" id="${id}Min" placeholder="min" value="${minVal ?? ''}"
        style="width: 80px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; padding: 4px 8px; border-radius: 3px; margin-right: 8px;">
      <input type="number" id="${id}Max" placeholder="max" value="${maxVal ?? ''}"
        style="width: 80px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; padding: 4px 8px; border-radius: 3px;">
    </div>
  `;

  return `
    <div style="font-size: 12px;">
      <div style="font-weight: bold; margin-bottom: 10px; color: #8cf;">${t('hub.overview.thresholds.title')}</div>
      ${buildThreshold('score', t('hub.overview.thresholds.points'), settings.scoreMin, settings.scoreMax)}
      ${buildThreshold('scoreBuildings', t('hub.overview.thresholds.buildings'), settings.scoreBuildingsMin, settings.scoreBuildingsMax)}
      ${buildThreshold('scoreResearch', t('hub.overview.thresholds.research'), settings.scoreResearchMin, settings.scoreResearchMax)}
      ${buildThreshold('scoreFleet', t('hub.overview.thresholds.fleet'), settings.scoreFleetMin, settings.scoreFleetMax)}
      ${buildThreshold('scoreDefense', t('hub.overview.thresholds.defense'), settings.scoreDefenseMin, settings.scoreDefenseMax)}
    </div>
  `;
}

function buildFriendsTab(): string {
  const buildInput = (id: string, label: string, value: string, placeholder: string) => `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="width: 180px; font-size: 12px;">${label}</span>
      <input type="text" id="${id}" value="${value}" placeholder="${placeholder}"
        style="flex: 1; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; padding: 4px 8px; border-radius: 3px;">
    </div>
  `;

  return `
    <div style="font-size: 12px;">
      <div style="font-weight: bold; margin-bottom: 10px; color: #8cf;">${t('hub.overview.friends.title')}</div>
      <div style="color: #888; margin-bottom: 10px; font-size: 11px;">
        ${t('hub.overview.friends.hint')}
      </div>
      ${buildInput('friendAlliances', t('hub.overview.friends.friendAlliances'), settings.friendAlliances, t('hub.overview.friends.placeholderAlliances'))}
      ${buildInput('friendPlayers', t('hub.overview.friends.friendPlayers'), settings.friendPlayers, t('hub.overview.friends.placeholderPlayers'))}
      ${buildInput('enemyAlliances', t('hub.overview.friends.enemyAlliances'), settings.enemyAlliances, t('hub.overview.friends.placeholderAlliances'))}
      ${buildInput('enemyPlayers', t('hub.overview.friends.enemyPlayers'), settings.enemyPlayers, t('hub.overview.friends.placeholderPlayers'))}
    </div>
  `;
}

function buildOverlayTab(): string {
  return `
    <div style="font-size: 12px;">
      <div style="font-weight: bold; margin-bottom: 10px; color: #8cf;">${t('hub.overview.overlay.title')}</div>
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="width: 220px;">${t('hub.overview.overlay.spyReportLimit')}</span>
        <input type="number" id="spyReportLimit" value="${settings.spyReportLimit}" min="1" max="50"
          style="width: 80px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; padding: 4px 8px; border-radius: 3px;">
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="width: 220px;">${t('hub.overview.overlay.battleReportLimit')}</span>
        <input type="number" id="battleReportLimit" value="${settings.battleReportLimit}" min="1" max="50"
          style="width: 80px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; padding: 4px 8px; border-radius: 3px;">
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="width: 220px;">${t('hub.overview.overlay.spyProbeCount')}</span>
        <input type="number" id="spyProbeCount" value="${settings.spyProbeCount}" min="1" max="100"
          style="width: 80px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; padding: 4px 8px; border-radius: 3px;">
      </div>
    </div>
  `;
}

function filterData(data: OverviewPlanet[]): OverviewPlanet[] {
  return data.filter(p => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = p.player_name.toLowerCase().includes(query);
      const allyTag = p.alliance_tag && p.alliance_tag !== '???' ? p.alliance_tag : '';
      const allyMatch = allyTag.toLowerCase().includes(query);
      const coordMatch = p.coordinates.includes(query);
      if (!nameMatch && !allyMatch && !coordMatch) return false;
    }

    // Filter: Inactive
    const isInactive = p.inactive_since !== null;
    if (settings.filterInactive === 'hide' && isInactive) return false;
    if (settings.filterInactive === 'only' && !isInactive) return false;

    // Filter: Vacation
    const isVacation = p.vacation_since !== null;
    if (settings.filterVacation === 'hide' && isVacation) return false;
    if (settings.filterVacation === 'only' && !isVacation) return false;

    // Filter: Spy Report
    const hasSpyReport = p.last_spy_report !== null;
    if (settings.filterSpyReport === 'hide' && hasSpyReport) return false;
    if (settings.filterSpyReport === 'only' && !hasSpyReport) return false;

    // Filter: Battle Report
    const hasBattleReport = p.last_battle_report !== null;
    if (settings.filterBattleReport === 'hide' && hasBattleReport) return false;
    if (settings.filterBattleReport === 'only' && !hasBattleReport) return false;

    // Thresholds
    const score = p.score_total ?? 0;
    if (settings.scoreMin !== null && score < settings.scoreMin) return false;
    if (settings.scoreMax !== null && score > settings.scoreMax) return false;

    const scoreBuildings = p.score_buildings ?? 0;
    if (settings.scoreBuildingsMin !== null && scoreBuildings < settings.scoreBuildingsMin) return false;
    if (settings.scoreBuildingsMax !== null && scoreBuildings > settings.scoreBuildingsMax) return false;

    const scoreResearch = p.score_research ?? 0;
    if (settings.scoreResearchMin !== null && scoreResearch < settings.scoreResearchMin) return false;
    if (settings.scoreResearchMax !== null && scoreResearch > settings.scoreResearchMax) return false;

    const scoreFleet = p.score_fleet ?? 0;
    if (settings.scoreFleetMin !== null && scoreFleet < settings.scoreFleetMin) return false;
    if (settings.scoreFleetMax !== null && scoreFleet > settings.scoreFleetMax) return false;

    const scoreDefense = p.score_defense ?? 0;
    if (settings.scoreDefenseMin !== null && scoreDefense < settings.scoreDefenseMin) return false;
    if (settings.scoreDefenseMax !== null && scoreDefense > settings.scoreDefenseMax) return false;

    return true;
  });
}

function sortData(data: OverviewPlanet[]): OverviewPlanet[] {
  const multiplier = sortDirection === 'ASC' ? 1 : -1;

  return data.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortColumn) {
      case 'coordinates':
        if (a.galaxy !== b.galaxy) return (a.galaxy - b.galaxy) * multiplier;
        if (a.system !== b.system) return (a.system - b.system) * multiplier;
        return (a.planet - b.planet) * multiplier;
      case 'player_name':
        aVal = a.player_name.toLowerCase();
        bVal = b.player_name.toLowerCase();
        break;
      case 'alliance_tag':
        aVal = (a.alliance_tag ?? '').toLowerCase();
        bVal = (b.alliance_tag ?? '').toLowerCase();
        break;
      case 'score_total':
        aVal = a.score_total ?? 0;
        bVal = b.score_total ?? 0;
        break;
      case 'score_buildings':
        aVal = a.score_buildings ?? 0;
        bVal = b.score_buildings ?? 0;
        break;
      case 'score_research':
        aVal = a.score_research ?? 0;
        bVal = b.score_research ?? 0;
        break;
      case 'score_fleet':
        aVal = a.score_fleet ?? 0;
        bVal = b.score_fleet ?? 0;
        break;
      case 'score_defense':
        aVal = a.score_defense ?? 0;
        bVal = b.score_defense ?? 0;
        break;
      case 'spy_resources':
        aVal = (a.spy_metal ?? 0) + (a.spy_crystal ?? 0) + (a.spy_deuterium ?? 0);
        bVal = (b.spy_metal ?? 0) + (b.spy_crystal ?? 0) + (b.spy_deuterium ?? 0);
        break;
      case 'last_spy_report':
        aVal = a.last_spy_report ?? '';
        bVal = b.last_spy_report ?? '';
        break;
      case 'last_battle_report':
        aVal = a.last_battle_report ?? '';
        bVal = b.last_battle_report ?? '';
        break;
      case 'diff06':
        aVal = a.diff06 ?? 0;
        bVal = b.diff06 ?? 0;
        break;
      case 'diff12':
        aVal = a.diff12 ?? 0;
        bVal = b.diff12 ?? 0;
        break;
      case 'diff18':
        aVal = a.diff18 ?? 0;
        bVal = b.diff18 ?? 0;
        break;
      case 'diff24':
        aVal = a.diff24 ?? 0;
        bVal = b.diff24 ?? 0;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

function buildTable(data: OverviewPlanet[]): string {
  // Parse friend/enemy names
  const friendAlliances = parseNames(settings.friendAlliances);
  const friendPlayers = parseNames(settings.friendPlayers);
  const enemyAlliances = parseNames(settings.enemyAlliances);
  const enemyPlayers = parseNames(settings.enemyPlayers);

  let html = '<table style="border-collapse: collapse; width: 100%; font-size: 11px;">';

  // Header row - sticky
  const trans = getTranslations();
  const catNames = trans.gameIds?.categories || { points: 'Points', resources: 'Resources' };
  const tableLabels = trans.hub?.overview?.table || {};

  html += '<thead><tr style="background: rgba(0,0,0,0.5); position: sticky; top: 0; z-index: 1;">';
  html += `<th style="padding: 4px; text-align: center; width: 50px;" title="${tableLabels.actionsTitle || 'Actions'}">${tableLabels.actions || 'Act'}</th>`;
  html += buildSortHeader('alliance_tag', tableLabels.ally || 'Ally', 'ASC', 'left');
  html += buildSortHeader('player_name', tableLabels.player || 'Player', 'ASC', 'left');
  html += buildSortHeader('coordinates', tableLabels.coords || '⌖', 'ASC', 'center');
  html += buildSortHeader('score_total', tableLabels.points || catNames.points || 'P', 'DESC', 'right', '#8cf', tableLabels.pointsTitle || catNames.points || 'Points');
  html += buildSortHeader('spy_resources', tableLabels.resources || catNames.resources || 'Res', 'DESC', 'right', '#9c27b0', tableLabels.resourcesTitle || catNames.resources || 'Resources');
  html += buildSortHeader('diff06', tableLabels.diff6h || '6h', 'DESC', 'right', '#64b5f6', tableLabels.diff6hTitle || 'Δ 6h');
  html += buildSortHeader('diff12', tableLabels.diff12h || '12h', 'DESC', 'right', '#64b5f6', tableLabels.diff12hTitle || 'Δ 12h');
  html += buildSortHeader('diff18', tableLabels.diff18h || '18h', 'DESC', 'right', '#64b5f6', tableLabels.diff18hTitle || 'Δ 18h');
  html += buildSortHeader('diff24', tableLabels.diff24h || '24h', 'DESC', 'right', '#64b5f6', tableLabels.diff24hTitle || 'Δ 24h');
  html += buildSortHeader('last_spy_report', tableLabels.spy || 'Spy', 'DESC', 'right', '#87ceeb', tableLabels.spyTitle || 'Last spy report');
  html += buildSortHeader('last_battle_report', tableLabels.battle || 'BR', 'DESC', 'right', '#ff7043', tableLabels.battleTitle || 'Last battle report');
  html += '</tr></thead>';

  // Data rows
  html += '<tbody>';
  data.forEach((p) => {
    const rowColor = getRowColor(p, friendAlliances, friendPlayers, enemyAlliances, enemyPlayers);
    const inactiveIcon = p.inactive_since ? `<span style="color: #888;" title="${tableLabels.inactive || 'Inactive'}">i</span> ` : '';
    const vacationIcon = p.vacation_since ? `<span style="color: #ffc107;" title="${tableLabels.vacation || 'Vacation'}">U</span> ` : '';

    // Build action links
    const spyLink = `?page=fleetTable&galaxy=${p.galaxy}&system=${p.system}&planet=${p.planet}&planettype=1&target_mission=6`;
    const attackLink = `?page=fleetTable&galaxy=${p.galaxy}&system=${p.system}&planet=${p.planet}&planettype=1&target_mission=1`;

    // Spy button: Ajax spy if planet_id is available, otherwise regular link
    const spyButton = p.planet_id
      ? `<span class="hg-ajax-spy" data-planet-id="${p.planet_id}" title="${tableLabels.spyAjax || 'Spy (Ajax)'}" style="color: #87ceeb; cursor: pointer; margin-right: 4px;">S</span>`
      : `<a href="${spyLink}" title="${tableLabels.spyLink || 'Spy'}" style="color: #87ceeb; text-decoration: none; margin-right: 4px;">S</a>`;

    // Calculate total resources from spy report
    const totalResources = (p.spy_metal ?? 0) + (p.spy_crystal ?? 0) + (p.spy_deuterium ?? 0);
    // Build localized tooltips
    const resNames = trans.gameIds?.resources || { metal: 'Metal', crystal: 'Crystal', deuterium: 'Deuterium' };
    const resourcesTitle = p.last_spy_report
      ? `${resNames.metal}: ${formatNumber(p.spy_metal)}\n${resNames.crystal}: ${formatNumber(p.spy_crystal)}\n${resNames.deuterium}: ${formatNumber(p.spy_deuterium)}`
      : '';

    // Score breakdown tooltip
    const scoreTitle = `${catNames.buildings || 'Buildings'}: ${formatNumber(p.score_buildings)}\n${catNames.fleet || 'Fleet'}: ${formatNumber(p.score_fleet)}\n${catNames.research || 'Research'}: ${formatNumber(p.score_research)}\n${catNames.defense || 'Defense'}: ${formatNumber(p.score_defense)}`;

    html += `<tr style="border-bottom: 1px solid #333; ${rowColor}">`;
    // Actions column with spy and attack buttons
    html += `<td style="padding: 4px; text-align: center; white-space: nowrap;">
      ${spyButton}
      <a href="${attackLink}" title="${tableLabels.attackLink || 'Attack'}" style="color: #f44336; text-decoration: none;">A</a>
    </td>`;
    html += `<td style="padding: 4px; text-align: left;">${p.alliance_tag && p.alliance_tag !== '???' ? p.alliance_tag : '-'}</td>`;
    // Player name with notice tooltip if available
    const noticeStyle = p.notice ? 'cursor: help; border-bottom: 1px dotted #888;' : '';
    const noticeTitle = p.notice ? ` title="${p.notice.replace(/"/g, '&quot;')}"` : '';
    html += `<td style="padding: 4px; text-align: left;">${inactiveIcon}${vacationIcon}<span style="${noticeStyle}"${noticeTitle}>${p.player_name}</span></td>`;
    html += `<td style="padding: 4px; text-align: center;">
      <a href="?page=galaxy&galaxy=${p.galaxy}&system=${p.system}" style="color: #8cf;">${p.coordinates}</a>
    </td>`;
    // Consolidated points column with hover tooltip
    html += `<td style="padding: 4px; text-align: right; color: #8cf; cursor: help;" title="${scoreTitle}">${formatNumber(p.score_total)}</td>`;
    // Consolidated resources column with hover tooltip
    html += `<td style="padding: 4px; text-align: right; color: #9c27b0; cursor: help;" title="${resourcesTitle}">${totalResources > 0 ? formatNumber(totalResources) : '-'}</td>`;
    // Diff columns with color coding (green positive, red negative)
    html += `<td style="padding: 4px; text-align: right; ${getDiffStyle(p.diff06)}">${formatDiff(p.diff06)}</td>`;
    html += `<td style="padding: 4px; text-align: right; ${getDiffStyle(p.diff12)}">${formatDiff(p.diff12)}</td>`;
    html += `<td style="padding: 4px; text-align: right; ${getDiffStyle(p.diff18)}">${formatDiff(p.diff18)}</td>`;
    html += `<td style="padding: 4px; text-align: right; ${getDiffStyle(p.diff24)}">${formatDiff(p.diff24)}</td>`;
    // Spy report date - clickable to open overlay
    const historyLabels = trans.hub?.overview?.history || {};
    const spyReportLink = p.last_spy_report
      ? `<a href="#" class="hg-spy-history" data-galaxy="${p.galaxy}" data-system="${p.system}" data-planet="${p.planet}" style="color: #87ceeb; cursor: pointer; text-decoration: none;" title="${historyLabels.showHistory || 'Show history'}">${formatAge(p.last_spy_report)}</a>`
      : '-';
    html += `<td style="padding: 4px; text-align: right;">${spyReportLink}</td>`;
    // Battle report date - clickable to open overlay
    const battleReportLink = p.last_battle_report
      ? `<a href="#" class="hg-battle-history" data-galaxy="${p.galaxy}" data-system="${p.system}" data-planet="${p.planet}" style="color: #ff7043; cursor: pointer; text-decoration: none;" title="${historyLabels.showHistory || 'Show history'}">${formatAge(p.last_battle_report)}</a>`
      : '-';
    html += `<td style="padding: 4px; text-align: right;">${battleReportLink}</td>`;
    html += '</tr>';
  });
  html += '</tbody>';

  html += '</table>';
  return html;
}

function buildSortHeader(
  column: string,
  label: string,
  defaultDirection: 'ASC' | 'DESC',
  align: string,
  color = '#fff',
  title = ''
): string {
  const isActive = sortColumn === column;
  const arrow = isActive ? (sortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
  const titleAttr = title ? `title="${title}"` : '';
  return `<th class="hg-sort-header" data-sort="${column}" data-direction="${defaultDirection}" ${titleAttr}
    style="text-align: ${align}; padding: 4px; cursor: pointer; white-space: nowrap; color: ${color}; background: rgba(0,0,0,0.5);">${label}${arrow}</th>`;
}

function getRowColor(
  p: OverviewPlanet,
  friendAlliances: string[],
  friendPlayers: string[],
  enemyAlliances: string[],
  enemyPlayers: string[]
): string {
  const allyTag = p.alliance_tag && p.alliance_tag !== '???' ? p.alliance_tag.toLowerCase() : '';
  const playerName = p.player_name.toLowerCase();

  if ((allyTag && enemyAlliances.includes(allyTag)) || enemyPlayers.includes(playerName)) {
    return 'background: rgba(244, 67, 54, 0.2);';
  }
  if ((allyTag && friendAlliances.includes(allyTag)) || friendPlayers.includes(playerName)) {
    return 'background: rgba(76, 175, 80, 0.2);';
  }
  return '';
}

function parseNames(str: string): string[] {
  return str.split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  return num.toLocaleString('de-DE');
}

function formatAge(timestamp: string | null): string {
  if (!timestamp) return '-';
  try {
    // Handle different timestamp formats
    // Backend sends timestamps in UTC without timezone suffix
    let dateStr = timestamp;

    // Ensure ISO format with T separator
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
      dateStr = dateStr.replace(' ', 'T');
    }

    // Append Z for UTC if no timezone specified
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      dateStr += 'Z';
    }

    const date = new Date(dateStr);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '-';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle negative diff (future dates)
    if (diffMs < 0) {
      return '-';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return '<1h';
  } catch {
    return '-';
  }
}

function formatDiff(diff: number | null): string {
  if (diff === null || diff === undefined) return '-';
  if (diff === 0) return '0';
  return diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff);
}

function getDiffStyle(diff: number | null): string {
  if (diff === null || diff === undefined || diff === 0) return 'color: #666;';
  return diff > 0 ? 'color: #4caf50;' : 'color: #f44336;';
}

function bindEvents(): void {
  if (!containerElement) return;

  // Smooth scrolling with smaller steps for the table container
  const scrollContainer = document.getElementById('hg-table-container');
  scrollContainer?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scrollAmount = e.deltaY * 0.4; // Reduce scroll speed by 60%
    scrollContainer.scrollTop += scrollAmount;
  }, { passive: false });

  // Search input
  const searchInput = document.getElementById('hg-search-input') as HTMLInputElement;
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderContent();
    // Re-focus the input and restore cursor position
    const newInput = document.getElementById('hg-search-input') as HTMLInputElement;
    if (newInput) {
      newInput.focus();
      newInput.setSelectionRange(searchQuery.length, searchQuery.length);
    }
  });

  // Toggle settings
  const toggleBtn = document.getElementById('hg-toggle-settings');
  toggleBtn?.addEventListener('click', () => {
    settingsVisible = !settingsVisible;
    renderContent();
  });

  // Settings tabs
  containerElement.querySelectorAll('.hg-settings-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      activeSettingsTab = (e.target as HTMLElement).dataset.tab || 'filter';
      renderContent();
    });
  });

  // Filter selects
  ['filterInactive', 'filterVacation', 'filterSpyReport', 'filterBattleReport'].forEach(id => {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    el?.addEventListener('change', () => {
      (settings as Record<string, unknown>)[id] = el.value;
      saveSettings();
      renderContent();
    });
  });

  // Threshold inputs
  ['score', 'scoreBuildings', 'scoreResearch', 'scoreFleet', 'scoreDefense'].forEach(base => {
    const minEl = document.getElementById(`${base}Min`) as HTMLInputElement | null;
    const maxEl = document.getElementById(`${base}Max`) as HTMLInputElement | null;

    minEl?.addEventListener('change', () => {
      (settings as Record<string, unknown>)[`${base}Min`] = minEl.value ? parseInt(minEl.value, 10) : null;
      saveSettings();
      renderContent();
    });

    maxEl?.addEventListener('change', () => {
      (settings as Record<string, unknown>)[`${base}Max`] = maxEl.value ? parseInt(maxEl.value, 10) : null;
      saveSettings();
      renderContent();
    });
  });

  // Friend/Enemy inputs
  ['friendAlliances', 'friendPlayers', 'enemyAlliances', 'enemyPlayers'].forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      (settings as Record<string, unknown>)[id] = el.value;
      saveSettings();
      renderContent();
    });
  });

  // Overlay settings inputs
  ['spyReportLimit', 'battleReportLimit'].forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      const val = parseInt(el.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 50) {
        (settings as Record<string, unknown>)[id] = val;
        saveSettings();
      }
    });
  });

  // Spy probe count setting
  const probeCountEl = document.getElementById('spyProbeCount') as HTMLInputElement | null;
  probeCountEl?.addEventListener('change', () => {
    const val = parseInt(probeCountEl.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 100) {
      settings.spyProbeCount = val;
      saveSettings();
    }
  });

  // Sort headers
  containerElement.querySelectorAll('.hg-sort-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const column = target.dataset.sort || 'coordinates';
      const defaultDir = target.dataset.direction as 'ASC' | 'DESC' || 'ASC';

      if (sortColumn === column) {
        sortDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
      } else {
        sortColumn = column;
        sortDirection = defaultDir;
      }

      renderContent();
    });
  });

  // Save table height on resize
  const tableContainer = document.getElementById('hg-table-container');
  if (tableContainer) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        if (newHeight !== settings.tableHeight && newHeight > 100) {
          settings.tableHeight = newHeight;
          saveSettings();
        }
      }
    });
    resizeObserver.observe(tableContainer);
  }

  // Ajax spy buttons
  containerElement.querySelectorAll('.hg-ajax-spy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const planetId = target.dataset.planetId;
      if (!planetId) return;
      sendAjaxSpy(parseInt(planetId), target);
    });
  });

  // Spy history overlay
  containerElement.querySelectorAll('.hg-spy-history').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const galaxy = target.dataset.galaxy;
      const system = target.dataset.system;
      const planet = target.dataset.planet;
      if (!galaxy || !system || !planet) return;
      showSpyReportHistory(parseInt(galaxy), parseInt(system), parseInt(planet));
    });
  });

  // Battle history overlay
  containerElement.querySelectorAll('.hg-battle-history').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const galaxy = target.dataset.galaxy;
      const system = target.dataset.system;
      const planet = target.dataset.planet;
      if (!galaxy || !system || !planet) return;
      showBattleReportHistory(parseInt(galaxy), parseInt(system), parseInt(planet));
    });
  });
}

function showError(message: string): void {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div class="c" style="margin-bottom: 10px;">${t('hub.overview.title')}</div>
    <div style="text-align: center; padding: 20px; color: #f88;">
      ${t('hub.overview.error')}: ${message}
    </div>
  `;
}

function showSetupForm(): void {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div class="c" style="margin-bottom: 10px;">${t('hub.overview.title')}</div>
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 20px; max-width: 500px; margin: 20px auto;">
      <h3 style="color: #8cf; margin: 0 0 15px 0; text-align: center;">${t('settings.title')}</h3>
      <p style="color: #888; font-size: 12px; margin-bottom: 15px; text-align: center;">
        ${t('settings.apiKeyDescription')}
      </p>
      <div style="margin-bottom: 15px;">
        <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 5px;">${t('settings.apiKey')}</label>
        <input
          type="text"
          id="hg-setup-api-key"
          placeholder="${t('settings.apiKeyPlaceholder')}"
          style="width: 100%; padding: 10px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; font-size: 14px; box-sizing: border-box;"
        />
      </div>
      <div id="hg-setup-status" style="margin-bottom: 15px; display: none; padding: 10px; border-radius: 3px; font-size: 12px;"></div>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="hg-setup-test-btn" style="
          background: #2a4a6a;
          color: #8cf;
          border: 1px solid #4a8aba;
          padding: 10px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 13px;
        ">${t('settings.validate')}</button>
        <button id="hg-setup-save-btn" style="
          background: #4a8aba;
          color: #fff;
          border: 1px solid #4a8aba;
          padding: 10px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 13px;
        ">${t('settings.save')}</button>
      </div>
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #333; text-align: center;">
        <small style="color: #666;">
          ${t('settings.server')}: ${window.HG_HUB.apiUrl}
        </small>
      </div>
    </div>
  `;

  // Bind events for setup form
  bindSetupFormEvents();
}

function bindSetupFormEvents(): void {
  const testBtn = document.getElementById('hg-setup-test-btn');
  const saveBtn = document.getElementById('hg-setup-save-btn');
  const input = document.getElementById('hg-setup-api-key') as HTMLInputElement;

  testBtn?.addEventListener('click', async () => {
    const apiKey = input?.value.trim();
    if (!apiKey) {
      showSetupStatus(t('messages.apiKeyRequired'), 'error');
      return;
    }

    testBtn.textContent = t('settings.validating');
    (testBtn as HTMLButtonElement).disabled = true;

    try {
      const response = await api.validateApiKey(apiKey);
      if (response.ok && response.data) {
        showSetupStatus(t('messages.apiKeyValid'), 'success');
      } else if (response.status === 401) {
        showSetupStatus(t('messages.apiKeyInvalid'), 'error');
      } else {
        showSetupStatus(`${t('messages.serverError')}: ${response.error || response.status}`, 'error');
      }
    } catch (error) {
      showSetupStatus(t('messages.connectionError'), 'error');
    } finally {
      testBtn.textContent = t('settings.validate');
      (testBtn as HTMLButtonElement).disabled = false;
    }
  });

  saveBtn?.addEventListener('click', async () => {
    const apiKey = input?.value.trim();
    if (!apiKey) {
      showSetupStatus(t('messages.apiKeyRequired'), 'error');
      return;
    }

    storage.setApiKey(apiKey);
    showSetupStatus(t('messages.settingsSaved') + ' - ' + t('hub.overview.loading'), 'success');
    updateMenuState();

    // Reload data after short delay
    setTimeout(() => {
      loadData();
    }, 500);
  });
}

function showSetupStatus(message: string, type: 'success' | 'error' | 'info'): void {
  const statusDiv = document.getElementById('hg-setup-status');
  if (!statusDiv) return;

  statusDiv.style.display = 'block';
  statusDiv.textContent = message;

  const styles: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: '#1a4d1a', color: '#5cb85c', border: '#2d662d' },
    error: { bg: '#4d1a1a', color: '#d9534f', border: '#662d2d' },
    info: { bg: '#1a1a4d', color: '#5bc0de', border: '#2d2d66' }
  };

  const style = styles[type];
  statusDiv.style.background = style.bg;
  statusDiv.style.color = style.color;
  statusDiv.style.border = `1px solid ${style.border}`;
}

// ============================================================================
// Ajax Spy Function (like pr0game's .spio-link)
// ============================================================================

// Declare pr0game's showMessage function
declare const showMessage: ((message: string, type: string) => void) | undefined;

async function sendAjaxSpy(planetId: number, buttonEl: HTMLElement): Promise<void> {
  const originalText = buttonEl.textContent;
  buttonEl.textContent = '...';
  buttonEl.style.pointerEvents = 'none';

  try {
    const response = await fetch(`game.php?page=fleetAjax&ajax=1&mission=6&planetID=${planetId}`, {
      credentials: 'same-origin',
    });

    if (response.ok) {
      const data = await response.json();
      // Use pr0game's showMessage if available
      if (typeof showMessage === 'function') {
        showMessage(data.mess || data.message || 'OK', data.code === 600 ? 'success' : 'danger');
      }
      if (data.code === 600 || data.success || data.ok) {
        buttonEl.textContent = '✓';
        buttonEl.style.color = '#4caf50';
      } else {
        buttonEl.textContent = '✗';
        buttonEl.style.color = '#f44336';
        buttonEl.title = data.mess || data.message || 'Fehler';
      }
    } else {
      buttonEl.textContent = '✗';
      buttonEl.style.color = '#f44336';
    }
  } catch (error) {
    buttonEl.textContent = '✗';
    buttonEl.style.color = '#f44336';
    console.error('[HG Hub] Ajax spy error:', error);
  }

  // Reset after 2 seconds
  setTimeout(() => {
    buttonEl.textContent = originalText;
    buttonEl.style.color = '#87ceeb';
    buttonEl.style.pointerEvents = 'auto';
    buttonEl.title = 'Spionieren (Ajax)';
  }, 2000);
}

// ============================================================================
// Overlay Functions
// ============================================================================

interface SpyReportHistoryItem {
  id: number;
  created_at: string;
  reporter_name: string | null;
  resources: Record<string, number> | null;
  buildings: Record<string, number> | null;
  research: Record<string, number> | null;
  fleet: Record<string, number> | null;
  defense: Record<string, number> | null;
}

interface SpyReportHistoryResponse {
  coordinates: string;
  type: string;
  reports: SpyReportHistoryItem[];
}

interface BattleReportHistoryItem {
  id: number;
  report_id: string;
  created_at: string;
  reporter_name: string | null;
  attacker_lost: number;
  defender_lost: number;
  metal: number;
  crystal: number;
  deuterium: number;
  debris_metal: number;
  debris_crystal: number;
}

interface BattleReportHistoryResponse {
  coordinates: string;
  reports: BattleReportHistoryItem[];
}

function closeOverlay(): void {
  document.getElementById('hg-overlay-backdrop')?.remove();
  document.getElementById('hg-overlay')?.remove();
}

function createOverlay(title: string, content: string): void {
  // Remove existing overlay
  closeOverlay();

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'hg-overlay-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 10000;
  `;
  backdrop.addEventListener('click', closeOverlay);
  document.body.appendChild(backdrop);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'hg-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 40px;
    left: 40px;
    right: 40px;
    max-height: calc(100vh - 80px);
    z-index: 10001;
    background: #161618;
    border: 1px solid #4a8aba;
    border-radius: 5px;
    overflow-y: auto;
    padding: 15px;
  `;
  overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #4a8aba; padding-bottom: 10px;">
      <h3 style="margin: 0; color: #8cf;">${title}</h3>
      <button id="hg-overlay-close" style="background: #f44336; color: #fff; border: none; padding: 5px 15px; cursor: pointer; border-radius: 3px;">✕</button>
    </div>
    <div id="hg-overlay-content">${content}</div>
  `;
  document.body.appendChild(overlay);

  // Close button
  document.getElementById('hg-overlay-close')?.addEventListener('click', closeOverlay);

  // Close on ESC
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeOverlay();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

async function showSpyReportHistory(galaxy: number, system: number, planet: number): Promise<void> {
  const histTrans = getTranslations().hub?.overview?.history || {};
  const summaryTrans = getTranslations().hub?.espionageSummary || {};
  createOverlay(`${summaryTrans.historyTitle?.replace('{coords}', `${galaxy}:${system}:${planet}`) || `Spy History: ${galaxy}:${system}:${planet}`}`, `<div style="text-align: center; padding: 20px;">${histTrans.loading || 'Loading...'}</div>`);

  try {
    const response = await api.get<SpyReportHistoryResponse>(`/spy-reports/${galaxy}/${system}/${planet}/history?type=PLANET&lines=${settings.spyReportLimit}`);

    if (!response.ok || !response.data) {
      document.getElementById('hg-overlay-content')!.innerHTML = `<div style="color: #f88; text-align: center;">${t('hub.overview.error')}: ${response.error || 'Unknown error'}</div>`;
      return;
    }

    const data = response.data;
    if (data.reports.length === 0) {
      document.getElementById('hg-overlay-content')!.innerHTML = `<div style="text-align: center; color: #888;">${histTrans.noSpyReports || 'No spy reports found'}</div>`;
      return;
    }

    // Calculate differences between consecutive reports
    const reportDiffs = calculateSpyReportDiffs(data.reports);

    // Build simulation buttons using latest report
    const latestReport = data.reports[0];
    const simButtons = buildSimulationButtons(latestReport);

    // Build summary tables for each category
    let html = simButtons;
    html += '<div style="overflow: auto;">';
    html += buildOverlayCategoryTable('resources', summaryTrans.resources || 'Ressourcen', reportDiffs);
    html += buildOverlayCategoryTable('fleet', summaryTrans.fleet || 'Flotte', reportDiffs);
    html += buildOverlayCategoryTable('defense', summaryTrans.defense || 'Verteidigung', reportDiffs);
    html += buildOverlayCategoryTable('research', summaryTrans.research || 'Forschung', reportDiffs);
    html += buildOverlayCategoryTable('buildings', summaryTrans.buildings || 'Gebaeude', reportDiffs);
    html += '</div>';

    document.getElementById('hg-overlay-content')!.innerHTML = html;
  } catch (err) {
    const errTrans = getTranslations().hub?.overview?.history || {};
    document.getElementById('hg-overlay-content')!.innerHTML = `<div style="color: #f88; text-align: center;">${errTrans.networkError || 'Network error'}</div>`;
  }
}

// Short names for compact display
const OVERLAY_SHORT_NAMES: Record<string, Record<string, string>> = {
  resources: {
    '901': 'Metall',
    '902': 'Kristall',
    '903': 'Deut',
    '904': 'Energie',
  },
  fleet: {
    '202': 'KT',
    '203': 'GT',
    '204': 'LJ',
    '205': 'SJ',
    '206': 'Xer',
    '207': 'SS',
    '208': 'Kolo',
    '209': 'Rec',
    '210': 'Spio',
    '211': 'Bomb',
    '212': 'Sol',
    '213': 'Zer',
    '214': 'Death',
    '215': 'SX',
    '222': 'SchXer',
    '225': 'ST',
    '227': 'ORec',
  },
  defense: {
    '401': 'RW',
    '402': 'LL',
    '403': 'SL',
    '404': 'Gauss',
    '405': 'Ionen',
    '406': 'Plasma',
    '407': 'Kl.S',
    '408': 'Gr.S',
    '502': 'Abfang',
    '503': 'Inter',
  },
  research: {
    '106': 'Spio',
    '108': 'Compu',
    '109': 'Att',
    '110': 'Shield',
    '111': 'Def',
    '113': 'Energie',
    '114': 'HyTech',
    '115': 'Verbr.',
    '117': 'Impuls',
    '118': 'Hyper',
    '120': 'Laser',
    '121': 'Ionen',
    '122': 'Plasma',
    '123': 'Inter',
    '124': 'Astro',
    '131': 'Metall',
    '132': 'Kristall',
    '133': 'Deut',
    '199': 'Gravi',
  },
  buildings: {
    '1': 'Metall',
    '2': 'Kris',
    '3': 'Deut',
    '4': 'Skw',
    '6': 'Labor',
    '12': 'Fusi',
    '14': 'Robo',
    '15': 'Nani',
    '21': 'Werft',
    '22': 'MetS',
    '23': 'KrisS',
    '24': 'DeutS',
    '31': 'Labor',
    '33': 'Ter',
    '34': 'Depo',
    '41': 'Mond',
    '42': 'Phalanx',
    '43': 'Sprung',
    '44': 'Silo',
  },
};

interface OverlayReportDiff {
  age: string;
  reporter: string;
  values: Record<string, number>;
  diffs: Record<string, number>;
}

function calculateSpyReportDiffs(reports: SpyReportHistoryItem[]): OverlayReportDiff[] {
  const result: OverlayReportDiff[] = [];

  for (let i = 0; i < reports.length; i++) {
    const current = reports[i];
    const previous = i < reports.length - 1 ? reports[i + 1] : null;

    const values: Record<string, number> = {};
    const diffs: Record<string, number> = {};

    // Resources
    if (current.resources) {
      for (const [id, val] of Object.entries(current.resources)) {
        values[`res_${id}`] = val;
        if (previous?.resources?.[id] !== undefined) {
          diffs[`res_${id}`] = val - previous.resources[id];
        }
      }
    }

    // Fleet
    if (current.fleet) {
      for (const [id, val] of Object.entries(current.fleet)) {
        values[`fleet_${id}`] = val;
        if (previous?.fleet?.[id] !== undefined) {
          diffs[`fleet_${id}`] = val - previous.fleet[id];
        }
      }
    }

    // Defense
    if (current.defense) {
      for (const [id, val] of Object.entries(current.defense)) {
        values[`def_${id}`] = val;
        if (previous?.defense?.[id] !== undefined) {
          diffs[`def_${id}`] = val - previous.defense[id];
        }
      }
    }

    // Research
    if (current.research) {
      for (const [id, val] of Object.entries(current.research)) {
        values[`tech_${id}`] = val;
        if (previous?.research?.[id] !== undefined) {
          diffs[`tech_${id}`] = val - previous.research[id];
        }
      }
    }

    // Buildings
    if (current.buildings) {
      for (const [id, val] of Object.entries(current.buildings)) {
        values[`bld_${id}`] = val;
        if (previous?.buildings?.[id] !== undefined) {
          diffs[`bld_${id}`] = val - previous.buildings[id];
        }
      }
    }

    result.push({
      age: formatOverlayAge(current.created_at),
      reporter: current.reporter_name || '???',
      values,
      diffs,
    });
  }

  return result;
}

function formatOverlayAge(timestamp: string | null): string {
  if (!timestamp) return '-';
  try {
    let dateStr = timestamp;
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
      dateStr = dateStr.replace(' ', 'T');
    }
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      dateStr += 'Z';
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return '-';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffWeeks > 0) return `${diffWeeks} Wo.`;
    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return '<1h';
  } catch {
    return '-';
  }
}

function getOverlayFullName(category: string, id: string): string {
  const translations = getTranslations();
  const categoryMap: Record<string, string> = {
    resources: 'resources',
    fleet: 'ships',
    defense: 'defense',
    research: 'research',
    buildings: 'buildings',
  };

  const mappedCategory = categoryMap[category] || category;
  return (translations.gameIds?.[mappedCategory] as Record<string, string>)?.[id] || OVERLAY_SHORT_NAMES[category]?.[id] || `ID ${id}`;
}

function formatOverlayDiff(diff: number | null | undefined): string {
  if (diff === null || diff === undefined || diff === 0) return '';
  return diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff);
}

function getOverlayDiffStyle(diff: number | null | undefined): string {
  if (diff === null || diff === undefined || diff === 0) return 'color: #666;';
  return diff > 0 ? 'color: #4caf50;' : 'color: #f44336;';
}

function buildOverlayCategoryTable(category: string, title: string, reportDiffs: OverlayReportDiff[]): string {
  const shortNames = OVERLAY_SHORT_NAMES[category] || {};
  const ids = Object.keys(shortNames);
  const summaryTrans = getTranslations().hub?.espionageSummary || {};

  // Determine prefix based on category
  const prefixMap: Record<string, string> = {
    resources: 'res_',
    fleet: 'fleet_',
    defense: 'def_',
    research: 'tech_',
    buildings: 'bld_',
  };
  const prefix = prefixMap[category] || '';

  // Check if any report has data for this category
  const hasData = reportDiffs.some(r => ids.some(id => r.values[`${prefix}${id}`] !== undefined));
  if (!hasData) return '';

  let html = `
    <table style="border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 15px; background: rgba(0,0,0,0.3);">
      <thead>
        <tr style="background: rgba(74,138,186,0.3);">
          <th colspan="${ids.length + 1}" style="padding: 6px; text-align: left; color: #ff0; font-size: 13px; border-bottom: 1px solid #4a8aba;">
            ${title}
          </th>
        </tr>
        <tr style="background: rgba(0,0,0,0.5);">
          <th style="padding: 4px 8px; text-align: left; color: #8cf; white-space: nowrap; border-right: 1px solid #333;">
            ${summaryTrans.time || 'Zeit'}
          </th>
  `;

  // Header row with short names
  for (const id of ids) {
    const shortName = shortNames[id];
    const fullName = getOverlayFullName(category, id);
    html += `<th style="padding: 4px 6px; text-align: right; color: #aaa; white-space: nowrap;" title="${fullName}">${shortName}</th>`;
  }
  html += '</tr></thead><tbody>';

  // Data rows
  for (const report of reportDiffs) {
    html += `<tr style="border-bottom: 1px solid #222;">`;
    html += `<td style="padding: 4px 8px; text-align: left; white-space: nowrap; border-right: 1px solid #333;">
      <span style="color: #87ceeb;">${report.age}</span>
      <span style="color: #666; font-size: 10px;"> (${report.reporter})</span>
    </td>`;

    for (const id of ids) {
      const key = `${prefix}${id}`;
      const value = report.values[key];
      const diff = report.diffs[key];

      if (value === undefined) {
        html += `<td style="padding: 4px 6px; text-align: right; color: #444;">-</td>`;
      } else {
        const diffStr = formatOverlayDiff(diff);
        const diffStyle = getOverlayDiffStyle(diff);
        html += `<td style="padding: 4px 6px; text-align: right; white-space: nowrap;">
          <span style="color: #ccc;">${formatNumber(value)}</span>
          ${diffStr ? `<span style="${diffStyle}; font-size: 10px; margin-left: 2px;">${diffStr}</span>` : ''}
        </td>`;
      }
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function buildSimulationButtons(report: SpyReportHistoryItem): string {
  // Build URL parameters from spy report data
  const params: string[] = [];

  // Resources (901=metal, 902=crystal, 903=deuterium)
  if (report.resources) {
    for (const [id, value] of Object.entries(report.resources)) {
      if (value > 0) {
        params.push(`im[${id}]=${value}`);
      }
    }
  }

  // Research
  if (report.research) {
    for (const [id, value] of Object.entries(report.research)) {
      if (value > 0) {
        params.push(`im[${id}]=${value}`);
      }
    }
  }

  // Fleet
  if (report.fleet) {
    for (const [id, value] of Object.entries(report.fleet)) {
      if (value > 0) {
        params.push(`im[${id}]=${value}`);
      }
    }
  }

  // Defense
  if (report.defense) {
    for (const [id, value] of Object.entries(report.defense)) {
      if (value > 0) {
        params.push(`im[${id}]=${value}`);
      }
    }
  }

  const paramString = params.join('&');
  const gameSimUrl = `game.php?page=battleSimulator&${paramString}`;
  const trashSimUrl = `https://trashsim.oplanet.eu/?${paramString}`;

  const summaryTrans = getTranslations().hub?.espionageSummary || {};

  return `
    <div style="margin-bottom: 15px; display: flex; gap: 10px; justify-content: center;">
      <a href="${gameSimUrl}" target="_blank" style="
        background: #2a4a6a;
        color: #8cf;
        border: 1px solid #4a8aba;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 3px;
        font-size: 12px;
      ">${summaryTrans.simulate || 'Simulate'}</a>
      <a href="${trashSimUrl}" target="_blank" style="
        background: #2a4a6a;
        color: #8cf;
        border: 1px solid #4a8aba;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 3px;
        font-size: 12px;
      ">${summaryTrans.simulateTrashSim || 'Simulate (TrashSim)'}</a>
    </div>
  `;
}

async function showBattleReportHistory(galaxy: number, system: number, planet: number): Promise<void> {
  const histTrans = getTranslations().hub?.overview?.history || {};
  createOverlay(`${histTrans.battleTitle || 'Battle Report History'}: ${galaxy}:${system}:${planet}`, `<div style="text-align: center; padding: 20px;">${histTrans.loading || 'Loading...'}</div>`);

  try {
    const response = await api.get<BattleReportHistoryResponse>(`/battle-reports/${galaxy}/${system}/${planet}/history?lines=${settings.battleReportLimit}`);

    if (!response.ok || !response.data) {
      document.getElementById('hg-overlay-content')!.innerHTML = `<div style="color: #f88; text-align: center;">${t('hub.overview.error')}: ${response.error || 'Unknown error'}</div>`;
      return;
    }

    const data = response.data;
    if (data.reports.length === 0) {
      document.getElementById('hg-overlay-content')!.innerHTML = `<div style="text-align: center; color: #888;">${histTrans.noBattleReports || 'No battle reports found'}</div>`;
      return;
    }

    // Build table
    let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    html += '<thead><tr style="background: rgba(0,0,0,0.5);">';
    html += `<th style="padding: 6px; text-align: left;">${histTrans.time || 'Time'}</th>`;
    html += `<th style="padding: 6px; text-align: left;">${histTrans.reporter || 'Reporter'}</th>`;
    html += `<th style="padding: 6px; text-align: right;">${histTrans.attackerLoss || 'Attacker Loss'}</th>`;
    html += `<th style="padding: 6px; text-align: right;">${histTrans.defenderLoss || 'Defender Loss'}</th>`;
    html += `<th style="padding: 6px; text-align: right;">${histTrans.loot || 'Loot'}</th>`;
    html += `<th style="padding: 6px; text-align: right;">${histTrans.debris || 'DF'}</th>`;
    html += '</tr></thead><tbody>';

    for (const report of data.reports) {
      const loot = report.metal + report.crystal + report.deuterium;
      const tf = report.debris_metal + report.debris_crystal;

      html += '<tr style="border-bottom: 1px solid #333;">';
      html += `<td style="padding: 6px; color: #ff7043;" title="${report.created_at}">${formatAge(report.created_at)}</td>`;
      html += `<td style="padding: 6px;">${report.reporter_name ?? '???'}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #f44336;">${formatNumber(report.attacker_lost)}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #f44336;">${formatNumber(report.defender_lost)}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #4caf50;">${formatNumber(loot)}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #9c27b0;">${formatNumber(tf)}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table>';

    document.getElementById('hg-overlay-content')!.innerHTML = html;
  } catch (err) {
    document.getElementById('hg-overlay-content')!.innerHTML = `<div style="color: #f88; text-align: center;">${histTrans.networkError || 'Network error'}</div>`;
  }
}
