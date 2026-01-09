/**
 * Points page - Combined view for Planets, Fleet, and Research
 * Shows data in a tabbed interface with Planets as default
 */

import { api } from '../../../api/client';
import { t } from '../../../locales';
import { calculateFleetPoints, calculateResearchPoints } from '../../../data/gameData';
import { getGradientColor, formatNumber } from '../../../utils/formatting';

const CONTENT_ID = 'hg-hub-points';

type PointsTab = 'planets' | 'fleet' | 'research';
let activeTab: PointsTab = 'planets';
let contentAreaRef: Element | null = null;

// ============================================================================
// Planets Data & Rendering
// ============================================================================

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

interface BuildingDef {
  id: string;
  abbrev: string;
  name: string;
  color: string;
}

const BUILDINGS: BuildingDef[] = [
  { id: '1', abbrev: 'M', name: 'hub.planets.buildings.metalMine', color: '#4caf50' },
  { id: '2', abbrev: 'K', name: 'hub.planets.buildings.crystalMine', color: '#4caf50' },
  { id: '3', abbrev: 'D', name: 'hub.planets.buildings.deutMine', color: '#4caf50' },
  { id: '4', abbrev: 'S', name: 'hub.planets.buildings.solarPlant', color: '#4caf50' },
  { id: '6', abbrev: 'T', name: 'hub.planets.buildings.technoDome', color: '#e91e63' },
  { id: '12', abbrev: 'F', name: 'hub.planets.buildings.fusionPlant', color: '#4caf50' },
  { id: '14', abbrev: 'R', name: 'hub.planets.buildings.robotFactory', color: '#2196f3' },
  { id: '15', abbrev: 'N', name: 'hub.planets.buildings.nanoFactory', color: '#2196f3' },
  { id: '21', abbrev: 'W', name: 'hub.planets.buildings.shipyard', color: '#f44336' },
  { id: '22', abbrev: 'M', name: 'hub.planets.buildings.metalStorage', color: '#4caf50' },
  { id: '23', abbrev: 'K', name: 'hub.planets.buildings.crystalStorage', color: '#4caf50' },
  { id: '24', abbrev: 'D', name: 'hub.planets.buildings.deutStorage', color: '#4caf50' },
  { id: '31', abbrev: 'F', name: 'hub.planets.buildings.researchLab', color: '#e91e63' },
  { id: '33', abbrev: 'T', name: 'hub.planets.buildings.terraformer', color: '#2196f3' },
  { id: '34', abbrev: 'A', name: 'hub.planets.buildings.allianceDepot', color: '#f44336' },
  { id: '41', abbrev: 'M', name: 'hub.planets.buildings.moonBase', color: '#ffc107' },
  { id: '42', abbrev: 'P', name: 'hub.planets.buildings.phalanx', color: '#ffc107' },
  { id: '43', abbrev: 'S', name: 'hub.planets.buildings.jumpGate', color: '#ffc107' },
  { id: '44', abbrev: 'R', name: 'hub.planets.buildings.missileSilo', color: '#f44336' },
];

let planetsData: HubPlanetInfo[] = [];
let planetsSortColumn = 'coordinates';
let planetsSortDirection: 'ASC' | 'DESC' = 'ASC';

// ============================================================================
// Fleet Data & Rendering
// ============================================================================

interface HubFleetInfo {
  id: number;
  name: string;
  fleet: Record<string, number>;
  score_fleet: number | null;
}

interface HubFleetResponse {
  players: HubFleetInfo[];
  total: Record<string, number>;
}

interface ShipDef {
  id: string;
  abbrev: string;
  name: string;
  color: string;
}

const SHIPS: ShipDef[] = [
  { id: '202', abbrev: 'KT', name: 'hub.fleet.ships.smallCargo', color: '#4caf50' },
  { id: '203', abbrev: 'GT', name: 'hub.fleet.ships.largeCargo', color: '#4caf50' },
  { id: '208', abbrev: 'KS', name: 'hub.fleet.ships.colonyShip', color: '#4caf50' },
  { id: '209', abbrev: 'Rec', name: 'hub.fleet.ships.recycler', color: '#4caf50' },
  { id: '210', abbrev: 'Spy', name: 'hub.fleet.ships.espionageProbe', color: '#4caf50' },
  { id: '212', abbrev: 'Sat', name: 'hub.fleet.ships.solarSatellite', color: '#4caf50' },
  { id: '204', abbrev: 'LJ', name: 'hub.fleet.ships.lightFighter', color: '#f44336' },
  { id: '205', abbrev: 'SJ', name: 'hub.fleet.ships.heavyFighter', color: '#f44336' },
  { id: '206', abbrev: 'Xer', name: 'hub.fleet.ships.cruiser', color: '#f44336' },
  { id: '207', abbrev: 'SS', name: 'hub.fleet.ships.battleship', color: '#f44336' },
  { id: '211', abbrev: 'B', name: 'hub.fleet.ships.bomber', color: '#f44336' },
  { id: '213', abbrev: 'Z', name: 'hub.fleet.ships.destroyer', color: '#f44336' },
  { id: '214', abbrev: 'DS', name: 'hub.fleet.ships.deathstar', color: '#f44336' },
  { id: '215', abbrev: 'SXer', name: 'hub.fleet.ships.battlecruiser', color: '#f44336' },
  { id: '222', abbrev: 'HXer', name: 'hub.fleet.ships.heavyCruiser', color: '#ff9800' },
  { id: '225', abbrev: 'ST', name: 'hub.fleet.ships.assaultTransport', color: '#ff9800' },
  { id: '227', abbrev: 'ORec', name: 'hub.fleet.ships.optimizedRecycler', color: '#ff9800' },
];

let fleetData: HubFleetInfo[] = [];
let fleetTotal: Record<string, number> = {};
let fleetSortColumn = 'name';
let fleetSortDirection: 'ASC' | 'DESC' = 'ASC';

// ============================================================================
// Research Data & Rendering
// ============================================================================

interface HubResearchInfo {
  id: number;
  name: string;
  research: Record<string, number> | null;
}

interface HubResearchResponse {
  players: HubResearchInfo[];
}

interface ResearchDef {
  id: string;
  abbrev: string;
  name: string;
  color: string;
}

const RESEARCH: ResearchDef[] = [
  { id: '106', abbrev: 'Spy', name: 'hub.research.techs.espionage', color: '#9c27b0' },
  { id: '108', abbrev: 'Comp', name: 'hub.research.techs.computer', color: '#9c27b0' },
  { id: '109', abbrev: 'Waff', name: 'hub.research.techs.weapons', color: '#f44336' },
  { id: '110', abbrev: 'Schild', name: 'hub.research.techs.shielding', color: '#f44336' },
  { id: '111', abbrev: 'Panz', name: 'hub.research.techs.armor', color: '#f44336' },
  { id: '113', abbrev: 'Ener', name: 'hub.research.techs.energy', color: '#ffc107' },
  { id: '114', abbrev: 'Hyper', name: 'hub.research.techs.hyperspace', color: '#ffc107' },
  { id: '115', abbrev: 'Verb', name: 'hub.research.techs.combustion', color: '#2196f3' },
  { id: '117', abbrev: 'Imp', name: 'hub.research.techs.impulse', color: '#2196f3' },
  { id: '118', abbrev: 'HA', name: 'hub.research.techs.hyperspaceDrive', color: '#2196f3' },
  { id: '120', abbrev: 'Las', name: 'hub.research.techs.laser', color: '#ff9800' },
  { id: '121', abbrev: 'Ion', name: 'hub.research.techs.ion', color: '#ff9800' },
  { id: '122', abbrev: 'Plas', name: 'hub.research.techs.plasma', color: '#ff9800' },
  { id: '123', abbrev: 'IGN', name: 'hub.research.techs.intergalactic', color: '#4caf50' },
  { id: '124', abbrev: 'Astro', name: 'hub.research.techs.astrophysics', color: '#4caf50' },
  { id: '131', abbrev: 'PM', name: 'hub.research.techs.metalProd', color: '#00bcd4' },
  { id: '132', abbrev: 'PK', name: 'hub.research.techs.crystalProd', color: '#00bcd4' },
  { id: '133', abbrev: 'PD', name: 'hub.research.techs.deutProd', color: '#00bcd4' },
  { id: '199', abbrev: 'Grav', name: 'hub.research.techs.graviton', color: '#e91e63' },
];

let researchData: HubResearchInfo[] = [];
let researchSortColumn = 'name';
let researchSortDirection: 'ASC' | 'DESC' = 'ASC';

// ============================================================================
// Main Page Rendering
// ============================================================================

/**
 * Render the Points page with tabs
 */
export async function renderPointsPage(): Promise<void> {
  const contentArea = document.getElementById('content') || document.querySelector('content');
  if (!contentArea) {
    console.error('[HG Hub] Content area not found');
    return;
  }

  contentAreaRef = contentArea;
  renderPage();
}

function renderPage(): void {
  if (!contentAreaRef) return;

  const tabsHtml = buildTabs();

  contentAreaRef.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 10px;">
      <div class="c" style="margin-bottom: 10px;">${t('hub.points.title')}</div>
      ${tabsHtml}
      <div id="hg-points-content" style="margin-top: 10px;">
        <div style="text-align: center; padding: 20px;">${t('hub.points.loading')}</div>
      </div>
    </div>
  `;

  bindTabEvents();
  loadTabContent();
}

function buildTabs(): string {
  const tabs = [
    { id: 'planets', label: t('hub.menu.planets') },
    { id: 'fleet', label: t('hub.menu.fleet') },
    { id: 'research', label: t('hub.menu.research') },
  ];

  return `
    <div style="display: flex; gap: 2px; margin-bottom: 10px;">
      ${tabs.map(tab => `
        <button class="hg-points-tab" data-tab="${tab.id}" style="
          background: ${activeTab === tab.id ? '#4a8aba' : '#2a4a6a'};
          color: ${activeTab === tab.id ? '#fff' : '#8cf'};
          border: 1px solid #4a8aba;
          padding: 8px 16px;
          cursor: pointer;
          border-radius: 3px 3px 0 0;
          font-size: 12px;
        ">${tab.label}</button>
      `).join('')}
    </div>
  `;
}

function bindTabEvents(): void {
  document.querySelectorAll('.hg-points-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const newTab = target.dataset.tab as PointsTab;
      if (newTab && newTab !== activeTab) {
        activeTab = newTab;
        renderPage();
      }
    });
  });
}

async function loadTabContent(): Promise<void> {
  const container = document.getElementById('hg-points-content');
  if (!container) return;

  switch (activeTab) {
    case 'planets':
      await loadPlanetsContent(container);
      break;
    case 'fleet':
      await loadFleetContent(container);
      break;
    case 'research':
      await loadResearchContent(container);
      break;
  }
}

// ============================================================================
// Planets Content
// ============================================================================

async function loadPlanetsContent(container: Element): Promise<void> {
  try {
    const response = await api.get<HubPlanetsResponse>('/hub/planets');

    if (response.ok && response.data) {
      planetsData = response.data.planets;
      renderPlanetsContent(container);
    } else {
      showTabError(container, 'planets', response.error || 'Failed to load data');
    }
  } catch (error) {
    showTabError(container, 'planets', String(error));
  }
}

function renderPlanetsContent(container: Element): void {
  const sortedData = sortPlanetsData([...planetsData]);
  const table = buildPlanetsTable(sortedData);

  container.innerHTML = `
    <div style="margin-bottom: 10px; font-size: 12px; color: #aaa;">
      <i>${t('hub.planets.hint')}</i>
    </div>
    <div style="overflow-x: auto;">
      ${table}
    </div>
    <div style="margin-top: 10px; font-size: 11px; color: #666;">
      ${t('hub.planets.count')}: ${sortedData.length}
    </div>
  `;

  bindPlanetsSortEvents(container);
}

function sortPlanetsData(data: HubPlanetInfo[]): HubPlanetInfo[] {
  const multiplier = planetsSortDirection === 'ASC' ? 1 : -1;

  return data.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (planetsSortColumn === 'coordinates') {
      const [aG, aS, aP] = parseCoordinates(a.coordinates);
      const [bG, bS, bP] = parseCoordinates(b.coordinates);
      if (aG !== bG) return (aG - bG) * multiplier;
      if (aS !== bS) return (aS - bS) * multiplier;
      return (aP - bP) * multiplier;
    } else if (planetsSortColumn === 'player_name') {
      aVal = a.player_name.toLowerCase();
      bVal = b.player_name.toLowerCase();
    } else if (planetsSortColumn === 'points') {
      aVal = a.points || 0;
      bVal = b.points || 0;
    } else {
      aVal = a.buildings?.[planetsSortColumn] || 0;
      bVal = b.buildings?.[planetsSortColumn] || 0;
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

function buildPlanetsTable(data: HubPlanetInfo[]): string {
  const maxValues: Record<string, number> = {};
  BUILDINGS.forEach(b => {
    maxValues[b.id] = Math.max(...data.map(p => p.buildings?.[b.id] || 0), 1);
  });
  const maxPoints = Math.max(...data.map(p => p.points || 0), 1);

  let html = '<table style="border-collapse: collapse; width: 100%; font-size: 12px;">';

  html += '<tr style="background: rgba(0,0,0,0.3);">';
  html += buildPlanetsSortHeader('coordinates', t('hub.planets.coordinates'), 'ASC', 3);
  html += buildPlanetsSortHeader('player_name', t('hub.planets.player'), 'ASC', 1, 'left');
  html += buildPlanetsSortHeader('points', t('hub.planets.points'), 'DESC', 1, 'left');

  BUILDINGS.forEach(b => {
    const isActive = planetsSortColumn === b.id;
    const arrow = isActive ? (planetsSortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
    html += `<th class="hg-planets-sort" data-sort="${b.id}" data-direction="DESC"
      style="color: ${b.color}; text-align: right; padding: 6px 4px; cursor: pointer; white-space: nowrap;"
      title="${t(b.name)}">${b.abbrev}${arrow}</th>`;
  });

  html += '</tr>';

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

function buildPlanetsSortHeader(
  column: string,
  label: string,
  defaultDirection: 'ASC' | 'DESC',
  colspan = 1,
  align = 'right'
): string {
  const isActive = planetsSortColumn === column;
  const arrow = isActive ? (planetsSortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
  return `<th class="hg-planets-sort" data-sort="${column}" data-direction="${defaultDirection}"
    colspan="${colspan}"
    style="text-align: ${align}; padding: 6px 4px; cursor: pointer; white-space: nowrap;">${label}${arrow}</th>`;
}

function bindPlanetsSortEvents(container: Element): void {
  container.querySelectorAll('.hg-planets-sort').forEach(header => {
    header.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const column = target.dataset.sort || 'coordinates';
      const defaultDir = target.dataset.direction as 'ASC' | 'DESC' || 'ASC';

      if (planetsSortColumn === column) {
        planetsSortDirection = planetsSortDirection === 'ASC' ? 'DESC' : 'ASC';
      } else {
        planetsSortColumn = column;
        planetsSortDirection = defaultDir;
      }

      renderPlanetsContent(container);
    });
  });
}

// ============================================================================
// Fleet Content
// ============================================================================

async function loadFleetContent(container: Element): Promise<void> {
  try {
    const response = await api.get<HubFleetResponse>('/hub/fleet');

    if (response.ok && response.data) {
      fleetData = aggregateFleetByPlayer(response.data.players);
      fleetTotal = response.data.total;
      renderFleetContent(container);
    } else {
      showTabError(container, 'fleet', response.error || 'Failed to load data');
    }
  } catch (error) {
    showTabError(container, 'fleet', String(error));
  }
}

function aggregateFleetByPlayer(players: HubFleetInfo[]): HubFleetInfo[] {
  const playerMap = new Map<string, HubFleetInfo>();

  for (const player of players) {
    const existing = playerMap.get(player.name);
    if (existing) {
      for (const [shipId, count] of Object.entries(player.fleet)) {
        existing.fleet[shipId] = (existing.fleet[shipId] || 0) + count;
      }
    } else {
      playerMap.set(player.name, {
        id: player.id,
        name: player.name,
        fleet: { ...player.fleet },
        score_fleet: player.score_fleet,
      });
    }
  }

  return Array.from(playerMap.values());
}

function renderFleetContent(container: Element): void {
  const sortedData = sortFleetData([...fleetData]);
  const table = buildFleetTable(sortedData);

  container.innerHTML = `
    <div style="margin-bottom: 10px; font-size: 12px; color: #aaa;">
      <i>${t('hub.fleet.hint')}</i>
    </div>
    <div style="overflow-x: auto;">
      ${table}
    </div>
    <div style="margin-top: 10px; font-size: 11px; color: #666;">
      ${t('hub.fleet.count')}: ${sortedData.length}
    </div>
  `;

  bindFleetSortEvents(container);
}

function sortFleetData(data: HubFleetInfo[]): HubFleetInfo[] {
  const multiplier = fleetSortDirection === 'ASC' ? 1 : -1;

  return data.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (fleetSortColumn === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (fleetSortColumn === 'total') {
      aVal = calculateFleetTotal(a);
      bVal = calculateFleetTotal(b);
    } else {
      aVal = a.fleet[fleetSortColumn] || 0;
      bVal = b.fleet[fleetSortColumn] || 0;
    }

    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

function calculateFleetTotal(player: HubFleetInfo): number {
  const calculatedPoints = calculateFleetPoints(player.fleet);

  if (Object.keys(player.fleet).length === 0 && player.score_fleet) {
    return player.score_fleet;
  }

  return calculatedPoints;
}

function buildFleetTable(data: HubFleetInfo[]): string {
  const maxValues: Record<string, number> = {};
  SHIPS.forEach(s => {
    maxValues[s.id] = Math.max(...data.map(p => p.fleet[s.id] || 0), 1);
  });

  let html = '<table style="border-collapse: collapse; width: 100%; font-size: 12px;">';

  html += '<tr style="background: rgba(0,0,0,0.3);">';
  html += buildFleetSortHeader('name', t('hub.fleet.player'), 'ASC', 'left');
  html += buildFleetSortHeader('total', t('hub.fleet.total'), 'DESC', 'right');

  SHIPS.forEach(s => {
    const isActive = fleetSortColumn === s.id;
    const arrow = isActive ? (fleetSortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
    html += `<th class="hg-fleet-sort" data-sort="${s.id}" data-direction="DESC"
      style="color: ${s.color}; text-align: right; padding: 6px 4px; cursor: pointer; white-space: nowrap;"
      title="${t(s.name)}">${s.abbrev}${arrow}</th>`;
  });

  html += '</tr>';

  data.forEach(player => {
    const total = calculateFleetTotal(player);
    const hasFleetData = Object.keys(player.fleet).length > 0;
    const totalColor = hasFleetData ? '#888' : '#c96';

    html += '<tr style="border-bottom: 1px solid #333;">';
    html += `<td style="text-align: left; padding: 4px;">${player.name}</td>`;
    html += `<td style="text-align: right; padding: 4px; color: ${totalColor};" title="${hasFleetData ? '' : 'PlayerCard Fallback'}">${formatNumber(total) || ''}</td>`;

    SHIPS.forEach(s => {
      const count = player.fleet[s.id] || 0;
      const color = count > 0 ? getGradientColor(count, maxValues[s.id]) : '#666';
      html += `<td style="text-align: right; padding: 4px; color: ${color};">${formatNumber(count) || ''}</td>`;
    });

    html += '</tr>';
  });

  if (Object.keys(fleetTotal).length > 0) {
    const grandTotal = calculateFleetPoints(fleetTotal);
    html += '<tr style="border-top: 2px solid #f44336; font-weight: bold; color: #f44336;">';
    html += `<td style="text-align: left; padding: 8px 4px;">${t('hub.fleet.totalRow')}</td>`;
    html += `<td style="text-align: right; padding: 8px 4px;">${formatNumber(grandTotal)}</td>`;

    SHIPS.forEach(s => {
      const count = fleetTotal[s.id] || 0;
      html += `<td style="text-align: right; padding: 8px 4px;">${formatNumber(count) || ''}</td>`;
    });

    html += '</tr>';
  }

  html += '</table>';
  return html;
}

function buildFleetSortHeader(
  column: string,
  label: string,
  defaultDirection: 'ASC' | 'DESC',
  align = 'right'
): string {
  const isActive = fleetSortColumn === column;
  const arrow = isActive ? (fleetSortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
  return `<th class="hg-fleet-sort" data-sort="${column}" data-direction="${defaultDirection}"
    style="text-align: ${align}; padding: 6px 4px; cursor: pointer; white-space: nowrap;">${label}${arrow}</th>`;
}

function bindFleetSortEvents(container: Element): void {
  container.querySelectorAll('.hg-fleet-sort').forEach(header => {
    header.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const column = target.dataset.sort || 'name';
      const defaultDir = target.dataset.direction as 'ASC' | 'DESC' || 'ASC';

      if (fleetSortColumn === column) {
        fleetSortDirection = fleetSortDirection === 'ASC' ? 'DESC' : 'ASC';
      } else {
        fleetSortColumn = column;
        fleetSortDirection = defaultDir;
      }

      renderFleetContent(container);
    });
  });
}

// ============================================================================
// Research Content
// ============================================================================

async function loadResearchContent(container: Element): Promise<void> {
  try {
    const response = await api.get<HubResearchResponse>('/hub/research');

    if (response.ok && response.data) {
      researchData = response.data.players;
      renderResearchContent(container);
    } else {
      showTabError(container, 'research', response.error || 'Failed to load data');
    }
  } catch (error) {
    showTabError(container, 'research', String(error));
  }
}

function renderResearchContent(container: Element): void {
  const sortedData = sortResearchData([...researchData]);
  const table = buildResearchTable(sortedData);

  container.innerHTML = `
    <div style="margin-bottom: 10px; font-size: 12px; color: #aaa;">
      <i>${t('hub.research.hint')}</i>
    </div>
    <div style="overflow-x: auto;">
      ${table}
    </div>
    <div style="margin-top: 10px; font-size: 11px; color: #666;">
      ${t('hub.research.count')}: ${sortedData.length}
    </div>
  `;

  bindResearchSortEvents(container);
}

function sortResearchData(data: HubResearchInfo[]): HubResearchInfo[] {
  const multiplier = researchSortDirection === 'ASC' ? 1 : -1;

  return data.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (researchSortColumn === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (researchSortColumn === 'total') {
      aVal = calculateResearchTotal(a.research);
      bVal = calculateResearchTotal(b.research);
    } else {
      aVal = a.research?.[researchSortColumn] || 0;
      bVal = b.research?.[researchSortColumn] || 0;
    }

    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

function calculateResearchTotal(research: Record<string, number> | null): number {
  if (!research) return 0;
  return calculateResearchPoints(research);
}

function buildResearchTable(data: HubResearchInfo[]): string {
  const maxValues: Record<string, number> = {};
  RESEARCH.forEach(r => {
    maxValues[r.id] = Math.max(...data.map(p => p.research?.[r.id] || 0), 1);
  });

  let html = '<table style="border-collapse: collapse; width: 100%; font-size: 12px;">';

  html += '<tr style="background: rgba(0,0,0,0.3);">';
  html += buildResearchSortHeader('name', t('hub.research.player'), 'ASC', 'left');
  html += buildResearchSortHeader('total', t('hub.research.total'), 'DESC', 'right');

  RESEARCH.forEach(r => {
    const isActive = researchSortColumn === r.id;
    const arrow = isActive ? (researchSortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
    html += `<th class="hg-research-sort" data-sort="${r.id}" data-direction="DESC"
      style="color: ${r.color}; text-align: right; padding: 6px 4px; cursor: pointer; white-space: nowrap;"
      title="${t(r.name)}">${r.abbrev}${arrow}</th>`;
  });

  html += '</tr>';

  data.forEach(player => {
    const total = calculateResearchTotal(player.research);

    html += '<tr style="border-bottom: 1px solid #333;">';
    html += `<td style="text-align: left; padding: 4px;">${player.name}</td>`;
    html += `<td style="text-align: right; padding: 4px; color: #888;">${total || ''}</td>`;

    RESEARCH.forEach(r => {
      const level = player.research?.[r.id] || 0;
      const color = level > 0 ? getGradientColor(level, maxValues[r.id]) : '#666';
      html += `<td style="text-align: right; padding: 4px; color: ${color};">${level || ''}</td>`;
    });

    html += '</tr>';
  });

  html += '</table>';
  return html;
}

function buildResearchSortHeader(
  column: string,
  label: string,
  defaultDirection: 'ASC' | 'DESC',
  align = 'right'
): string {
  const isActive = researchSortColumn === column;
  const arrow = isActive ? (researchSortDirection === 'ASC' ? ' ▲' : ' ▼') : '';
  return `<th class="hg-research-sort" data-sort="${column}" data-direction="${defaultDirection}"
    style="text-align: ${align}; padding: 6px 4px; cursor: pointer; white-space: nowrap;">${label}${arrow}</th>`;
}

function bindResearchSortEvents(container: Element): void {
  container.querySelectorAll('.hg-research-sort').forEach(header => {
    header.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const column = target.dataset.sort || 'name';
      const defaultDir = target.dataset.direction as 'ASC' | 'DESC' || 'ASC';

      if (researchSortColumn === column) {
        researchSortDirection = researchSortDirection === 'ASC' ? 'DESC' : 'ASC';
      } else {
        researchSortColumn = column;
        researchSortDirection = defaultDir;
      }

      renderResearchContent(container);
    });
  });
}

// ============================================================================
// Error Handling
// ============================================================================

function showTabError(container: Element, tab: PointsTab, message: string): void {
  const isNoAlliance = message.toLowerCase().includes('allianz') ||
                       message.toLowerCase().includes('alliance');

  const icons: Record<PointsTab, string> = {
    planets: '🏠',
    fleet: '🚀',
    research: '🔬',
  };

  const noAllianceKeys: Record<PointsTab, { title: string; hint: string }> = {
    planets: { title: 'hub.planets.noAlliance', hint: 'hub.planets.noAllianceHint' },
    fleet: { title: 'hub.fleet.noAlliance', hint: 'hub.fleet.noAllianceHint' },
    research: { title: 'hub.research.noAlliance', hint: 'hub.research.noAllianceHint' },
  };

  const errorKeys: Record<PointsTab, string> = {
    planets: 'hub.planets.error',
    fleet: 'hub.fleet.error',
    research: 'hub.research.error',
  };

  if (isNoAlliance) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 15px;">${icons[tab]}</div>
        <div style="color: #ffc107; font-size: 14px; margin-bottom: 10px;">
          ${t(noAllianceKeys[tab].title)}
        </div>
        <div style="color: #888; font-size: 12px;">
          ${t(noAllianceKeys[tab].hint)}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #f88;">
        ${t(errorKeys[tab])}: ${message}
      </div>
    `;
  }
}
