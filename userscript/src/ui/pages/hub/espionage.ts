/**
 * Espionage Overview Page - Shows hostile spying aggregated by attacker
 * and spy report summary for specific coordinates
 */

import { api } from '../../../api/client';
import { t, getTranslations } from '../../../locales';
import { storage } from '../../../utils/storage';

const CONTENT_ID = 'hg-hub-espionage';
const SETTINGS_KEY = 'hg-hub-espionage-settings';
const SUMMARY_SETTINGS_KEY = 'hg-hub-espionage-summary-settings';

interface EspionageOverviewItem {
  attacker_coordinates: string;
  attacker_name: string | null;
  attacker_alliance_tag: string | null;
  spy_count: number;
  last_spy_time: string | null;
  targets: string[];
}

interface EspionageOverviewResponse {
  data: EspionageOverviewItem[];
  page: number;
  total_pages: number;
}

interface EspionageSettings {
  attackerFilter: string;
  targetFilter: string;
  timeFrom: string;
  timeTo: string;
  tableHeight: number;
}

const defaultSettings: EspionageSettings = {
  attackerFilter: '',
  targetFilter: '',
  timeFrom: '',
  timeTo: '',
  tableHeight: 400,
};

// Summary tab interfaces
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

interface SummarySettings {
  coordinates: string;
  rowLimit: number;
  tableHeight: number;
}

const defaultSummarySettings: SummarySettings = {
  coordinates: '',
  rowLimit: 10,
  tableHeight: 500,
};

// Short names for display in compact table
const SHORT_NAMES: Record<string, Record<string, string>> = {
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

// State
let cachedData: EspionageOverviewItem[] = [];
let settings: EspionageSettings = { ...defaultSettings };
let sortColumn = 'last_spy_time';
let sortDirection: 'ASC' | 'DESC' = 'DESC';
let containerElement: HTMLElement | null = null;
let currentPage = 1;
let totalPages = 1;
let settingsVisible = false;

// Tab state
let activeTab: 'hostile' | 'summary' = 'hostile';

// Summary tab state
let summarySettings: SummarySettings = { ...defaultSummarySettings };
let cachedSummaryReports: SpyReportHistoryItem[] = [];
let currentSummaryCoordinates = '';

/**
 * Initialize and render the espionage overview page
 */
export function renderEspionagePage(): void {
  const contentArea = document.getElementById('content') || document.querySelector('content');
  if (!contentArea) {
    console.error('[HG Hub] Content area not found');
    return;
  }

  // Clear existing content
  contentArea.innerHTML = '';

  // Load settings from localStorage
  loadSettings();
  loadSummarySettings();

  // Create container
  const container = document.createElement('div');
  container.id = CONTENT_ID;
  container.style.cssText = 'padding: 10px;';
  contentArea.appendChild(container);
  containerElement = container;

  // Render with tabs
  renderPageWithTabs();
}

function renderPageWithTabs(): void {
  if (!containerElement) return;

  const tabsHtml = `
    <div style="margin-bottom: 15px;">
      <button class="hg-espionage-tab" data-tab="hostile" style="
        background: ${activeTab === 'hostile' ? '#4a8aba' : '#2a4a6a'};
        color: ${activeTab === 'hostile' ? '#fff' : '#8cf'};
        border: 1px solid #4a8aba;
        padding: 8px 20px;
        cursor: pointer;
        border-radius: 3px 3px 0 0;
        margin-right: 2px;
        font-size: 13px;
      ">${t('hub.espionage.tabs.hostile')}</button>
      <button class="hg-espionage-tab" data-tab="summary" style="
        background: ${activeTab === 'summary' ? '#4a8aba' : '#2a4a6a'};
        color: ${activeTab === 'summary' ? '#fff' : '#8cf'};
        border: 1px solid #4a8aba;
        padding: 8px 20px;
        cursor: pointer;
        border-radius: 3px 3px 0 0;
        margin-right: 2px;
        font-size: 13px;
      ">${t('hub.espionage.tabs.summary')}</button>
    </div>
    <div id="hg-espionage-tab-content">
      <div style="text-align: center; padding: 20px;">${t('hub.overview.loading')}</div>
    </div>
  `;

  containerElement.innerHTML = tabsHtml;

  // Bind tab events
  containerElement.querySelectorAll('.hg-espionage-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabName = target.dataset.tab as 'hostile' | 'summary';
      if (tabName && tabName !== activeTab) {
        activeTab = tabName;
        renderPageWithTabs();
      }
    });
  });

  // Load content based on active tab
  if (activeTab === 'hostile') {
    loadData();
  } else {
    renderSummaryTab();
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

async function loadData(): Promise<void> {
  if (!containerElement) return;

  if (!storage.isConfigured()) {
    showError(t('messages.apiKeyRequired'));
    return;
  }

  try {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    if (settings.attackerFilter) params.set('attacker', settings.attackerFilter);
    if (settings.targetFilter) params.set('target', settings.targetFilter);
    if (settings.timeFrom) params.set('time_from', settings.timeFrom);
    if (settings.timeTo) params.set('time_to', settings.timeTo);

    const response = await api.get<EspionageOverviewResponse>(`/hostile-spying/overview?${params.toString()}`);

    if (response.ok && response.data) {
      cachedData = response.data.data;
      currentPage = response.data.page;
      totalPages = response.data.total_pages;
      renderContent();
    } else if (response.status === 401) {
      showError(t('messages.apiKeyInvalid'));
    } else {
      showError(response.error || 'Failed to load data');
    }
  } catch (error) {
    showError(String(error));
  }
}

function renderContent(): void {
  const tabContent = document.getElementById('hg-espionage-tab-content');
  if (!tabContent) return;

  const sortedData = sortData([...cachedData]);
  const table = buildTable(sortedData);
  const settingsPanel = buildSettingsPanel();
  const pagination = buildPagination();

  tabContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="font-size: 12px; color: #888;">
        ${t('hub.overview.count')}: ${sortedData.length}
      </span>
      <button id="hg-toggle-settings" style="
        background: ${settingsVisible ? '#4a8aba' : '#2a4a6a'};
        color: ${settingsVisible ? '#fff' : '#8cf'};
        border: 1px solid #4a8aba;
        padding: 6px 12px;
        cursor: pointer;
        border-radius: 3px;
        font-size: 12px;
      ">
        ${t('hub.overview.settings')}
      </button>
    </div>
    ${settingsPanel}
    <div id="hg-table-container" style="
      overflow: auto;
      height: ${settings.tableHeight}px;
      border: 1px solid #4a8aba;
      border-radius: 3px;
      resize: vertical;
    ">
      ${table}
    </div>
    ${pagination}
  `;

  bindEvents();
}

function buildSettingsPanel(): string {
  if (!settingsVisible) return '';

  return `
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; margin-bottom: 15px; padding: 15px;">
      <div style="font-weight: bold; margin-bottom: 10px; color: #8cf;">${t('hub.espionage.filter.title')}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px;">
        <div>
          <label style="display: block; margin-bottom: 5px; color: #aaa;">${t('hub.espionage.filter.attacker')}</label>
          <input type="text" id="hg-filter-attacker" value="${settings.attackerFilter}" placeholder="${t('hub.espionage.filter.attackerPlaceholder')}"
            style="width: 100%; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 5px; color: #aaa;">${t('hub.espionage.filter.target')}</label>
          <input type="text" id="hg-filter-target" value="${settings.targetFilter}" placeholder="${t('hub.espionage.filter.targetPlaceholder')}"
            style="width: 100%; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 5px; color: #aaa;">${t('hub.espionage.filter.timeFrom')}</label>
          <input type="datetime-local" id="hg-filter-time-from" value="${settings.timeFrom}"
            style="width: 100%; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 5px; color: #aaa;">${t('hub.espionage.filter.timeTo')}</label>
          <input type="datetime-local" id="hg-filter-time-to" value="${settings.timeTo}"
            style="width: 100%; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; box-sizing: border-box;">
        </div>
      </div>
      <div style="margin-top: 15px; display: flex; gap: 10px;">
        <button id="hg-apply-filter" style="
          background: #4a8aba;
          color: #fff;
          border: 1px solid #4a8aba;
          padding: 8px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 12px;
        ">${t('hub.espionage.filter.apply')}</button>
        <button id="hg-reset-filter" style="
          background: #2a4a6a;
          color: #8cf;
          border: 1px solid #4a8aba;
          padding: 8px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 12px;
        ">${t('hub.espionage.filter.reset')}</button>
      </div>
    </div>
  `;
}

function buildPagination(): string {
  if (totalPages <= 1) return '';

  return `
    <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 15px;">
      <button id="hg-page-prev" ${currentPage <= 1 ? 'disabled' : ''} style="
        background: ${currentPage <= 1 ? '#333' : '#2a4a6a'};
        color: ${currentPage <= 1 ? '#666' : '#8cf'};
        border: 1px solid #4a8aba;
        padding: 6px 12px;
        cursor: ${currentPage <= 1 ? 'not-allowed' : 'pointer'};
        border-radius: 3px;
        font-size: 12px;
      ">&lt;</button>
      <span style="color: #888; font-size: 12px;">${currentPage} / ${totalPages}</span>
      <button id="hg-page-next" ${currentPage >= totalPages ? 'disabled' : ''} style="
        background: ${currentPage >= totalPages ? '#333' : '#2a4a6a'};
        color: ${currentPage >= totalPages ? '#666' : '#8cf'};
        border: 1px solid #4a8aba;
        padding: 6px 12px;
        cursor: ${currentPage >= totalPages ? 'not-allowed' : 'pointer'};
        border-radius: 3px;
        font-size: 12px;
      ">&gt;</button>
    </div>
  `;
}

function sortData(data: EspionageOverviewItem[]): EspionageOverviewItem[] {
  const multiplier = sortDirection === 'ASC' ? 1 : -1;

  return data.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortColumn) {
      case 'attacker_name':
        aVal = (a.attacker_name ?? a.attacker_coordinates).toLowerCase();
        bVal = (b.attacker_name ?? b.attacker_coordinates).toLowerCase();
        break;
      case 'attacker_alliance_tag':
        aVal = (a.attacker_alliance_tag ?? '').toLowerCase();
        bVal = (b.attacker_alliance_tag ?? '').toLowerCase();
        break;
      case 'spy_count':
        aVal = a.spy_count;
        bVal = b.spy_count;
        break;
      case 'last_spy_time':
        aVal = a.last_spy_time ?? '';
        bVal = b.last_spy_time ?? '';
        break;
      case 'targets':
        aVal = a.targets.length;
        bVal = b.targets.length;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

function buildTable(data: EspionageOverviewItem[]): string {
  let html = '<table style="border-collapse: collapse; width: 100%; font-size: 12px;">';

  // Header row
  html += '<thead><tr style="background: rgba(0,0,0,0.5); position: sticky; top: 0; z-index: 1;">';
  html += buildSortHeader('attacker_name', t('hub.espionage.table.attacker'), 'ASC', 'left');
  html += buildSortHeader('spy_count', t('hub.espionage.table.count'), 'DESC', 'center');
  html += buildSortHeader('last_spy_time', t('hub.espionage.table.lastSpy'), 'DESC', 'center');
  html += buildSortHeader('targets', t('hub.espionage.table.targets'), 'DESC', 'left');
  html += '</tr></thead>';

  // Data rows
  html += '<tbody>';
  if (data.length === 0) {
    html += `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #888;">${t('hub.espionage.noData')}</td></tr>`;
  } else {
    data.forEach((item) => {
      // Filter out "???" alliance tags - show nothing instead
      const allyTag = item.attacker_alliance_tag && item.attacker_alliance_tag !== '???' ? item.attacker_alliance_tag : null;
      const displayName = item.attacker_name
        ? (allyTag
          ? `${item.attacker_name} [${allyTag}]`
          : item.attacker_name)
        : item.attacker_coordinates;

      const targetsDisplay = item.targets.slice(0, 5).join(', ') + (item.targets.length > 5 ? `, +${item.targets.length - 5}` : '');

      html += '<tr style="border-bottom: 1px solid #333;">';
      html += `<td style="padding: 8px; text-align: left;">
        <div style="font-weight: bold; color: #f44;">${displayName}</div>
        <div style="font-size: 11px; color: #888;">${item.attacker_coordinates}</div>
      </td>`;
      html += `<td style="padding: 8px; text-align: center; font-weight: bold; color: #ff9800;">${item.spy_count}</td>`;
      html += `<td style="padding: 8px; text-align: center; color: #87ceeb;">${formatAge(item.last_spy_time)}</td>`;
      html += `<td style="padding: 8px; text-align: left; color: #aaa; font-size: 11px;" title="${item.targets.join(', ')}">${targetsDisplay}</td>`;
      html += '</tr>';
    });
  }
  html += '</tbody>';

  html += '</table>';
  return html;
}

function buildSortHeader(
  column: string,
  label: string,
  defaultDirection: 'ASC' | 'DESC',
  align: string
): string {
  const isActive = sortColumn === column;
  const arrow = isActive ? (sortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
  return `<th class="hg-sort-header" data-sort="${column}" data-direction="${defaultDirection}"
    style="text-align: ${align}; padding: 8px; cursor: pointer; white-space: nowrap; color: #8cf; background: rgba(0,0,0,0.5);">${label}${arrow}</th>`;
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

    if (diffDays > 0) return `${t('hub.espionage.time.daysAgo').replace('{n}', String(diffDays))}`;
    if (diffHours > 0) return `${t('hub.espionage.time.hoursAgo').replace('{n}', String(diffHours))}`;
    return t('hub.espionage.time.recent');
  } catch {
    return '-';
  }
}

function bindEvents(): void {
  if (!containerElement) return;

  // Toggle settings
  const toggleBtn = document.getElementById('hg-toggle-settings');
  toggleBtn?.addEventListener('click', () => {
    settingsVisible = !settingsVisible;
    renderContent();
  });

  // Apply filter
  const applyBtn = document.getElementById('hg-apply-filter');
  applyBtn?.addEventListener('click', () => {
    const attackerInput = document.getElementById('hg-filter-attacker') as HTMLInputElement;
    const targetInput = document.getElementById('hg-filter-target') as HTMLInputElement;
    const timeFromInput = document.getElementById('hg-filter-time-from') as HTMLInputElement;
    const timeToInput = document.getElementById('hg-filter-time-to') as HTMLInputElement;

    settings.attackerFilter = attackerInput?.value || '';
    settings.targetFilter = targetInput?.value || '';
    settings.timeFrom = timeFromInput?.value || '';
    settings.timeTo = timeToInput?.value || '';

    saveSettings();
    currentPage = 1;
    loadData();
  });

  // Reset filter
  const resetBtn = document.getElementById('hg-reset-filter');
  resetBtn?.addEventListener('click', () => {
    settings = { ...defaultSettings };
    saveSettings();
    currentPage = 1;
    loadData();
  });

  // Sort headers
  containerElement.querySelectorAll('.hg-sort-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const column = target.dataset.sort || 'last_spy_time';
      const defaultDir = target.dataset.direction as 'ASC' | 'DESC' || 'DESC';

      if (sortColumn === column) {
        sortDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
      } else {
        sortColumn = column;
        sortDirection = defaultDir;
      }

      renderContent();
    });
  });

  // Pagination
  const prevBtn = document.getElementById('hg-page-prev');
  prevBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadData();
    }
  });

  const nextBtn = document.getElementById('hg-page-next');
  nextBtn?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadData();
    }
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
}

function showError(message: string): void {
  const tabContent = document.getElementById('hg-espionage-tab-content');
  if (!tabContent) return;

  tabContent.innerHTML = `
    <div style="text-align: center; padding: 20px; color: #f88;">
      ${t('hub.overview.error')}: ${message}
    </div>
  `;
}

// ============================================================================
// Summary Tab Functions
// ============================================================================

function loadSummarySettings(): void {
  try {
    const saved = localStorage.getItem(SUMMARY_SETTINGS_KEY);
    if (saved) {
      summarySettings = { ...defaultSummarySettings, ...JSON.parse(saved) };
    }
  } catch {
    summarySettings = { ...defaultSummarySettings };
  }
}

function saveSummarySettings(): void {
  localStorage.setItem(SUMMARY_SETTINGS_KEY, JSON.stringify(summarySettings));
}

function renderSummaryTab(): void {
  const tabContent = document.getElementById('hg-espionage-tab-content');
  if (!tabContent) return;

  tabContent.innerHTML = `
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
      <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="color: #8cf; font-size: 13px;">${t('hub.espionageSummary.coordinates')}:</label>
          <input type="text" id="hg-summary-coords" placeholder="G:SSS:P" value="${summarySettings.coordinates}"
            style="width: 100px; padding: 6px 10px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; font-size: 13px;">
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="color: #8cf; font-size: 13px;">${t('hub.espionageSummary.rows')}:</label>
          <select id="hg-summary-rows" style="padding: 6px 10px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px;">
            <option value="5" ${summarySettings.rowLimit === 5 ? 'selected' : ''}>5</option>
            <option value="10" ${summarySettings.rowLimit === 10 ? 'selected' : ''}>10</option>
            <option value="20" ${summarySettings.rowLimit === 20 ? 'selected' : ''}>20</option>
            <option value="50" ${summarySettings.rowLimit === 50 ? 'selected' : ''}>50</option>
          </select>
        </div>
        <button id="hg-summary-load" style="
          background: #4a8aba;
          color: #fff;
          border: 1px solid #4a8aba;
          padding: 6px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 13px;
        ">${t('hub.espionageSummary.load')}</button>
      </div>
    </div>
    <div id="hg-summary-content"></div>
  `;

  bindSummaryEvents();

  // If we have saved coordinates, load them automatically
  if (summarySettings.coordinates) {
    void loadSummaryData(summarySettings.coordinates);
  }
}

function bindSummaryEvents(): void {
  const loadBtn = document.getElementById('hg-summary-load');
  const coordsInput = document.getElementById('hg-summary-coords') as HTMLInputElement;
  const rowsSelect = document.getElementById('hg-summary-rows') as HTMLSelectElement;

  loadBtn?.addEventListener('click', () => {
    const coords = coordsInput?.value.trim() || '';
    if (!coords) {
      showSummaryError(t('hub.espionageSummary.errorCoords'));
      return;
    }
    summarySettings.coordinates = coords;
    summarySettings.rowLimit = parseInt(rowsSelect?.value || '10', 10);
    saveSummarySettings();
    void loadSummaryData(coords);
  });

  coordsInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadBtn?.click();
    }
  });

  rowsSelect?.addEventListener('change', () => {
    summarySettings.rowLimit = parseInt(rowsSelect.value, 10);
    saveSummarySettings();
    if (currentSummaryCoordinates) {
      void loadSummaryData(currentSummaryCoordinates);
    }
  });
}

async function loadSummaryData(coordinates: string): Promise<void> {
  const contentDiv = document.getElementById('hg-summary-content');
  if (!contentDiv) return;

  if (!storage.isConfigured()) {
    showSummaryError(t('messages.apiKeyRequired'));
    return;
  }

  // Parse coordinates
  const match = coordinates.match(/^(\d+):(\d+):(\d+)$/);
  if (!match) {
    showSummaryError(t('hub.espionageSummary.errorCoords'));
    return;
  }

  const [, galaxy, system, planet] = match;
  currentSummaryCoordinates = coordinates;

  contentDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">${t('hub.overview.loading')}</div>`;

  try {
    const response = await api.get<SpyReportHistoryResponse>(
      `/spy-reports/${galaxy}/${system}/${planet}/history?type=PLANET&lines=${summarySettings.rowLimit}`
    );

    if (response.ok && response.data) {
      cachedSummaryReports = response.data.reports;
      renderSummaryTable(coordinates);
    } else if (response.status === 401) {
      showSummaryError(t('messages.apiKeyInvalid'));
    } else {
      showSummaryError(response.error || 'Failed to load data');
    }
  } catch (error) {
    showSummaryError(String(error));
  }
}

interface ReportDiff {
  time: string;
  age: string;
  reporter: string;
  values: Record<string, number>;
  diffs: Record<string, number>;
}

function calculateDifferences(reports: SpyReportHistoryItem[]): ReportDiff[] {
  const result: ReportDiff[] = [];

  for (let i = 0; i < reports.length; i++) {
    const current = reports[i];
    const previous = i < reports.length - 1 ? reports[i + 1] : null;

    const values: Record<string, number> = {};
    const diffs: Record<string, number> = {};

    // Add resources with 'res_' prefix
    if (current.resources) {
      for (const [id, val] of Object.entries(current.resources)) {
        values[`res_${id}`] = val;
        if (previous?.resources?.[id] !== undefined) {
          diffs[`res_${id}`] = val - previous.resources[id];
        }
      }
    }

    // Add fleet with 'fleet_' prefix
    if (current.fleet) {
      for (const [id, val] of Object.entries(current.fleet)) {
        values[`fleet_${id}`] = val;
        if (previous?.fleet?.[id] !== undefined) {
          diffs[`fleet_${id}`] = val - previous.fleet[id];
        }
      }
    }

    // Add defense with 'def_' prefix
    if (current.defense) {
      for (const [id, val] of Object.entries(current.defense)) {
        values[`def_${id}`] = val;
        if (previous?.defense?.[id] !== undefined) {
          diffs[`def_${id}`] = val - previous.defense[id];
        }
      }
    }

    // Add research with 'tech_' prefix
    if (current.research) {
      for (const [id, val] of Object.entries(current.research)) {
        values[`tech_${id}`] = val;
        if (previous?.research?.[id] !== undefined) {
          diffs[`tech_${id}`] = val - previous.research[id];
        }
      }
    }

    // Add buildings with 'bld_' prefix
    if (current.buildings) {
      for (const [id, val] of Object.entries(current.buildings)) {
        values[`bld_${id}`] = val;
        if (previous?.buildings?.[id] !== undefined) {
          diffs[`bld_${id}`] = val - previous.buildings[id];
        }
      }
    }

    result.push({
      time: current.created_at,
      age: formatSummaryAge(current.created_at),
      reporter: current.reporter_name || '???',
      values,
      diffs,
    });
  }

  return result;
}

function renderSummaryTable(coordinates: string): void {
  const contentDiv = document.getElementById('hg-summary-content');
  if (!contentDiv) return;

  if (cachedSummaryReports.length === 0) {
    contentDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">${t('hub.espionageSummary.noData')}</div>`;
    return;
  }

  // Calculate differences between consecutive reports
  const reportDiffs = calculateDifferences(cachedSummaryReports);

  // Build the summary table
  let html = `
    <div style="margin-bottom: 10px; color: #8cf; font-size: 14px;">
      ${t('hub.espionageSummary.historyTitle').replace('{coords}', coordinates)}
    </div>
    <div id="hg-summary-table-container" style="
      overflow: auto;
      max-height: ${summarySettings.tableHeight}px;
      border: 1px solid #4a8aba;
      border-radius: 3px;
      resize: vertical;
    ">
  `;

  // Build separate tables for each category
  html += buildSummaryCategoryTable('resources', t('hub.espionageSummary.resources'), reportDiffs);
  html += buildSummaryCategoryTable('fleet', t('hub.espionageSummary.fleet'), reportDiffs);
  html += buildSummaryCategoryTable('defense', t('hub.espionageSummary.defense'), reportDiffs);
  html += buildSummaryCategoryTable('research', t('hub.espionageSummary.research'), reportDiffs);
  html += buildSummaryCategoryTable('buildings', t('hub.espionageSummary.buildings'), reportDiffs);

  html += '</div>';
  contentDiv.innerHTML = html;

  // Save table height on resize
  const tableContainer = document.getElementById('hg-summary-table-container');
  if (tableContainer) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        if (newHeight !== summarySettings.tableHeight && newHeight > 100) {
          summarySettings.tableHeight = newHeight;
          saveSummarySettings();
        }
      }
    });
    resizeObserver.observe(tableContainer);
  }
}

function getFullName(category: string, id: string): string {
  const translations = getTranslations();
  const categoryMap: Record<string, string> = {
    resources: 'resources',
    fleet: 'ships',
    defense: 'defense',
    research: 'research',
    buildings: 'buildings',
  };

  const mappedCategory = categoryMap[category] || category;
  return (translations.gameIds?.[mappedCategory] as Record<string, string>)?.[id] || SHORT_NAMES[category]?.[id] || `ID ${id}`;
}

function buildSummaryCategoryTable(category: string, title: string, reportDiffs: ReportDiff[]): string {
  const shortNames = SHORT_NAMES[category] || {};
  const ids = Object.keys(shortNames);

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
            ${t('hub.espionageSummary.time')}
          </th>
  `;

  // Header row with short names
  for (const id of ids) {
    const shortName = shortNames[id];
    const fullName = getFullName(category, id);
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
        const diffStr = formatSummaryDiff(diff);
        const diffStyle = getSummaryDiffStyle(diff);
        html += `<td style="padding: 4px 6px; text-align: right; white-space: nowrap;">
          <span style="color: #ccc;">${formatSummaryNumber(value)}</span>
          ${diffStr ? `<span style="${diffStyle}; font-size: 10px; margin-left: 2px;">${diffStr}</span>` : ''}
        </td>`;
      }
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function formatSummaryAge(timestamp: string | null): string {
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
    if (diffDays > 0) return `${diffDays} Tag${diffDays > 1 ? 'e' : ''}`;
    if (diffHours > 0) return `${diffHours} Std.`;
    return '<1 Std.';
  } catch {
    return '-';
  }
}

function formatSummaryNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('de-DE');
}

function formatSummaryDiff(diff: number | null | undefined): string {
  if (diff === null || diff === undefined || diff === 0) return '';
  return diff > 0 ? `+${formatSummaryNumber(diff)}` : formatSummaryNumber(diff);
}

function getSummaryDiffStyle(diff: number | null | undefined): string {
  if (diff === null || diff === undefined || diff === 0) return 'color: #666;';
  return diff > 0 ? 'color: #4caf50;' : 'color: #f44336;';
}

function showSummaryError(message: string): void {
  const contentDiv = document.getElementById('hg-summary-content');
  if (!contentDiv) return;

  contentDiv.innerHTML = `
    <div style="text-align: center; padding: 20px; color: #f88;">
      ${t('hub.overview.error')}: ${message}
    </div>
  `;
}
