/**
 * Flight Time Calculator
 * - Calculate flight time from start time + speed%
 * - Back-calculate speed% from arrival time or remaining time
 * - Auto-load START player's research (not target)
 * - Multi-ship selection with automatic slowest ship detection
 *
 * Formulas based on OGame/pr0game flight mechanics
 */

import { api } from '../../../api/client';
import { t, getTranslations } from '../../../locales';
import { SHIPS, getShipSpeed } from '../../../data/gameData';

// Ship IDs that can fly (exclude 212 solar satellite which has speed 0)
const schiffIds = Object.keys(SHIPS).filter(id => SHIPS[id].speed.base > 0);

// Get localized ship name from game ID
function getShipName(shipId: string): string {
  const trans = getTranslations();
  const ships = trans.gameIds?.ships as Record<string, string> | undefined;
  return ships?.[shipId] || shipId;
}

const geschwindigkeitsProzente = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// Calculation modes
type CalcMode = 'startzeit' | 'ankunftszeit' | 'restzeit' | 'abbruchzeit';

// State
let containerElement: HTMLElement | null = null;
let playerResearch: Record<string, number> | null = null;
let researchUpdatedAt: string | null = null;
let startResearch: Record<string, number> | null = null;
let startPlayerName: string | null = null;
let researchSource: 'own' | 'start' | 'manual' = 'own';
let universeConfig = { galaxies: 9, systems: 499, galaxy_wrapped: true };
let selectedShips: Set<string> = new Set(['203']); // Default: Large Cargo
let slowestShip: string | null = null;
let calcMode: CalcMode = 'startzeit';

interface CalcState {
  startKoord: string;
  zielKoord: string;
  verbrennerStufe: number;
  impulseStufe: number;
  hyperStufe: number;
  geschwindigkeitProzent: number;
  // Mode: startzeit
  startzeit: string;
  // Mode: ankunftszeit
  ankunftszeit: string;
  ungefaehreStartzeit: string; // Optional hint for speed calculation
  // Mode: restzeit
  restflugzeit: string;
  // Mode: abbruchzeit (enemy timing)
  abflugzeit: string;   // When enemy departed (approximate)
  abbruchzeit: string;  // When enemy aborted (observed)
}

const defaultState: CalcState = {
  startKoord: '1:1:1',
  zielKoord: '1:1:2',
  verbrennerStufe: 0,
  impulseStufe: 0,
  hyperStufe: 0,
  geschwindigkeitProzent: 100,
  startzeit: '',
  ankunftszeit: '',
  ungefaehreStartzeit: '',
  restflugzeit: '',
  abflugzeit: '',
  abbruchzeit: '',
};

let state: CalcState = { ...defaultState };

// API Response interfaces
interface GalaxyPlanetInfo {
  id: number;
  name: string | null;
  player_id: number;
  coordinates: string;
  planet: number;
  type: string;
}

interface GalaxySystemResponse {
  planets: GalaxyPlanetInfo[];
  spy_reports: unknown[];
  last_scan_at: string | null;
}

interface PlayerResponse {
  id: number;
  name: string;
  research: Record<string, number> | null;
}

interface SpyReportInfo {
  id: number;
  created_at: string;
  reporter_name: string | null;
  resources: Record<string, number> | null;
  buildings: Record<string, number> | null;
  research: Record<string, number> | null;
  fleet: Record<string, number> | null;
  defense: Record<string, number> | null;
}

interface SpyReportsResponse {
  coordinates: string;
  type: string;
  reports: SpyReportInfo[];
}

/**
 * Initialize flight calculator
 */
export async function initFlightCalcPage(container: HTMLElement): Promise<void> {
  containerElement = container;

  // Load universe config and player research in parallel
  await Promise.all([
    loadUniverseConfig(),
    loadPlayerResearch()
  ]);

  // Set default times to now
  state.startzeit = formatCurrentTime();
  state.ankunftszeit = formatCurrentTime();

  renderContent();
}

async function loadUniverseConfig(): Promise<void> {
  try {
    const response = await api.get<{ galaxies: number; systems: number; galaxy_wrapped: boolean }>('/hub/config');
    if (response.ok && response.data) {
      universeConfig = response.data;
    }
  } catch {
    // Use defaults
  }
}

async function loadPlayerResearch(): Promise<void> {
  try {
    const response = await api.get<{ research: Record<string, number>; updated_at: string | null }>('/users/research');
    if (response.ok && response.data) {
      playerResearch = response.data.research;
      researchUpdatedAt = response.data.updated_at;

      // Auto-fill techs from own player data
      if (playerResearch) {
        state.verbrennerStufe = playerResearch['115'] || 0;
        state.impulseStufe = playerResearch['117'] || 0;
        state.hyperStufe = playerResearch['118'] || 0;
        researchSource = 'own';
      }
    }
  } catch {
    // Silently ignore - manual entry required
  }
}

/**
 * Load research from START coordinate (the attacker's techs)
 */
async function loadStartResearch(coordinates: string): Promise<void> {
  const koord = parseKoord(coordinates);
  if (!koord) return;

  let playerName: string | null = null;

  try {
    // Try to get current player name and research from galaxy data
    const galaxyResponse = await api.get<GalaxySystemResponse>(`/galaxy/${koord.galaxy}/${koord.system}`);
    if (galaxyResponse.ok && galaxyResponse.data) {
      const planet = galaxyResponse.data.planets.find(p => p.planet === koord.position);
      if (planet && planet.player_id) {
        const playerResponse = await api.get<PlayerResponse>(`/players/${planet.player_id}`);
        if (playerResponse.ok && playerResponse.data) {
          playerName = playerResponse.data.name;

          // First try: Use player's research field
          if (playerResponse.data.research &&
              (playerResponse.data.research['115'] || playerResponse.data.research['117'] || playerResponse.data.research['118'])) {
            startResearch = playerResponse.data.research;
            startPlayerName = playerName;
            applyStartResearch();
            return;
          }
        }
      }
    }

    // Second try: Load from spy reports
    const spyResponse = await api.get<SpyReportsResponse>(
      `/spy-reports/${koord.galaxy}/${koord.system}/${koord.position}/history?type=PLANET&lines=10`
    );
    if (spyResponse.ok && spyResponse.data && spyResponse.data.reports.length > 0) {
      for (const report of spyResponse.data.reports) {
        if (report.research &&
            (report.research['115'] || report.research['117'] || report.research['118'])) {
          startResearch = report.research;
          startPlayerName = playerName;
          applyStartResearch();
          return;
        }
      }
    }

    // No research found - keep current values
    startResearch = null;
    startPlayerName = null;
    researchSource = 'manual';
    updateResearchInfo();
  } catch (e) {
    console.error('[FlightCalc] Failed to load start research:', e);
  }
}

function applyStartResearch(): void {
  if (!startResearch) return;

  state.verbrennerStufe = startResearch['115'] || 0;
  state.impulseStufe = startResearch['117'] || 0;
  state.hyperStufe = startResearch['118'] || 0;
  researchSource = 'start';

  updateTechFields();
  updateResearchInfo();
}

function updateTechFields(): void {
  const verbrennerInput = document.getElementById('hg-tech-verbrenner') as HTMLInputElement;
  const impulseInput = document.getElementById('hg-tech-impulse') as HTMLInputElement;
  const hyperInput = document.getElementById('hg-tech-hyper') as HTMLInputElement;

  if (verbrennerInput) verbrennerInput.value = state.verbrennerStufe.toString();
  if (impulseInput) impulseInput.value = state.impulseStufe.toString();
  if (hyperInput) hyperInput.value = state.hyperStufe.toString();
}

function updateResearchInfo(): void {
  const infoDiv = document.getElementById('hg-research-info');
  if (!infoDiv) return;

  if (researchSource === 'start' && startPlayerName) {
    infoDiv.innerHTML = `
      <div style="padding: 8px; background: rgba(76, 175, 80, 0.2); border: 1px solid #4caf50; border-radius: 3px; font-size: 12px; color: #4caf50;">
        ${t('hub.flightCalc.techsFromPlayer').replace('{player}', `<strong>${startPlayerName}</strong>`)}
      </div>
    `;
  } else if (researchSource === 'own' && playerResearch) {
    const daysSince = researchUpdatedAt ? Math.floor((Date.now() - new Date(researchUpdatedAt.replace(' ', 'T')).getTime()) / (1000 * 60 * 60 * 24)) : null;
    if (daysSince !== null && daysSince > 3) {
      infoDiv.innerHTML = `
        <div style="padding: 8px; background: rgba(255, 152, 0, 0.2); border: 1px solid #ff9800; border-radius: 3px; font-size: 12px; color: #ff9800;">
          ${t('hub.flightCalc.techsOwnOld').replace('{days}', daysSince.toString())}
        </div>
      `;
    } else {
      infoDiv.innerHTML = `
        <div style="padding: 8px; background: rgba(74, 138, 186, 0.2); border: 1px solid #4a8aba; border-radius: 3px; font-size: 12px; color: #8cf;">
          ${t('hub.flightCalc.techsOwn')}
        </div>
      `;
    }
  } else {
    infoDiv.innerHTML = `
      <div style="padding: 8px; background: rgba(244, 67, 54, 0.2); border: 1px solid #f44336; border-radius: 3px; font-size: 12px; color: #f44336;">
        ${t('hub.flightCalc.techsManual')}
      </div>
    `;
  }
}

function formatCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCurrentDateTime(): string {
  const now = new Date();
  return `${now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}-${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function renderContent(): void {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div class="c" style="margin-bottom: 10px;">${t('hub.flightCalc.title')}</div>

    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <!-- Left Column: Inputs -->
      <div style="flex: 1; min-width: 300px;">
        ${renderInputFields()}
      </div>

      <!-- Right Column: Results -->
      <div style="flex: 1; min-width: 300px;">
        <div id="hg-calc-result" style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 15px;">
          <h3 style="color: #8cf; margin: 0 0 15px 0; font-size: 14px;">${t('hub.flightCalc.result')}</h3>
          <div id="hg-result-content">
            <span style="color: #888;">${t('hub.flightCalc.resultHint')}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  bindEvents();
  updateResearchInfo();
  updateSlowestShipDisplay();
}

function renderInputFields(): string {
  return `
    <!-- Coordinates -->
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
      <h3 style="color: #8cf; margin: 0 0 15px 0; font-size: 14px;">${t('hub.flightCalc.coordinates')}</h3>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 120px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.start')} (${t('hub.flightCalc.attacker')})</label>
          <input type="text" id="hg-start-koord" value="${state.startKoord}" placeholder="1:234:5" style="${inputStyle()}">
        </div>
        <div style="flex: 1; min-width: 120px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.target')}</label>
          <input type="text" id="hg-ziel-koord" value="${state.zielKoord}" placeholder="2:345:6" style="${inputStyle()}">
        </div>
      </div>
    </div>

    <!-- Tech with info -->
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="color: #8cf; margin: 0; font-size: 14px;">${t('hub.flightCalc.driveTech')} (${t('hub.flightCalc.attacker')})</h3>
        <div id="hg-research-info" style="flex-shrink: 0;"></div>
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 80px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.combustion')}</label>
          <input type="number" id="hg-tech-verbrenner" value="${state.verbrennerStufe}" min="0" max="30" style="${inputStyle()}">
        </div>
        <div style="flex: 1; min-width: 80px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.impulse')}</label>
          <input type="number" id="hg-tech-impulse" value="${state.impulseStufe}" min="0" max="30" style="${inputStyle()}">
        </div>
        <div style="flex: 1; min-width: 80px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.hyperspace')}</label>
          <input type="number" id="hg-tech-hyper" value="${state.hyperStufe}" min="0" max="30" style="${inputStyle()}">
        </div>
      </div>
    </div>

    <!-- Ship Selection (Multi-Select) -->
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="color: #8cf; margin: 0; font-size: 14px;">${t('hub.flightCalc.ships')}</h3>
        <div id="hg-slowest-ship" style="font-size: 12px; color: #ff9800;"></div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;">
        ${schiffIds.map(id => `
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 6px; background: ${selectedShips.has(id) ? 'rgba(74, 138, 186, 0.3)' : 'rgba(0,0,0,0.2)'}; border-radius: 3px; font-size: 11px; color: #ccc;">
            <input type="checkbox" class="hg-ship-checkbox" data-ship="${id}" ${selectedShips.has(id) ? 'checked' : ''} style="cursor: pointer;">
            ${getShipName(id)}
          </label>
        `).join('')}
      </div>
    </div>

    <!-- Calculation Mode -->
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
      <h3 style="color: #8cf; margin: 0 0 15px 0; font-size: 14px;">${t('hub.flightCalc.calcMode')}</h3>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: ${calcMode === 'startzeit' ? 'rgba(74, 138, 186, 0.3)' : 'rgba(0,0,0,0.2)'}; border-radius: 3px;">
          <input type="radio" name="calcMode" value="startzeit" ${calcMode === 'startzeit' ? 'checked' : ''} class="hg-calc-mode">
          <span style="color: #fff;">${t('hub.flightCalc.modeStartzeit')}</span>
          <span style="color: #888; font-size: 11px;">- ${t('hub.flightCalc.modeStartzeitDesc')}</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: ${calcMode === 'ankunftszeit' ? 'rgba(74, 138, 186, 0.3)' : 'rgba(0,0,0,0.2)'}; border-radius: 3px;">
          <input type="radio" name="calcMode" value="ankunftszeit" ${calcMode === 'ankunftszeit' ? 'checked' : ''} class="hg-calc-mode">
          <span style="color: #fff;">${t('hub.flightCalc.modeAnkunftszeit')}</span>
          <span style="color: #888; font-size: 11px;">- ${t('hub.flightCalc.modeAnkunftszeitDesc')}</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: ${calcMode === 'restzeit' ? 'rgba(74, 138, 186, 0.3)' : 'rgba(0,0,0,0.2)'}; border-radius: 3px;">
          <input type="radio" name="calcMode" value="restzeit" ${calcMode === 'restzeit' ? 'checked' : ''} class="hg-calc-mode">
          <span style="color: #fff;">${t('hub.flightCalc.modeRestzeit')}</span>
          <span style="color: #888; font-size: 11px;">- ${t('hub.flightCalc.modeRestzeitDesc')}</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: ${calcMode === 'abbruchzeit' ? 'rgba(74, 138, 186, 0.3)' : 'rgba(0,0,0,0.2)'}; border-radius: 3px;">
          <input type="radio" name="calcMode" value="abbruchzeit" ${calcMode === 'abbruchzeit' ? 'checked' : ''} class="hg-calc-mode">
          <span style="color: #fff;">${t('hub.flightCalc.modeAbbruchzeit') || 'Gegner-Timing'}</span>
          <span style="color: #888; font-size: 11px;">- ${t('hub.flightCalc.modeAbbruchzeitDesc') || 'Wann ist der Gegner nach Abbruch zurück?'}</span>
        </label>
      </div>
    </div>

    <!-- Time Inputs (dynamic based on mode) -->
    <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
      <h3 style="color: #8cf; margin: 0 0 15px 0; font-size: 14px;">${t('hub.flightCalc.time')}</h3>
      ${renderTimeInputs()}
    </div>

    <!-- Calculate Button -->
    <div style="text-align: center;">
      <button id="hg-berechnen-btn" style="
        background: #4caf50;
        color: #fff;
        border: none;
        padding: 12px 32px;
        cursor: pointer;
        border-radius: 5px;
        font-size: 14px;
        font-weight: bold;
      ">${t('hub.flightCalc.calculate')}</button>
    </div>
  `;
}

function renderTimeInputs(): string {
  if (calcMode === 'startzeit') {
    return `
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 120px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.startTime')}</label>
          <input type="text" id="hg-startzeit" value="${state.startzeit}" placeholder="HH:MM:SS" style="${inputStyle()}">
        </div>
        <div style="flex: 1; min-width: 120px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.speed')}</label>
          <select id="hg-geschwindigkeit" style="${selectStyle()}">
            ${geschwindigkeitsProzente.map(p => `<option value="${p}" ${state.geschwindigkeitProzent === p ? 'selected' : ''}>${p}%</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  } else if (calcMode === 'ankunftszeit') {
    return `
      <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 10px;">
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.arrivalTime')}</label>
          <input type="text" id="hg-ankunftszeit" value="${state.ankunftszeit}" placeholder="HH:MM:SS" style="${inputStyle()}">
        </div>
      </div>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; font-size: 11px; color: #888; margin-bottom: 3px;">${t('hub.flightCalc.approxStartTime')}</label>
          <input type="text" id="hg-ungefaehre-startzeit" value="${state.ungefaehreStartzeit}" placeholder="HH:MM:SS" style="${inputStyle()}; border-color: #666;">
        </div>
      </div>
    `;
  } else if (calcMode === 'restzeit') {
    return `
      <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 10px;">
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.remainingTime')}</label>
          <input type="text" id="hg-restflugzeit" value="${state.restflugzeit}" placeholder="HH:MM:SS" style="${inputStyle()}">
        </div>
      </div>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; font-size: 11px; color: #888; margin-bottom: 3px;">${t('hub.flightCalc.approxStartTime')}</label>
          <input type="text" id="hg-ungefaehre-startzeit" value="${state.ungefaehreStartzeit}" placeholder="HH:MM:SS" style="${inputStyle()}; border-color: #666;">
        </div>
      </div>
    `;
  } else { // abbruchzeit - enemy timing
    return `
      <div style="padding: 8px; background: rgba(255, 152, 0, 0.15); border: 1px solid #ff9800; border-radius: 3px; margin-bottom: 12px; font-size: 11px; color: #ff9800;">
        ${t('hub.flightCalc.enemyTimingHint') || 'Berechnet wann der Gegner nach Abbruch zurück ist'}
      </div>
      <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 10px;">
        <div style="flex: 1; min-width: 150px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.enemyDepartureTime') || 'Abflugzeit (Gegner)'}</label>
          <input type="text" id="hg-abflugzeit" value="${state.abflugzeit}" placeholder="HH:MM:SS" style="${inputStyle()}">
          <div style="font-size: 10px; color: #666; margin-top: 2px;">${t('hub.flightCalc.approximate') || 'ungefähr'}</div>
        </div>
        <div style="flex: 1; min-width: 150px;">
          <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.flightCalc.abortTime') || 'Abbruchzeit'}</label>
          <input type="text" id="hg-abbruchzeit" value="${state.abbruchzeit}" placeholder="HH:MM:SS" style="${inputStyle()}">
          <div style="font-size: 10px; color: #666; margin-top: 2px;">${t('hub.flightCalc.observed') || 'beobachtet'}</div>
        </div>
      </div>
    `;
  }
}

function updateSlowestShipDisplay(): void {
  const display = document.getElementById('hg-slowest-ship');
  if (!display) return;

  if (selectedShips.size === 0) {
    display.textContent = '';
    slowestShip = null;
    return;
  }

  // Calculate slowest ship based on current tech
  readState();
  const techWerte = {
    verbrennerStufe: state.verbrennerStufe,
    impulseStufe: state.impulseStufe,
    hyperStufe: state.hyperStufe
  };

  let minSpeed = Infinity;
  let slowest: string | null = null;

  selectedShips.forEach(ship => {
    const speed = getGeschwindigkeit(ship, techWerte);
    if (speed < minSpeed) {
      minSpeed = speed;
      slowest = ship;
    }
  });

  slowestShip = slowest;
  if (slowest) {
    display.innerHTML = `${t('hub.flightCalc.slowest')}: <strong>${getShipName(slowest)}</strong> (${minSpeed.toLocaleString('de-DE')})`;
  }
}

// === Calculation Functions ===

function parseKoord(koordinate: string): { galaxy: number; system: number; position: number } | null {
  const parts = koordinate.trim().split(':');
  if (parts.length !== 3) return null;

  const galaxy = parseInt(parts[0]);
  const system = parseInt(parts[1]);
  const position = parseInt(parts[2]);

  if (isNaN(galaxy) || isNaN(system) || isNaN(position)) return null;

  return { galaxy, system, position };
}

function berechneEntfernung(startKoordinate: string, zielkoordinate: string): number {
  const start = parseKoord(startKoordinate);
  const ziel = parseKoord(zielkoordinate);

  if (!start || !ziel) return 0;

  if (start.galaxy !== ziel.galaxy) {
    let diff = Math.abs(start.galaxy - ziel.galaxy);

    if (universeConfig.galaxy_wrapped) {
      const wrappedDiff = universeConfig.galaxies - diff;
      diff = Math.min(diff, wrappedDiff);
    }

    return diff * 20000;
  }

  if (start.system !== ziel.system) {
    return Math.abs(start.system - ziel.system) * 95 + 2700;
  }

  if (start.position !== ziel.position) {
    return Math.abs(start.position - ziel.position) * 5 + 1000;
  }

  return 5;
}

function getGeschwindigkeit(schiffstyp: string, techWerte: { verbrennerStufe: number; impulseStufe: number; hyperStufe: number }): number {
  const speed = getShipSpeed(schiffstyp, techWerte.verbrennerStufe, techWerte.impulseStufe, techWerte.hyperStufe);
  return speed || 1000;
}

/**
 * Calculate flight time in seconds from speed%, distance and ship speed
 * Formula: t = (3500 / speedPercent) * sqrt(distance * 10 / shipSpeed) + 10
 */
function flugzeitSekunden(geschwindigkeitsfaktor: number, entfernungValue: number, geschwindigkeitSchiff: number): number {
  const flugzeit = ((3500.0 / (geschwindigkeitsfaktor / 100)) *
    Math.pow((entfernungValue * 10.0 / geschwindigkeitSchiff), 0.5)) + 10.0;
  return Math.round(flugzeit);
}

/**
 * Back-calculate speed percentage from flight time, distance and ship speed
 * Formula: speedPercent = 3500 * sqrt(distance * 10 / shipSpeed) / (flugzeit - 10)
 */
function berechneGeschwindigkeitProzent(flugzeitS: number, entfernungValue: number, geschwindigkeitSchiff: number): number {
  if (flugzeitS <= 10) return 100; // Minimum flight time

  const speedPercent = (3500 * Math.sqrt(entfernungValue * 10 / geschwindigkeitSchiff)) / (flugzeitS - 10) * 100;
  return speedPercent;
}

/**
 * Find the closest valid speed percentage (10, 20, ... 100)
 * Returns the speed and possible alternatives
 */
function findClosestSpeed(exactSpeed: number): { closest: number; alternatives: number[] } {
  // Clamp to valid range
  const clamped = Math.max(10, Math.min(100, exactSpeed));

  // Find closest valid percentage
  const closest = Math.round(clamped / 10) * 10;

  // Find alternatives (one below and one above if valid)
  const alternatives: number[] = [];
  const lower = closest - 10;
  const upper = closest + 10;

  if (lower >= 10 && lower !== closest) alternatives.push(lower);
  if (upper <= 100 && upper !== closest) alternatives.push(upper);

  // Also add very close alternatives
  if (Math.abs(exactSpeed - (closest - 10)) < 5 && closest - 10 >= 10) {
    if (!alternatives.includes(closest - 10)) alternatives.unshift(closest - 10);
  }
  if (Math.abs(exactSpeed - (closest + 10)) < 5 && closest + 10 <= 100) {
    if (!alternatives.includes(closest + 10)) alternatives.push(closest + 10);
  }

  return { closest, alternatives: alternatives.slice(0, 2) };
}

function parseTimeString(timeStr: string): Date | null {
  if (!timeStr) return null;

  const now = new Date();

  if (timeStr.includes('-')) {
    // Format: DD.MM.YYYY-HH:MM:SS
    const [datePart, timePart] = timeStr.split('-');
    const [day, month, year] = datePart.split('.').map(Number);
    const timeParts = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0);
  } else {
    // Format: HH:MM:SS (today)
    const timeParts = timeStr.split(':').map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0);
  }
}

function addSecondsToDate(date: Date, seconds: number): Date {
  const result = new Date(date);
  result.setSeconds(result.getSeconds() + seconds);
  return result;
}

function formatDateSimple(date: Date): string {
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatFlugzeit(sekunden: number): string {
  const stunden = Math.floor(sekunden / 3600);
  const minuten = Math.floor((sekunden % 3600) / 60);
  const sek = Math.floor(sekunden % 60);
  return `${stunden}h ${minuten}m ${sek}s`;
}

function calculate(): void {
  const resultDiv = document.getElementById('hg-result-content');
  if (!resultDiv) return;

  readState();

  const koordRegex = /^\d+:\d{1,3}:\d{1,2}$/;
  const fehler: string[] = [];

  if (!koordRegex.test(state.startKoord)) {
    fehler.push(t('hub.flightCalc.errorStartCoord'));
  }
  if (!koordRegex.test(state.zielKoord)) {
    fehler.push(t('hub.flightCalc.errorTargetCoord'));
  }
  if (selectedShips.size === 0) {
    fehler.push(t('hub.flightCalc.errorNoShip'));
  }

  if (fehler.length > 0) {
    resultDiv.innerHTML = `<ul style="color: #f44336; margin: 0; padding-left: 20px;">${fehler.map(e => `<li>${e}</li>`).join('')}</ul>`;
    return;
  }

  const techWerte = {
    verbrennerStufe: state.verbrennerStufe,
    impulseStufe: state.impulseStufe,
    hyperStufe: state.hyperStufe
  };

  // Find slowest ship
  let minSpeed = Infinity;
  let slowestShipName = '';
  selectedShips.forEach(ship => {
    const speed = getGeschwindigkeit(ship, techWerte);
    if (speed < minSpeed) {
      minSpeed = speed;
      slowestShipName = ship;
    }
  });

  const entfernungValue = berechneEntfernung(state.startKoord, state.zielKoord);

  if (calcMode === 'startzeit') {
    calculateFromStartzeit(resultDiv, entfernungValue, minSpeed, slowestShipName, techWerte);
  } else if (calcMode === 'ankunftszeit') {
    calculateFromAnkunftszeit(resultDiv, entfernungValue, minSpeed, slowestShipName, techWerte);
  } else if (calcMode === 'restzeit') {
    calculateFromRestzeit(resultDiv, entfernungValue, minSpeed, slowestShipName, techWerte);
  } else {
    calculateFromAbbruchzeit(resultDiv);
  }
}

function calculateFromStartzeit(
  resultDiv: HTMLElement,
  entfernungValue: number,
  minSpeed: number,
  slowestShipName: string,
  techWerte: { verbrennerStufe: number; impulseStufe: number; hyperStufe: number }
): void {
  const startDate = parseTimeString(state.startzeit);
  if (!startDate) {
    resultDiv.innerHTML = `<span style="color: #f44336;">${t('hub.flightCalc.invalidStartTime')}</span>`;
    return;
  }

  const flugzeitS = flugzeitSekunden(state.geschwindigkeitProzent, entfernungValue, minSpeed);
  const ankunftszeit = addSecondsToDate(startDate, flugzeitS);
  const rueckkehrzeit = addSecondsToDate(startDate, flugzeitS * 2);

  resultDiv.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.flightTime')}</div>
      <div style="font-size: 20px; color: #4caf50; font-weight: bold;">${formatFlugzeit(flugzeitS)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.startTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(startDate)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.arrivalTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(ankunftszeit)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.returnTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(rueckkehrzeit)}</div>
    </div>
    ${renderResultFooter(slowestShipName, minSpeed, entfernungValue, techWerte, state.geschwindigkeitProzent)}
  `;
}

function calculateFromAnkunftszeit(
  resultDiv: HTMLElement,
  entfernungValue: number,
  minSpeed: number,
  slowestShipName: string,
  techWerte: { verbrennerStufe: number; impulseStufe: number; hyperStufe: number }
): void {
  const ankunftDate = parseTimeString(state.ankunftszeit);
  if (!ankunftDate) {
    resultDiv.innerHTML = `<span style="color: #f44336;">${t('hub.flightCalc.invalidArrivalTime')}</span>`;
    return;
  }

  // If we have approximate start time, calculate exact flight time
  let estimatedFlugzeitS: number;
  let startDate: Date;

  if (state.ungefaehreStartzeit) {
    const ungefaehrStart = parseTimeString(state.ungefaehreStartzeit);
    if (ungefaehrStart) {
      // Calculate flight time from difference
      estimatedFlugzeitS = Math.round((ankunftDate.getTime() - ungefaehrStart.getTime()) / 1000);
      startDate = ungefaehrStart;
    } else {
      // Fallback: assume flight started some time ago
      estimatedFlugzeitS = 3600; // Default 1 hour
      startDate = addSecondsToDate(ankunftDate, -estimatedFlugzeitS);
    }
  } else {
    // No start time hint - we need to estimate
    // Use current time as reference for "when did it start"
    const now = new Date();
    estimatedFlugzeitS = Math.round((ankunftDate.getTime() - now.getTime()) / 1000);
    if (estimatedFlugzeitS < 60) estimatedFlugzeitS = 3600; // If arrival is very soon/past, assume 1h flight
    startDate = addSecondsToDate(ankunftDate, -estimatedFlugzeitS);
  }

  // Back-calculate speed percentage
  const exactSpeed = berechneGeschwindigkeitProzent(estimatedFlugzeitS, entfernungValue, minSpeed);
  const { closest, alternatives } = findClosestSpeed(exactSpeed);

  // Calculate times for the closest speed
  const actualFlugzeitS = flugzeitSekunden(closest, entfernungValue, minSpeed);
  const actualStartDate = addSecondsToDate(ankunftDate, -actualFlugzeitS);
  const rueckkehrzeit = addSecondsToDate(actualStartDate, actualFlugzeitS * 2);

  resultDiv.innerHTML = `
    <div style="margin-bottom: 12px; padding: 10px; background: rgba(255, 193, 7, 0.2); border-radius: 3px;">
      <div style="font-size: 11px; color: #ffc107; margin-bottom: 2px;">${t('hub.flightCalc.estimatedSpeed')}</div>
      <div style="font-size: 24px; color: #fff; font-weight: bold;">${closest}%</div>
      ${alternatives.length > 0 ? `<div style="font-size: 11px; color: #888; margin-top: 4px;">${t('hub.flightCalc.alternative')}: ${alternatives.join('%, ')}%</div>` : ''}
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${t('hub.flightCalc.exactValue')}: ${exactSpeed.toFixed(1)}%</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.flightTime')} (${t('hub.flightCalc.totalAt')} ${closest}%)</div>
      <div style="font-size: 20px; color: #4caf50; font-weight: bold;">${formatFlugzeit(actualFlugzeitS)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.calculatedStartTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(actualStartDate)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.arrivalTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(ankunftDate)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.returnTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(rueckkehrzeit)}</div>
    </div>
    ${renderResultFooter(slowestShipName, minSpeed, entfernungValue, techWerte, closest)}
  `;
}

function calculateFromRestzeit(
  resultDiv: HTMLElement,
  entfernungValue: number,
  minSpeed: number,
  slowestShipName: string,
  techWerte: { verbrennerStufe: number; impulseStufe: number; hyperStufe: number }
): void {
  // Parse remaining time as HH:MM:SS
  const restParts = state.restflugzeit.split(':').map(Number);
  const restSekundenBisAnkunft = (restParts[0] || 0) * 3600 + (restParts[1] || 0) * 60 + (restParts[2] || 0);

  if (restSekundenBisAnkunft <= 0) {
    resultDiv.innerHTML = `<span style="color: #f44336;">${t('hub.flightCalc.invalidRemainingTime')}</span>`;
    return;
  }

  const now = new Date();
  const ankunftDate = addSecondsToDate(now, restSekundenBisAnkunft);

  // If we have approximate start time, calculate total flight time
  let estimatedGesamtFlugzeitS: number;

  if (state.ungefaehreStartzeit) {
    const ungefaehrStart = parseTimeString(state.ungefaehreStartzeit);
    if (ungefaehrStart) {
      // Total flight time = time from start to now + remaining time
      const vergangeneZeit = Math.round((now.getTime() - ungefaehrStart.getTime()) / 1000);
      estimatedGesamtFlugzeitS = vergangeneZeit + restSekundenBisAnkunft;
    } else {
      // Can't estimate without start time - use double remaining (assume halfway)
      estimatedGesamtFlugzeitS = restSekundenBisAnkunft * 2;
    }
  } else {
    // No start time hint - assume we're about halfway (conservative estimate)
    estimatedGesamtFlugzeitS = restSekundenBisAnkunft * 2;
  }

  // Back-calculate speed percentage
  const exactSpeed = berechneGeschwindigkeitProzent(estimatedGesamtFlugzeitS, entfernungValue, minSpeed);
  const { closest, alternatives } = findClosestSpeed(exactSpeed);

  // Calculate actual times for the closest speed
  const actualFlugzeitS = flugzeitSekunden(closest, entfernungValue, minSpeed);
  const actualStartDate = addSecondsToDate(ankunftDate, -actualFlugzeitS);
  const rueckkehrzeit = addSecondsToDate(actualStartDate, actualFlugzeitS * 2);

  // Calculate time passed since start
  const vergangeneZeit = actualFlugzeitS - restSekundenBisAnkunft;
  const prozentVerstrichen = Math.round((vergangeneZeit / actualFlugzeitS) * 100);

  resultDiv.innerHTML = `
    <div style="margin-bottom: 12px; padding: 10px; background: rgba(255, 193, 7, 0.2); border-radius: 3px;">
      <div style="font-size: 11px; color: #ffc107; margin-bottom: 2px;">${t('hub.flightCalc.estimatedSpeed')}</div>
      <div style="font-size: 24px; color: #fff; font-weight: bold;">${closest}%</div>
      ${alternatives.length > 0 ? `<div style="font-size: 11px; color: #888; margin-top: 4px;">${t('hub.flightCalc.alternative')}: ${alternatives.join('%, ')}%</div>` : ''}
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${t('hub.flightCalc.exactValue')}: ${exactSpeed.toFixed(1)}%</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.flightProgress')}</div>
      <div style="background: #1a2a3a; border-radius: 3px; height: 20px; overflow: hidden;">
        <div style="background: #4caf50; width: ${prozentVerstrichen}%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff;">
          ${prozentVerstrichen}%
        </div>
      </div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.flightTime')} (${t('hub.flightCalc.totalAt')} ${closest}%)</div>
      <div style="font-size: 20px; color: #4caf50; font-weight: bold;">${formatFlugzeit(actualFlugzeitS)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.remainingTime')}</div>
      <div style="font-size: 14px; color: #ff9800;">${formatFlugzeit(restSekundenBisAnkunft)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.calculatedStartTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(actualStartDate)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.arrivalTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(ankunftDate)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.returnTime')}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(rueckkehrzeit)}</div>
    </div>
    ${renderResultFooter(slowestShipName, minSpeed, entfernungValue, techWerte, closest)}
  `;
}

function calculateFromAbbruchzeit(resultDiv: HTMLElement): void {
  // Enemy timing: Calculate when enemy returns after they abort
  // Formula: Enemy Return = 2 × AbortTime - DepartureTime
  const abflugDate = parseTimeString(state.abflugzeit);
  const abbruchDate = parseTimeString(state.abbruchzeit);

  if (!abflugDate) {
    resultDiv.innerHTML = `<span style="color: #f44336;">${t('hub.flightCalc.invalidDepartureTime') || 'Ungültige Abflugzeit'}</span>`;
    return;
  }

  if (!abbruchDate) {
    resultDiv.innerHTML = `<span style="color: #f44336;">${t('hub.flightCalc.invalidAbortTime') || 'Ungültige Abbruchzeit'}</span>`;
    return;
  }

  // Abort must be after departure
  if (abbruchDate.getTime() <= abflugDate.getTime()) {
    resultDiv.innerHTML = `<span style="color: #f44336;">${t('hub.flightCalc.abortBeforeDeparture') || 'Abbruchzeit muss nach Abflugzeit sein'}</span>`;
    return;
  }

  // Calculate enemy return time: Return = 2 × Abort - Departure
  // The time from departure to abort = abort - departure
  // The time from abort back home = same as departure to abort
  // So total: return = abort + (abort - departure) = 2*abort - departure
  const rueckkehrTimeMs = 2 * abbruchDate.getTime() - abflugDate.getTime();
  const rueckkehrDate = new Date(rueckkehrTimeMs);

  // Calculate one-way flight time (from departure to abort point)
  const flownTimeS = Math.round((abbruchDate.getTime() - abflugDate.getTime()) / 1000);

  // Calculate time until enemy returns
  const now = new Date();
  const timeUntilReturnMs = rueckkehrDate.getTime() - now.getTime();
  const timeUntilReturnS = Math.round(timeUntilReturnMs / 1000);

  resultDiv.innerHTML = `
    <div style="margin-bottom: 12px; padding: 15px; background: rgba(76, 175, 80, 0.2); border: 1px solid #4caf50; border-radius: 5px;">
      <div style="font-size: 11px; color: #4caf50; margin-bottom: 4px;">${t('hub.flightCalc.enemyReturnsAt') || 'Gegner zurück um'}</div>
      <div style="font-size: 28px; color: #fff; font-weight: bold;">${formatDateSimple(rueckkehrDate)}</div>
      ${timeUntilReturnS > 0
        ? `<div style="font-size: 12px; color: #ffc107; margin-top: 8px;">⏱ ${t('hub.flightCalc.inTime') || 'In'} ${formatFlugzeit(timeUntilReturnS)}</div>`
        : `<div style="font-size: 12px; color: #4caf50; margin-top: 8px;">✓ ${t('hub.flightCalc.alreadyReturned') || 'Bereits zurück!'}</div>`
      }
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.enemyDepartureTime') || 'Abflugzeit (Gegner)'}</div>
      <div style="font-size: 14px; color: #8cf;">${formatDateSimple(abflugDate)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.abortTime') || 'Abbruchzeit'}</div>
      <div style="font-size: 14px; color: #ff9800;">${formatDateSimple(abbruchDate)}</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 2px;">${t('hub.flightCalc.flownTime') || 'Geflogene Zeit'}</div>
      <div style="font-size: 14px; color: #4caf50;">${formatFlugzeit(flownTimeS)}</div>
    </div>
    <hr style="border: none; border-top: 1px solid #4a8aba; margin: 15px 0;">
    <div style="font-size: 11px; color: #666;">
      ${t('hub.flightCalc.enemyAbortExplanation') || 'Nach Abbruch fliegt der Gegner die gleiche Zeit zurück, die er bereits unterwegs war. Rückkehr = 2×Abbruch - Abflug'}
    </div>
  `;
}

function renderResultFooter(
  slowestShipName: string,
  minSpeed: number,
  entfernungValue: number,
  techWerte: { verbrennerStufe: number; impulseStufe: number; hyperStufe: number },
  geschwindigkeit: number
): string {
  return `
    <hr style="border: none; border-top: 1px solid #4a8aba; margin: 15px 0;">
    <div style="display: flex; gap: 20px; flex-wrap: wrap; font-size: 12px; color: #aaa;">
      <div>
        <span style="color: #666;">${t('hub.flightCalc.slowest')}:</span>
        <span style="color: #fff;">${getShipName(slowestShipName)}</span>
      </div>
      <div>
        <span style="color: #666;">${t('hub.flightCalc.shipSpeed')}:</span>
        <span style="color: #fff;">${minSpeed.toLocaleString('de-DE')}</span>
      </div>
      <div>
        <span style="color: #666;">${t('hub.flightCalc.distance')}:</span>
        <span style="color: #fff;">${entfernungValue.toLocaleString('de-DE')}</span>
      </div>
      <div>
        <span style="color: #666;">${t('hub.flightCalc.tech')}:</span>
        <span style="color: #fff;">${techWerte.verbrennerStufe}/${techWerte.impulseStufe}/${techWerte.hyperStufe}</span>
      </div>
      <div>
        <span style="color: #666;">${t('hub.flightCalc.speed')}:</span>
        <span style="color: #fff;">${geschwindigkeit}%</span>
      </div>
    </div>
  `;
}

function readState(): void {
  state.verbrennerStufe = parseInt((document.getElementById('hg-tech-verbrenner') as HTMLInputElement)?.value) || 0;
  state.impulseStufe = parseInt((document.getElementById('hg-tech-impulse') as HTMLInputElement)?.value) || 0;
  state.hyperStufe = parseInt((document.getElementById('hg-tech-hyper') as HTMLInputElement)?.value) || 0;
  state.startKoord = (document.getElementById('hg-start-koord') as HTMLInputElement)?.value || '1:1:1';
  state.zielKoord = (document.getElementById('hg-ziel-koord') as HTMLInputElement)?.value || '1:1:2';
  state.geschwindigkeitProzent = parseInt((document.getElementById('hg-geschwindigkeit') as HTMLSelectElement)?.value) || 100;
  state.startzeit = (document.getElementById('hg-startzeit') as HTMLInputElement)?.value || '';
  state.ankunftszeit = (document.getElementById('hg-ankunftszeit') as HTMLInputElement)?.value || '';
  state.ungefaehreStartzeit = (document.getElementById('hg-ungefaehre-startzeit') as HTMLInputElement)?.value || '';
  state.restflugzeit = (document.getElementById('hg-restflugzeit') as HTMLInputElement)?.value || '';
  state.abflugzeit = (document.getElementById('hg-abflugzeit') as HTMLInputElement)?.value || '';
  state.abbruchzeit = (document.getElementById('hg-abbruchzeit') as HTMLInputElement)?.value || '';
}

// === Styling ===

function inputStyle(): string {
  return `
    width: 100%;
    padding: 8px;
    background: #1a2a3a;
    color: #fff;
    border: 1px solid #4a8aba;
    border-radius: 3px;
    font-size: 13px;
    text-align: center;
  `;
}

function selectStyle(): string {
  return `
    width: 100%;
    padding: 8px;
    background: #1a2a3a;
    color: #fff;
    border: 1px solid #4a8aba;
    border-radius: 3px;
    font-size: 13px;
  `;
}

// === Event Binding ===

let startKoordDebounce: ReturnType<typeof setTimeout> | null = null;

function bindEvents(): void {
  if (!containerElement) return;

  // Calculate button
  document.getElementById('hg-berechnen-btn')?.addEventListener('click', calculate);

  // Start coordinate change - load START player's research (attacker's techs)
  const startInput = document.getElementById('hg-start-koord');
  startInput?.addEventListener('input', () => {
    if (startKoordDebounce) clearTimeout(startKoordDebounce);
    startKoordDebounce = setTimeout(async () => {
      const value = (startInput as HTMLInputElement).value;
      const koordRegex = /^\d+:\d{1,3}:\d{1,2}$/;
      if (koordRegex.test(value)) {
        await loadStartResearch(value);
      }
    }, 500);
  });

  // Calculation mode change
  containerElement.querySelectorAll('.hg-calc-mode').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      calcMode = target.value as CalcMode;
      renderContent();
    });
  });

  // Ship checkboxes
  containerElement.querySelectorAll('.hg-ship-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const ship = target.dataset.ship || '';
      if (target.checked) {
        selectedShips.add(ship);
      } else {
        selectedShips.delete(ship);
      }
      // Update visual state
      const label = target.closest('label');
      if (label) {
        label.style.background = target.checked ? 'rgba(74, 138, 186, 0.3)' : 'rgba(0,0,0,0.2)';
      }
      updateSlowestShipDisplay();
    });
  });

  // Tech changes update slowest ship
  ['hg-tech-verbrenner', 'hg-tech-impulse', 'hg-tech-hyper'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      researchSource = 'manual';
      updateResearchInfo();
      updateSlowestShipDisplay();
    });
  });

  // Enter key triggers calculation
  containerElement.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        calculate();
      }
    });
  });
}
