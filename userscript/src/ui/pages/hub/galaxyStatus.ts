/**
 * Galaxy Status page - Shows scan freshness for all systems
 */

import { api } from '../../../api/client';
import { t } from '../../../locales';

const CONTENT_ID = 'hg-hub-galaxy-status';

interface GalaxySystemInfo {
  galaxy: number;
  system: number;
  last_scan_at: string | null;
  age_hours: number | null;
}

interface GalaxyStatusResponse {
  systems: GalaxySystemInfo[];
}

interface ConfigResponse {
  galaxies: number;
  systems: number;
}

// Cache the data
let cachedData: GalaxySystemInfo[] = [];
let selectedGalaxy = 1;
let totalGalaxies = 9;
let systemsPerGalaxy = 499;

/**
 * Render the Galaxy Status page
 */
export async function renderGalaxyStatusPage(): Promise<void> {
  const contentArea = document.getElementById('content') || document.querySelector('content');
  if (!contentArea) {
    console.error('[HG Hub] Content area not found');
    return;
  }

  // Show loading state
  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 20px;">
      <table width="100%">
        <tr>
          <td class="c" colspan="2">${t('hub.galaxyStatus.title')}</td>
        </tr>
        <tr>
          <th colspan="2" style="padding: 15px; text-align: center;">
            ${t('hub.galaxyStatus.loading')}
          </th>
        </tr>
      </table>
    </div>
  `;

  // Fetch config and data in parallel
  try {
    const [configResponse, dataResponse] = await Promise.all([
      api.get<ConfigResponse>('/hub/config'),
      api.get<GalaxyStatusResponse>('/hub/galaxy'),
    ]);

    if (configResponse.ok && configResponse.data) {
      totalGalaxies = configResponse.data.galaxies;
      systemsPerGalaxy = configResponse.data.systems;
    }

    if (dataResponse.ok && dataResponse.data) {
      cachedData = dataResponse.data.systems;
      renderPage(contentArea);
    } else {
      showError(contentArea, dataResponse.error || 'Failed to load data');
    }
  } catch (error) {
    showError(contentArea, String(error));
  }
}

function renderPage(contentArea: Element): void {
  // Build galaxy tabs
  const tabs = buildGalaxyTabs();

  // Build system grid for selected galaxy
  const grid = buildSystemGrid();

  // Build legend
  const legend = buildLegend();

  // Build statistics
  const stats = buildStatistics();

  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 20px;">
      <table width="100%">
        <tr>
          <td class="c" colspan="2">${t('hub.galaxyStatus.title')}</td>
        </tr>
        <tr>
          <th colspan="2" style="padding: 15px;">
            <div style="margin-bottom: 15px;">
              ${tabs}
            </div>
            <div style="margin-bottom: 15px;">
              ${legend}
            </div>
            <div style="margin-bottom: 15px;">
              ${stats}
            </div>
            <div style="overflow-x: auto;">
              ${grid}
            </div>
          </th>
        </tr>
      </table>
    </div>
  `;

  bindEvents(contentArea);
}

function buildGalaxyTabs(): string {
  const tabs: string[] = [];
  for (let g = 1; g <= totalGalaxies; g++) {
    const isActive = g === selectedGalaxy;
    const style = isActive
      ? 'background: #4a8aba; color: #fff; border: 1px solid #6ab; padding: 8px 16px; margin: 2px; cursor: pointer; border-radius: 3px;'
      : 'background: #2a4a6a; color: #8cf; border: 1px solid #4a8aba; padding: 8px 16px; margin: 2px; cursor: pointer; border-radius: 3px;';
    tabs.push(`<button class="hg-galaxy-tab" data-galaxy="${g}" style="${style}">${t('hub.galaxyStatus.galaxy')} ${g}</button>`);
  }
  return `<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 5px;">${tabs.join('')}</div>`;
}

function buildLegend(): string {
  const items = [
    { color: '#4a4a4a', label: t('hub.galaxyStatus.notScanned') },
    { color: '#c62828', label: t('hub.galaxyStatus.veryOld') },
    { color: '#ef6c00', label: t('hub.galaxyStatus.old') },
    { color: '#fbc02d', label: t('hub.galaxyStatus.medium') },
    { color: '#388e3c', label: t('hub.galaxyStatus.fresh') },
  ];

  const legendItems = items.map(item =>
    `<span style="display: inline-flex; align-items: center; margin-right: 15px;">
      <span style="display: inline-block; width: 16px; height: 16px; background: ${item.color}; margin-right: 5px; border-radius: 2px;"></span>
      ${item.label}
    </span>`
  ).join('');

  return `<div style="font-size: 12px; color: #aaa;">${legendItems}</div>`;
}

function buildStatistics(): string {
  const galaxySystems = cachedData.filter(s => s.galaxy === selectedGalaxy);
  const scanned = galaxySystems.length;
  const fresh = galaxySystems.filter(s => s.age_hours !== null && s.age_hours < 24).length;
  const medium = galaxySystems.filter(s => s.age_hours !== null && s.age_hours >= 24 && s.age_hours < 72).length;
  const old = galaxySystems.filter(s => s.age_hours !== null && s.age_hours >= 72 && s.age_hours < 168).length;
  const veryOld = galaxySystems.filter(s => s.age_hours !== null && s.age_hours >= 168).length;
  const notScanned = systemsPerGalaxy - scanned;

  const percent = (n: number) => ((n / systemsPerGalaxy) * 100).toFixed(1);

  return `
    <div style="font-size: 12px; color: #aaa; display: flex; flex-wrap: wrap; gap: 15px; justify-content: center;">
      <span>${t('hub.galaxyStatus.total')}: ${scanned}/${systemsPerGalaxy} (${percent(scanned)}%)</span>
      <span style="color: #388e3c;">● ${t('hub.galaxyStatus.freshCount')}: ${fresh}</span>
      <span style="color: #fbc02d;">● ${t('hub.galaxyStatus.mediumCount')}: ${medium}</span>
      <span style="color: #ef6c00;">● ${t('hub.galaxyStatus.oldCount')}: ${old}</span>
      <span style="color: #c62828;">● ${t('hub.galaxyStatus.veryOldCount')}: ${veryOld}</span>
      <span style="color: #4a4a4a;">● ${t('hub.galaxyStatus.notScannedCount')}: ${notScanned}</span>
    </div>
  `;
}

function buildSystemGrid(): string {
  // Create a map for quick lookup
  const systemMap = new Map<number, GalaxySystemInfo>();
  cachedData.filter(s => s.galaxy === selectedGalaxy).forEach(s => {
    systemMap.set(s.system, s);
  });

  // Calculate grid dimensions based on system count
  const COLS = Math.min(50, systemsPerGalaxy);
  const ROWS = Math.ceil(systemsPerGalaxy / COLS);

  let html = '<table style="border-collapse: collapse; width: 100%;">';

  // Header row with column numbers (every 10th)
  html += '<tr><td style="width: 30px;"></td>';
  for (let c = 1; c <= COLS; c++) {
    if (c % 10 === 0 || c === 1) {
      html += `<td style="font-size: 9px; color: #666; text-align: center; padding: 2px;">${c}</td>`;
    } else {
      html += '<td></td>';
    }
  }
  html += '</tr>';

  for (let row = 0; row < ROWS; row++) {
    html += '<tr>';
    // Row label
    const rowStart = row * COLS + 1;
    html += `<td style="font-size: 9px; color: #666; text-align: right; padding-right: 5px;">${rowStart}</td>`;

    for (let col = 1; col <= COLS; col++) {
      const system = row * COLS + col;
      if (system > systemsPerGalaxy) {
        html += '<td></td>';
        continue;
      }

      const info = systemMap.get(system);
      const color = getSystemColor(info);
      const tooltip = getSystemTooltip(system, info);

      html += `<td
        class="hg-system-cell"
        data-system="${system}"
        title="${tooltip}"
        style="width: 12px; height: 12px; background: ${color}; border: 1px solid #333; cursor: pointer;"
      ></td>`;
    }
    html += '</tr>';
  }

  html += '</table>';
  return html;
}

function getSystemColor(info: GalaxySystemInfo | undefined): string {
  if (!info || info.age_hours === null) {
    return '#4a4a4a'; // Not scanned - gray
  }

  const age = info.age_hours;
  if (age < 24) {
    return '#388e3c'; // Fresh - green
  } else if (age < 72) {
    return '#fbc02d'; // Medium - yellow
  } else if (age < 168) {
    return '#ef6c00'; // Old - orange
  } else {
    return '#c62828'; // Very old - red
  }
}

function getSystemTooltip(system: number, info: GalaxySystemInfo | undefined): string {
  const coords = `[${selectedGalaxy}:${system}]`;
  if (!info || !info.last_scan_at) {
    return `${coords} - ${t('hub.galaxyStatus.neverScanned')}`;
  }

  const date = new Date(info.last_scan_at);
  const formatted = date.toLocaleString();
  const age = info.age_hours !== null ? `${info.age_hours}h` : '?';

  return `${coords} - ${formatted} (${age} ${t('hub.galaxyStatus.ago')})`;
}

function bindEvents(contentArea: Element): void {
  // Galaxy tab clicks
  contentArea.querySelectorAll('.hg-galaxy-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const galaxy = parseInt((e.target as HTMLElement).dataset.galaxy || '1', 10);
      if (galaxy !== selectedGalaxy) {
        selectedGalaxy = galaxy;
        renderPage(contentArea);
      }
    });
  });

  // System cell clicks - navigate to galaxy view
  contentArea.querySelectorAll('.hg-system-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const system = parseInt((e.target as HTMLElement).dataset.system || '1', 10);
      const url = `?page=galaxy&galaxy=${selectedGalaxy}&system=${system}`;
      window.location.href = url;
    });
  });
}

function showError(contentArea: Element, message: string): void {
  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 20px;">
      <table width="100%">
        <tr>
          <td class="c" colspan="2">${t('hub.galaxyStatus.title')}</td>
        </tr>
        <tr>
          <th colspan="2" style="padding: 15px; color: #f88;">
            ${t('hub.galaxyStatus.error')}: ${message}
          </th>
        </tr>
      </table>
    </div>
  `;
}
