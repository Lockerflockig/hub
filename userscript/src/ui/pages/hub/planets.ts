/**
 * Planets page - Shows all alliance planets with building levels
 */

import { api } from '../../../api/client';
import { t } from '../../../locales';
import { getGradientColor, formatNumber } from '../../../utils/formatting';

const CONTENT_ID = 'hg-hub-planets';

interface HubPlanetInfo {
  player_id: number;
  player_name: string;
  coordinates: string;
  buildings: Record<string, number> | null;
  points: number;
}

interface HubPlanetsResponse {
  planets: HubPlanetInfo[];
}

// Building ID to display info mapping
interface BuildingDef {
  id: string;
  abbrev: string;
  name: string;
  color: string;
}

// Building definitions with pr0game IDs
const BUILDINGS: BuildingDef[] = [
  // Production (green)
  { id: '1', abbrev: 'M', name: 'hub.planets.buildings.metalMine', color: '#4caf50' },
  { id: '2', abbrev: 'K', name: 'hub.planets.buildings.crystalMine', color: '#4caf50' },
  { id: '3', abbrev: 'D', name: 'hub.planets.buildings.deutMine', color: '#4caf50' },
  { id: '4', abbrev: 'S', name: 'hub.planets.buildings.solarPlant', color: '#4caf50' },
  // Special (pink)
  { id: '6', abbrev: 'T', name: 'hub.planets.buildings.technoDome', color: '#e91e63' },
  // Production (green)
  { id: '12', abbrev: 'F', name: 'hub.planets.buildings.fusionPlant', color: '#4caf50' },
  // Factories (blue)
  { id: '14', abbrev: 'R', name: 'hub.planets.buildings.robotFactory', color: '#2196f3' },
  { id: '15', abbrev: 'N', name: 'hub.planets.buildings.nanoFactory', color: '#2196f3' },
  // Military (red)
  { id: '21', abbrev: 'W', name: 'hub.planets.buildings.shipyard', color: '#f44336' },
  // Storage (green)
  { id: '22', abbrev: 'M', name: 'hub.planets.buildings.metalStorage', color: '#4caf50' },
  { id: '23', abbrev: 'K', name: 'hub.planets.buildings.crystalStorage', color: '#4caf50' },
  { id: '24', abbrev: 'D', name: 'hub.planets.buildings.deutStorage', color: '#4caf50' },
  // Research (pink)
  { id: '31', abbrev: 'F', name: 'hub.planets.buildings.researchLab', color: '#e91e63' },
  // Special (blue)
  { id: '33', abbrev: 'T', name: 'hub.planets.buildings.terraformer', color: '#2196f3' },
  // Military (red)
  { id: '34', abbrev: 'A', name: 'hub.planets.buildings.allianceDepot', color: '#f44336' },
  // Moon buildings (yellow)
  { id: '41', abbrev: 'M', name: 'hub.planets.buildings.moonBase', color: '#ffc107' },
  { id: '42', abbrev: 'P', name: 'hub.planets.buildings.phalanx', color: '#ffc107' },
  { id: '43', abbrev: 'S', name: 'hub.planets.buildings.jumpGate', color: '#ffc107' },
  // Military (red)
  { id: '44', abbrev: 'R', name: 'hub.planets.buildings.missileSilo', color: '#f44336' },
];

// State
let cachedData: HubPlanetInfo[] = [];
let sortColumn = 'coordinates';
let sortDirection: 'ASC' | 'DESC' = 'ASC';

/**
 * Render the Planets page
 */
export async function renderPlanetsPage(): Promise<void> {
  const contentArea = document.getElementById('content') || document.querySelector('content');
  if (!contentArea) {
    console.error('[HG Hub] Content area not found');
    return;
  }

  // Show loading state
  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 10px;">
      <div class="c" style="margin-bottom: 10px;">${t('hub.planets.title')}</div>
      <div style="text-align: center; padding: 20px;">${t('hub.planets.loading')}</div>
    </div>
  `;

  // Fetch data
  try {
    const response = await api.get<HubPlanetsResponse>('/hub/planets');

    if (response.ok && response.data) {
      cachedData = response.data.planets;
      renderPage(contentArea);
    } else {
      showError(contentArea, response.error || 'Failed to load data');
    }
  } catch (error) {
    showError(contentArea, String(error));
  }
}

function renderPage(contentArea: Element): void {
  // Sort data
  const sortedData = sortData([...cachedData]);

  // Build table
  const table = buildTable(sortedData);

  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 10px;">
      <div class="c" style="margin-bottom: 10px;">${t('hub.planets.title')}</div>
      <div style="margin-bottom: 10px; font-size: 12px; color: #aaa;">
        <i>${t('hub.planets.hint')}</i>
      </div>
      <div style="overflow-x: auto;">
        ${table}
      </div>
      <div style="margin-top: 10px; font-size: 11px; color: #666;">
        ${t('hub.planets.count')}: ${sortedData.length}
      </div>
    </div>
  `;

  bindEvents(contentArea);
}

function sortData(data: HubPlanetInfo[]): HubPlanetInfo[] {
  const multiplier = sortDirection === 'ASC' ? 1 : -1;

  return data.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (sortColumn === 'coordinates') {
      // Sort by galaxy, then system, then planet
      const [aG, aS, aP] = parseCoordinates(a.coordinates);
      const [bG, bS, bP] = parseCoordinates(b.coordinates);
      if (aG !== bG) return (aG - bG) * multiplier;
      if (aS !== bS) return (aS - bS) * multiplier;
      return (aP - bP) * multiplier;
    } else if (sortColumn === 'player_name') {
      aVal = a.player_name.toLowerCase();
      bVal = b.player_name.toLowerCase();
    } else if (sortColumn === 'points') {
      aVal = a.points || 0;
      bVal = b.points || 0;
    } else {
      // Building column
      aVal = a.buildings?.[sortColumn] || 0;
      bVal = b.buildings?.[sortColumn] || 0;
    }

    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

function parseCoordinates(coords: string): [number, number, number] {
  const parts = coords.split(':').map(p => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function buildTable(data: HubPlanetInfo[]): string {
  // Calculate max values for color gradient
  const maxValues: Record<string, number> = {};
  BUILDINGS.forEach(b => {
    maxValues[b.id] = Math.max(...data.map(p => p.buildings?.[b.id] || 0), 1);
  });
  const maxPoints = Math.max(...data.map(p => p.points || 0), 1);

  let html = '<table style="border-collapse: collapse; width: 100%; font-size: 12px;">';

  // Header row
  html += '<tr style="background: rgba(0,0,0,0.3);">';
  html += buildSortHeader('coordinates', t('hub.planets.coordinates'), 'ASC', 3);
  html += buildSortHeader('player_name', t('hub.planets.player'), 'ASC', 1, 'left');
  html += buildSortHeader('points', t('hub.planets.points'), 'DESC', 1, 'left');

  BUILDINGS.forEach(b => {
    const isActive = sortColumn === b.id;
    const arrow = isActive ? (sortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
    html += `<th class="hg-sort-header" data-sort="${b.id}" data-direction="DESC"
      style="color: ${b.color}; text-align: right; padding: 6px 4px; cursor: pointer; white-space: nowrap;"
      title="${t(b.name)}">${b.abbrev}${arrow}</th>`;
  });

  html += '</tr>';

  // Data rows
  data.forEach(planet => {
    const [g, s, p] = parseCoordinates(planet.coordinates);
    const points = planet.points || 0;
    const pointsColor = getGradientColor(points, maxPoints);

    html += '<tr style="border-bottom: 1px solid #333;">';
    html += `<td style="text-align: right; padding: 4px; width: 35px;">${g}</td>`;
    html += `<td style="text-align: right; padding: 4px; width: 35px;">${s}</td>`;
    html += `<td style="text-align: right; padding: 4px; width: 35px;">${p}</td>`;
    html += `<td style="text-align: left; padding: 4px;">${planet.player_name}</td>`;
    html += `<td style="text-align: right; padding: 4px; color: ${pointsColor};">${formatNumber(points) || ''}</td>`;

    BUILDINGS.forEach(b => {
      const level = planet.buildings?.[b.id] || 0;
      const color = level > 0 ? getGradientColor(level, maxValues[b.id]) : '#666';
      html += `<td style="text-align: right; padding: 4px; color: ${color};">${level || ''}</td>`;
    });

    html += '</tr>';
  });

  html += '</table>';
  return html;
}

function buildSortHeader(
  column: string,
  label: string,
  defaultDirection: 'ASC' | 'DESC',
  colspan = 1,
  align = 'right'
): string {
  const isActive = sortColumn === column;
  const arrow = isActive ? (sortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
  return `<th class="hg-sort-header" data-sort="${column}" data-direction="${defaultDirection}"
    colspan="${colspan}"
    style="text-align: ${align}; padding: 6px 4px; cursor: pointer; white-space: nowrap;">${label}${arrow}</th>`;
}

function bindEvents(contentArea: Element): void {
  // Sort header clicks
  contentArea.querySelectorAll('.hg-sort-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const column = target.dataset.sort || 'coordinates';
      const defaultDir = target.dataset.direction as 'ASC' | 'DESC' || 'ASC';

      if (sortColumn === column) {
        // Toggle direction
        sortDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
      } else {
        sortColumn = column;
        sortDirection = defaultDir;
      }

      renderPage(contentArea);
    });
  });
}

function showError(contentArea: Element, message: string): void {
  // Check if this is the "no alliance" error
  const isNoAlliance = message.toLowerCase().includes('allianz') ||
                       message.toLowerCase().includes('alliance');

  const errorContent = isNoAlliance
    ? `<div style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 15px;">🏠</div>
        <div style="color: #ffc107; font-size: 14px; margin-bottom: 10px;">
          ${t('hub.planets.noAlliance')}
        </div>
        <div style="color: #888; font-size: 12px;">
          ${t('hub.planets.noAllianceHint')}
        </div>
      </div>`
    : `<div style="text-align: center; padding: 20px; color: #f88;">${t('hub.planets.error')}: ${message}</div>`;

  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 10px;">
      <div class="c" style="margin-bottom: 10px;">${t('hub.planets.title')}</div>
      ${errorContent}
    </div>
  `;
}
