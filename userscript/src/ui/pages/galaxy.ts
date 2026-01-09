/**
 * Galaxy page enhancements
 * - Add spy report columns (resources, timestamp)
 * - Detect planet changes (new/destroyed)
 * - Sync button for manual DB update
 */

import { api } from '../../api/client';
import { storage } from '../../utils/storage';
import { debugLog } from '../../utils/formatting';

interface GalaxyPlanetInfo {
  id: number;
  name: string | null;
  player_id: number;
  coordinates: string;
  planet: number;
  type: string;
  planet_id: number | null;  // pr0game internal planet ID for sync comparison
}

interface GalaxySpyReport {
  planet: number;
  type: string;
  resources: Record<string, number> | null;
  report_time: string | null;
  created_at: string | null;
}

interface GalaxySystemResponse {
  planets: GalaxyPlanetInfo[];
  spy_reports: GalaxySpyReport[];
  last_scan_at: string | null;
}

interface PagePlanet {
  position: number;
  hasPlanet: boolean;
  planetName: string | null;
  playerId: number | null;
  playerName: string | null;
  allianceId: number | null;  // Alliance ID from galaxy page
  allianceTag: string | null;  // Alliance tag from galaxy page
  hasMoon: boolean;
  moonName: string | null;
  planetId: number | null;  // pr0game internal planet ID (from spy links)
  moonId: number | null;  // pr0game internal moon ID
  row: HTMLElement;  // Can be div or tr
}

interface PlanetDiff {
  position: number;
  type: 'new' | 'destroyed' | 'moon_new' | 'moon_destroyed' | 'name_changed';
  pageData: PagePlanet | null;
  dbData: GalaxyPlanetInfo | null;
}

let currentDiffs: PlanetDiff[] = [];
let pendingSyncData: PagePlanet[] = [];

/**
 * Initialize galaxy page enhancements
 */
export function initGalaxyPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'galaxy') {
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] Galaxy: Not configured, skipping');
    return;
  }

  console.log('[HG Hub] Galaxy: Initializing...');

  // Wait for page to be fully loaded
  setTimeout(() => {
    void enhanceGalaxyView();
  }, 500);
}

async function enhanceGalaxyView(): Promise<void> {
  const galaxy = getGalaxyCoords();
  if (!galaxy) {
    console.warn('[HG Hub] Galaxy: Could not determine coordinates');
    return;
  }

  debugLog(`Galaxy: Loading data for ${galaxy.g}:${galaxy.s}`);

  // Find the galaxy container (can be table or div grid)
  const container = findGalaxyContainer();
  if (!container) {
    console.warn('[HG Hub] Galaxy: Container not found');
    return;
  }

  // Parse planets from page FIRST
  const pagePlanets = parsePlanetsFromPage(container);
  console.log('[HG Hub] Page planets:', pagePlanets);

  // Initialize with empty data
  let dbPlanets: GalaxyPlanetInfo[] = [];
  let spy_reports: GalaxySpyReport[] = [];
  let lastScanAt: string | null = null;

  try {
    // Load data from server
    const response = await api.get<GalaxySystemResponse>(`/galaxy/${galaxy.g}/${galaxy.s}`);

    if (response.ok && response.data) {
      dbPlanets = response.data.planets;
      spy_reports = response.data.spy_reports;
      lastScanAt = response.data.last_scan_at;
      debugLog('Galaxy: DB planets:', dbPlanets);
      debugLog('Galaxy: Spy reports:', spy_reports);
      debugLog('Galaxy: Last scan at:', lastScanAt);
    } else {
      debugLog('Galaxy: No data from server (empty system in DB)');
    }
  } catch (error) {
    console.warn('[HG Hub] Galaxy: API error, continuing without DB data', error);
  }

  // Add spy report columns only if there's data OR in dev mode
  const hasSpyData = spy_reports.length > 0;
  if (hasSpyData || window.HG_HUB.devMode) {
    addSpyReportColumns(container, spy_reports, pagePlanets);
  }

  // Count actual planets on page (not empty slots)
  const pagePlanetsWithData = pagePlanets.filter(p => p.hasPlanet);
  // Count planets in DB for this system
  const dbPlanetsCount = dbPlanets.filter(p => p.type === 'PLANET').length;

  debugLog(`Galaxy: Page has ${pagePlanetsWithData.length} planets, DB has ${dbPlanetsCount} planets`);

  // Detect differences - only if counts don't match or specific changes
  const diffs = detectDifferences(pagePlanets, dbPlanets);
  currentDiffs = diffs;
  pendingSyncData = pagePlanets;

  debugLog(`Galaxy: ${diffs.length} differences detected`);

  // Show sync button if there are differences OR if system is empty and not yet scanned
  if (diffs.length > 0) {
    highlightDifferences(diffs, pagePlanets);
    showSyncButton(galaxy.g, galaxy.s, container, diffs.length, false);
  } else if (pagePlanetsWithData.length === 0 && !lastScanAt) {
    // Empty system not yet scanned - show button to mark as scanned
    showSyncButton(galaxy.g, galaxy.s, container, 0, true);
  }

  debugLog(`Galaxy: Enhanced, ${spy_reports.length} spy reports, ${diffs.length} diffs`);
}

function getGalaxyCoords(): { g: number; s: number } | null {
  const galaxyInput = document.querySelector('input[name="galaxy"]') as HTMLInputElement;
  const systemInput = document.querySelector('input[name="system"]') as HTMLInputElement;

  if (!galaxyInput || !systemInput) {
    return null;
  }

  return {
    g: parseInt(galaxyInput.value, 10),
    s: parseInt(systemInput.value, 10)
  };
}

function findGalaxyContainer(): HTMLElement | null {
  // First try: CSS Grid container (newer pr0game versions)
  const gridContainer = document.querySelector('.galaxy-grid-container');
  if (gridContainer) {
    debugLog('Galaxy: Found grid container');
    return gridContainer as HTMLElement;
  }

  // Second try: HTML table with position rows
  const tables = document.querySelectorAll('table');
  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    let positionCount = 0;
    for (const row of rows) {
      const firstTd = row.querySelector('td:first-child');
      if (firstTd) {
        const num = parseInt(firstTd.textContent?.trim() || '', 10);
        if (num >= 1 && num <= 15) {
          positionCount++;
        }
      }
    }
    if (positionCount >= 3) {
      debugLog(`Galaxy: Found table by position count (${positionCount} rows)`);
      return table as HTMLElement;
    }
  }

  debugLog('Galaxy: No container found');
  return null;
}

function parsePlanetsFromPage(container: HTMLElement): PagePlanet[] {
  const planets: PagePlanet[] = [];

  // Check if it's a grid container or table
  const isGrid = container.classList.contains('galaxy-grid-container');

  if (isGrid) {
    // Parse from CSS grid structure
    const rows = container.querySelectorAll('.galaxy-grid-row[data-info^="p_"]');

    rows.forEach((row) => {
      const dataInfo = row.getAttribute('data-info') || '';
      const posMatch = dataInfo.match(/p_(\d+)/);
      if (!posMatch) return;

      const position = parseInt(posMatch[1], 10);
      if (position < 1 || position > 15) return;

      // Check if row is empty (no planet)
      const isEmpty = row.classList.contains('empty');

      let planetName: string | null = null;
      let playerId: number | null = null;
      let playerName: string | null = null;
      let allianceId: number | null = null;
      let allianceTag: string | null = null;
      let hasMoon = false;
      let moonName: string | null = null;
      let planetId: number | null = null;
      let moonId: number | null = null;

      if (!isEmpty) {
        // Look for player ID and name in span[playerid] attribute (most reliable)
        const playerSpan = row.querySelector('span[playerid]');
        if (playerSpan) {
          const playerIdAttr = playerSpan.getAttribute('playerid');
          if (playerIdAttr) {
            playerId = parseInt(playerIdAttr, 10);
          }
          // Player name is the text content of the span
          playerName = playerSpan.textContent?.trim() || null;
        }

        // Look for alliance ID and tag
        const allianceSpan = row.querySelector('span[allianceid]');
        if (allianceSpan) {
          const allianceIdAttr = allianceSpan.getAttribute('allianceid');
          if (allianceIdAttr) {
            allianceId = parseInt(allianceIdAttr, 10);
          }
          allianceTag = allianceSpan.textContent?.trim() || null;
        }
        // Fallback: look for alliance link
        if (!allianceId) {
          const allianceLink = row.querySelector('a[href*="page=alliance"]');
          if (allianceLink) {
            const href = allianceLink.getAttribute('href') || '';
            const onclick = allianceLink.getAttribute('onclick') || '';
            const idMatch = href.match(/id=(\d+)/) || onclick.match(/id=(\d+)/);
            if (idMatch) {
              allianceId = parseInt(idMatch[1], 10);
            }
            allianceTag = allianceLink.textContent?.trim() || null;
          }
        }

        // Look for planet name in the planet column
        const planetItem = row.querySelector('.galaxy-grid-item.galaxy-planet');
        if (planetItem) {
          // Planet name is usually in a tooltip or span
          const planetTooltip = planetItem.querySelector('[data-tooltip-content]');
          if (planetTooltip) {
            // Try to extract planet name from tooltip
            const tooltipHtml = planetTooltip.getAttribute('data-tooltip-content') || '';
            // Look for planet name pattern in tooltip
            const nameMatch = tooltipHtml.match(/<th[^>]*>([^<]+)<\/th>/);
            if (nameMatch) {
              planetName = nameMatch[1].trim();
            }
          }
          // Fallback: use text content
          if (!planetName) {
            planetName = planetItem.textContent?.trim() || null;
          }
        }

        // Look for player ID and planet ID in links
        const allLinks = row.querySelectorAll('a');
        allLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          const onclick = link.getAttribute('onclick') || '';
          const tooltip = link.getAttribute('data-tooltip-content') || '';

          // Player ID
          if (!playerId) {
            const playerMatch = href.match(/who=(\d+)/) ||
                                onclick.match(/Playercard\((\d+)\)/) ||
                                tooltip.match(/Playercard\((\d+)\)/);
            if (playerMatch) {
              playerId = parseInt(playerMatch[1], 10);
            }
          }

          // Planet ID from spy/fleet links (cp= or planetID=)
          if (!planetId) {
            const planetIdMatch = href.match(/[?&]cp=(\d+)/) ||
                                  href.match(/[?&]planetID=(\d+)/) ||
                                  onclick.match(/cp[=:](\d+)/) ||
                                  onclick.match(/planetID[=:](\d+)/);
            if (planetIdMatch) {
              // Only capture if it's a planet link (planettype=1)
              if (href.includes('planettype=1') || !href.includes('planettype=')) {
                planetId = parseInt(planetIdMatch[1], 10);
              }
            }
          }
        });

        // Moon detection - check for moon column
        const moonItem = row.querySelector('.galaxy-grid-item[class*="moon"]');
        if (moonItem && moonItem.innerHTML.trim().length > 0) {
          const moonHtml = moonItem.innerHTML.toLowerCase();
          if (moonHtml.includes('img') || moonHtml.includes('moon') || moonHtml.includes('mond')) {
            hasMoon = true;
            // Try to get moon name from tooltip
            const moonTooltip = moonItem.querySelector('[data-tooltip-content]');
            if (moonTooltip) {
              const tooltipHtml = moonTooltip.getAttribute('data-tooltip-content') || '';
              const nameMatch = tooltipHtml.match(/<th[^>]*>([^<]+)<\/th>/);
              if (nameMatch) {
                moonName = nameMatch[1].trim();
              }
            }

            // Look for moon ID in links
            const moonLinks = moonItem.querySelectorAll('a');
            moonLinks.forEach(link => {
              const href = link.getAttribute('href') || '';
              const moonIdMatch = href.match(/[?&]cp=(\d+)/) ||
                                  href.match(/[?&]planetID=(\d+)/);
              if (moonIdMatch && !moonId) {
                moonId = parseInt(moonIdMatch[1], 10);
              }
            });
          }
        }
      }

      planets.push({
        position,
        hasPlanet: !isEmpty,
        planetName,
        playerId,
        playerName,
        allianceId,
        allianceTag,
        hasMoon,
        moonName,
        planetId,
        moonId,
        row: row as HTMLElement
      });
    });
  } else {
    // Parse from HTML table structure (fallback)
    const rows = container.querySelectorAll('tr');

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;

      const posText = cells[0].textContent?.trim();
      const position = parseInt(posText || '', 10);

      if (isNaN(position) || position < 1 || position > 15) return;

      const planetCell = cells[1];
      const planetText = planetCell?.textContent?.trim() || '';
      const hasPlanetContent = planetText.length > 0 && planetText !== '-';

      let planetName: string | null = null;
      let playerId: number | null = null;
      let playerName: string | null = null;
      let allianceId: number | null = null;
      let allianceTag: string | null = null;
      let hasMoon = false;
      let moonName: string | null = null;
      let planetId: number | null = null;
      let moonId: number | null = null;

      // Look for player ID and name in span[playerid] attribute (most reliable)
      const playerSpan = row.querySelector('span[playerid]');
      if (playerSpan) {
        const playerIdAttr = playerSpan.getAttribute('playerid');
        if (playerIdAttr) {
          playerId = parseInt(playerIdAttr, 10);
        }
        playerName = playerSpan.textContent?.trim() || null;
      }

      // Look for alliance ID and tag
      const allianceSpan = row.querySelector('span[allianceid]');
      if (allianceSpan) {
        const allianceIdAttr = allianceSpan.getAttribute('allianceid');
        if (allianceIdAttr) {
          allianceId = parseInt(allianceIdAttr, 10);
        }
        allianceTag = allianceSpan.textContent?.trim() || null;
      }
      // Fallback: look for alliance link
      if (!allianceId) {
        const allianceLink = row.querySelector('a[href*="page=alliance"]');
        if (allianceLink) {
          const href = allianceLink.getAttribute('href') || '';
          const onclick = allianceLink.getAttribute('onclick') || '';
          const idMatch = href.match(/id=(\d+)/) || onclick.match(/id=(\d+)/);
          if (idMatch) {
            allianceId = parseInt(idMatch[1], 10);
          }
          allianceTag = allianceLink.textContent?.trim() || null;
        }
      }

      // Get planet name from tooltip or text
      if (hasPlanetContent) {
        const planetTooltip = planetCell?.querySelector('[data-tooltip-content]');
        if (planetTooltip) {
          const tooltipHtml = planetTooltip.getAttribute('data-tooltip-content') || '';
          const nameMatch = tooltipHtml.match(/<th[^>]*>([^<]+)<\/th>/);
          if (nameMatch) {
            planetName = nameMatch[1].trim();
          }
        }
        if (!planetName) {
          planetName = planetText;
        }
      }

      // Look for player ID, planet ID, and moon info in links
      const planetLinks = row.querySelectorAll('a');
      planetLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const onclick = link.getAttribute('onclick') || '';
        const tooltip = link.getAttribute('data-tooltip-content') || '';

        // Player ID
        if (!playerId) {
          const playerMatch = tooltip.match(/Playercard\((\d+)\)/) ||
                              onclick.match(/Playercard\((\d+)\)/) ||
                              href.match(/who=(\d+)/);
          if (playerMatch) {
            playerId = parseInt(playerMatch[1], 10);
          }
        }

        // Planet ID from spy/fleet links
        if (!planetId) {
          const planetIdMatch = href.match(/[?&]cp=(\d+)/) ||
                                href.match(/[?&]planetID=(\d+)/);
          if (planetIdMatch) {
            if (href.includes('planettype=1') || !href.includes('planettype=')) {
              planetId = parseInt(planetIdMatch[1], 10);
            }
          }
        }

        // Moon detection
        const moonMatch = href.match(/type=3/) || tooltip.match(/type=3/);
        if (moonMatch) {
          hasMoon = true;
          // Try to get moon ID
          const moonIdMatch = href.match(/[?&]cp=(\d+)/) ||
                              href.match(/[?&]planetID=(\d+)/);
          if (moonIdMatch && href.includes('planettype=3')) {
            moonId = parseInt(moonIdMatch[1], 10);
          }
        }
      });

      planets.push({
        position,
        hasPlanet: hasPlanetContent,
        planetName,
        playerId,
        playerName,
        allianceId,
        allianceTag,
        hasMoon,
        moonName,
        planetId,
        moonId,
        row: row as HTMLElement
      });
    });
  }

  return planets;
}

interface SpyReportDisplayData {
  spio: string;
  metal: string;
  crystal: string;
  deuterium: string;
}

function extractReportDisplayData(report: GalaxySpyReport | undefined): SpyReportDisplayData {
  const result: SpyReportDisplayData = { spio: '-', metal: '-', crystal: '-', deuterium: '-' };

  if (report?.resources) {
    result.metal = formatNumber(report.resources['901'] || 0);
    result.crystal = formatNumber(report.resources['902'] || 0);
    result.deuterium = formatNumber(report.resources['903'] || 0);

    if (report.report_time) {
      result.spio = formatTimestamp(report.report_time);
    } else if (report.created_at) {
      result.spio = formatTimestamp(report.created_at);
    }
  }

  return result;
}

function addSpyReportColumns(container: HTMLElement, spyReports: GalaxySpyReport[], pagePlanets: PagePlanet[]): void {
  // Create a map for quick lookup
  const reportMap = new Map<string, GalaxySpyReport>();
  spyReports.forEach(report => {
    const key = `${report.planet}-${report.type}`;
    reportMap.set(key, report);
  });

  const isGrid = container.classList.contains('galaxy-grid-container');

  if (isGrid) {
    // Adjust grid to accommodate new columns (original 7 + 4 new = 11)
    const allRows = container.querySelectorAll('.galaxy-grid-row');
    allRows.forEach(row => {
      (row as HTMLElement).style.gridColumn = 'span 11';
    });

    // Add columns to CSS grid - need to add items to header and each row
    const headerRow = container.querySelector('.galaxy-grid-row.header');
    if (headerRow) {
      // Add header items
      const headers = [
        { text: 'Spio', color: '#888' },
        { text: 'MET', color: '#c0c0c0' },
        { text: 'CRY', color: '#87ceeb' },
        { text: 'DEU', color: '#98fb98' }
      ];
      headers.forEach(h => {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'galaxy-grid-header hg-hub-col';
        headerDiv.textContent = h.text;
        headerDiv.style.cssText = `text-align: right; padding: 2px 8px; color: ${h.color}; font-size: 11px;`;
        headerRow.appendChild(headerDiv);
      });
    }

    // Add data to each planet row
    pagePlanets.forEach(planet => {
      const row = planet.row;
      const planetReport = reportMap.get(`${planet.position}-PLANET`);
      const { spio, metal, crystal, deuterium } = extractReportDisplayData(planetReport);

      const data = [
        { text: spio, color: '#888' },
        { text: metal, color: '#c0c0c0' },
        { text: crystal, color: '#87ceeb' },
        { text: deuterium, color: '#98fb98' }
      ];

      data.forEach(d => {
        const dataDiv = document.createElement('div');
        dataDiv.className = 'galaxy-grid-item hg-hub-col';
        dataDiv.textContent = d.text;
        dataDiv.style.cssText = `text-align: right; padding: 2px 8px; color: ${d.color}; font-size: 11px; white-space: nowrap;`;
        row.appendChild(dataDiv);
      });
    });
  } else {
    // HTML table fallback
    const rows = container.querySelectorAll('tr');

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length < 2) return;

      const firstCell = cells[0];
      const isHeader = firstCell.tagName === 'TH' ||
                       firstCell.textContent?.trim().toLowerCase() === 'pos';

      if (isHeader) {
        ['Spio', 'MET', 'CRY', 'DEU'].forEach(text => {
          const th = document.createElement('th');
          th.textContent = text;
          th.style.cssText = 'text-align: right; padding: 2px 5px;';
          row.appendChild(th);
        });
        return;
      }

      const posText = firstCell.textContent?.trim();
      const position = parseInt(posText || '', 10);

      if (isNaN(position) || position < 1 || position > 15) {
        for (let i = 0; i < 4; i++) {
          const td = document.createElement('td');
          td.textContent = '-';
          td.style.cssText = 'text-align: right; padding: 2px 5px; color: #666;';
          row.appendChild(td);
        }
        return;
      }

      const planetReport = reportMap.get(`${position}-PLANET`);
      const { spio, metal, crystal, deuterium } = extractReportDisplayData(planetReport);

      const data = [
        { text: spio, style: 'text-align: right; padding: 2px 5px; color: #888; font-size: 11px; white-space: nowrap;' },
        { text: metal, style: 'text-align: right; padding: 2px 5px; color: #c0c0c0; white-space: nowrap;' },
        { text: crystal, style: 'text-align: right; padding: 2px 5px; color: #87ceeb; white-space: nowrap;' },
        { text: deuterium, style: 'text-align: right; padding: 2px 5px; color: #98fb98; white-space: nowrap;' }
      ];

      data.forEach(d => {
        const td = document.createElement('td');
        td.textContent = d.text;
        td.style.cssText = d.style;
        row.appendChild(td);
      });
    });
  }
}

function detectDifferences(pagePlanets: PagePlanet[], dbPlanets: GalaxyPlanetInfo[]): PlanetDiff[] {
  const diffs: PlanetDiff[] = [];

  // Create maps for quick lookup by position
  const dbPlanetMap = new Map<number, GalaxyPlanetInfo>();
  const dbMoonMap = new Map<number, GalaxyPlanetInfo>();

  dbPlanets.forEach(p => {
    if (p.type === 'PLANET') {
      dbPlanetMap.set(p.planet, p);
    } else if (p.type === 'MOON') {
      dbMoonMap.set(p.planet, p);
    }
  });

  // Check each position on the page
  pagePlanets.forEach(pagePlanet => {
    const dbPlanet = dbPlanetMap.get(pagePlanet.position);
    const dbMoon = dbMoonMap.get(pagePlanet.position);

    // Planet exists on page but not in DB -> new planet
    if (pagePlanet.hasPlanet && !dbPlanet) {
      diffs.push({
        position: pagePlanet.position,
        type: 'new',
        pageData: pagePlanet,
        dbData: null
      });
    }

    // Planet exists in DB but not on page -> destroyed
    if (dbPlanet && !pagePlanet.hasPlanet) {
      diffs.push({
        position: pagePlanet.position,
        type: 'destroyed',
        pageData: pagePlanet,
        dbData: dbPlanet
      });
    }

    // Planet exists in both - compare by planet_id (most efficient)
    if (pagePlanet.hasPlanet && dbPlanet) {
      const pageId = pagePlanet.planetId;
      const dbId = dbPlanet.planet_id;

      // If both have planet_id, compare them directly
      if (pageId !== null && dbId !== null) {
        if (pageId !== dbId) {
          // Different planet at same position (player moved/changed)
          diffs.push({
            position: pagePlanet.position,
            type: 'new',
            pageData: pagePlanet,
            dbData: dbPlanet
          });
        }
        // IDs match -> no diff needed, planet is the same
      } else {
        // Fallback: one or both planet_ids missing, compare by name
        const pageName = pagePlanet.planetName || '';
        const dbName = dbPlanet.name || '';
        if (pageName !== dbName) {
          diffs.push({
            position: pagePlanet.position,
            type: 'name_changed',
            pageData: pagePlanet,
            dbData: dbPlanet
          });
        }
      }
    }

    // Moon checks - compare by moon_id
    if (pagePlanet.hasMoon && !dbMoon) {
      diffs.push({
        position: pagePlanet.position,
        type: 'moon_new',
        pageData: pagePlanet,
        dbData: null
      });
    } else if (pagePlanet.hasMoon && dbMoon) {
      const pageMoonId = pagePlanet.moonId;
      const dbMoonId = dbMoon.planet_id;

      if (pageMoonId !== null && dbMoonId !== null && pageMoonId !== dbMoonId) {
        // Different moon at same position
        diffs.push({
          position: pagePlanet.position,
          type: 'moon_new',
          pageData: pagePlanet,
          dbData: dbMoon
        });
      }
    }

    if (dbMoon && !pagePlanet.hasMoon) {
      diffs.push({
        position: pagePlanet.position,
        type: 'moon_destroyed',
        pageData: pagePlanet,
        dbData: dbMoon
      });
    }
  });

  return diffs;
}

function highlightDifferences(diffs: PlanetDiff[], pagePlanets: PagePlanet[]): void {
  diffs.forEach(diff => {
    const pagePlanet = pagePlanets.find(p => p.position === diff.position);
    if (!pagePlanet) return;

    const row = pagePlanet.row;
    let color = '';
    let title = '';

    switch (diff.type) {
      case 'new':
        color = 'rgba(68, 170, 68, 0.3)';
        title = 'Neuer Planet (nicht in DB)';
        break;
      case 'destroyed':
        color = 'rgba(170, 68, 68, 0.3)';
        title = 'Planet zerstoert (noch in DB)';
        break;
      case 'name_changed':
        color = 'rgba(170, 170, 68, 0.3)';
        title = `Name geaendert: "${diff.dbData?.name || ''}" -> "${diff.pageData?.planetName || ''}"`;
        break;
      case 'moon_new':
        color = 'rgba(68, 136, 170, 0.3)';
        title = 'Neuer Mond (nicht in DB)';
        break;
      case 'moon_destroyed':
        color = 'rgba(170, 68, 136, 0.3)';
        title = 'Mond zerstoert (noch in DB)';
        break;
    }

    row.style.backgroundColor = color;
    row.title = title;
  });
}

function showSyncButton(galaxy: number, system: number, container: HTMLElement, count: number, isEmptySystem: boolean): void {
  // Check if button already exists
  if (document.getElementById('hg-hub-sync-btn')) return;

  const isGrid = container.classList.contains('galaxy-grid-container');
  const buttonText = isEmptySystem ? 'Leer markieren' : `Sync (${count})`;
  const buttonColor = isEmptySystem ? '#4a8aba' : '#c50';

  if (isGrid) {
    // Add sync button to the header row
    const headerRow = container.querySelector('.galaxy-grid-row.header');
    if (headerRow) {
      const syncDiv = document.createElement('div');
      syncDiv.className = 'galaxy-grid-header hg-hub-sync';
      syncDiv.style.cssText = 'display: flex; align-items: center; gap: 5px; padding: 2px 8px;';
      syncDiv.innerHTML = `
        <button id="hg-hub-sync-btn" style="background: ${buttonColor}; border: none; color: #fff; padding: 2px 8px; cursor: pointer; font-size: 11px; border-radius: 3px;" type="button">
          ${buttonText}
        </button>
        <span id="hg-hub-sync-status" style="font-size: 10px;"></span>
      `;
      headerRow.appendChild(syncDiv);
    }
  } else {
    // Table fallback - add small button after table
    const syncSpan = document.createElement('span');
    syncSpan.style.cssText = 'margin-left: 10px;';
    syncSpan.innerHTML = `
      <button id="hg-hub-sync-btn" style="background: ${buttonColor}; border: none; color: #fff; padding: 2px 8px; cursor: pointer; font-size: 11px;" type="button">
        ${buttonText}
      </button>
      <span id="hg-hub-sync-status" style="font-size: 10px; margin-left: 5px;"></span>
    `;
    container.parentNode?.insertBefore(syncSpan, container.nextSibling);
  }

  document.getElementById('hg-hub-sync-btn')?.addEventListener('click', () => {
    void syncSystem(galaxy, system);
  });
}

async function syncSystem(galaxy: number, system: number): Promise<void> {
  const button = document.getElementById('hg-hub-sync-btn') as HTMLButtonElement;
  const status = document.getElementById('hg-hub-sync-status');

  if (!button || !status) return;

  button.disabled = true;
  button.textContent = '...';

  try {
    // Prepare sync payload - backend expects position, player_id, player_name, planet_name, moon_name, has_moon, planet_id, moon_id, alliance_id, alliance_tag
    const planets = pendingSyncData
      .filter(p => p.hasPlanet)  // Only planets that exist
      .map(p => ({
        position: p.position,
        player_id: p.playerId || 0,  // Default to 0 if unknown
        player_name: p.playerName || null,
        planet_name: p.planetName || null,
        moon_name: p.moonName || null,
        has_moon: p.hasMoon,
        planet_id: p.planetId || null,  // pr0game internal planet ID
        moon_id: p.moonId || null,  // pr0game internal moon ID
        alliance_id: p.allianceId || null,  // Alliance ID from galaxy page
        alliance_tag: p.allianceTag || null  // Alliance tag from galaxy page
      }));

    // Get destroyed positions from diffs
    const destroyed = currentDiffs
      .filter(d => d.type === 'destroyed' || d.type === 'moon_destroyed')
      .map(d => ({
        position: d.position,
        type: d.type === 'destroyed' ? 'PLANET' : 'MOON'
      }));

    const payload = {
      galaxy,
      system,
      planets,
      destroyed
    };

    // Always log sync payload for debugging
    console.log('[HG Hub] Sync payload:', payload);

    const response = await api.post('/planets/new', payload);

    if (response.ok) {
      status.textContent = '✓';
      status.style.color = '#5c5';

      // Remove highlights and hide button
      pendingSyncData.forEach(p => {
        p.row.style.backgroundColor = '';
        p.row.title = '';
      });

      currentDiffs = [];
      button.style.display = 'none';
    } else {
      status.textContent = `✗ ${response.error}`;
      status.style.color = '#c55';
      button.disabled = false;
      button.textContent = 'Sync';
    }
  } catch (error) {
    status.textContent = '✗';
    status.style.color = '#c55';
    console.error('[HG Hub] Sync error:', error);
    button.disabled = false;
    button.textContent = 'Sync';
  }
}

function formatNumber(num: number): string {
  if (num === 0) return '-';

  // Use compact notation for large numbers
  if (num >= 1_000_000_000) {
    // Billions: 1,3B
    return (num / 1_000_000_000).toLocaleString('de-DE', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1
    }) + 'B';
  } else if (num >= 1_000_000) {
    // Millions: 2,6M
    return (num / 1_000_000).toLocaleString('de-DE', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1
    }) + 'M';
  } else if (num >= 10_000) {
    // Thousands: 25k
    return Math.round(num / 1_000).toLocaleString('de-DE') + 'k';
  }

  // Small numbers: format with thousand separators
  return num.toLocaleString('de-DE');
}

function formatTimestamp(timestamp: string): string {
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

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffWeeks > 0) {
      return `${diffWeeks} Wo.`;
    }
    if (diffDays > 0) {
      return `${diffDays} T.`;
    }
    if (diffHours > 0) {
      return `${diffHours} Std.`;
    }
    return `${diffMins} Min.`;
  } catch {
    return '-';
  }
}
