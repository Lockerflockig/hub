/**
 * Raid & Expo page - Shows raid, expedition and recycling statistics
 */

import { api } from '../../../api/client';
import { t } from '../../../locales';

const CONTENT_ID = 'hg-hub-raid-expo';

interface ActivityStats {
  count: number;
  count_24h: number;
  metal: number;
  crystal: number;
  deuterium: number;
  points: number;
}

interface PlayerStats {
  id: number;
  name: string;
  expos: ActivityStats;
  raids: ActivityStats;
  recycling: ActivityStats;
}

interface OwnStats {
  expos: ActivityStats;
  raids: ActivityStats;
  recycling: ActivityStats;
}

interface HubStatsResponse {
  own_stats: OwnStats;
  alliance_stats: PlayerStats[] | null;
}

/**
 * Render the Raid & Expo page
 */
export async function renderRaidExpoPage(): Promise<void> {
  const contentArea = document.getElementById('content') || document.querySelector('content');
  if (!contentArea) {
    console.error('[HG Hub] Content area not found');
    return;
  }

  // Show loading state
  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 10px;">
      <div class="c" style="margin-bottom: 10px;">${t('hub.raidExpo.title')}</div>
      <div style="text-align: center; padding: 20px;">${t('hub.raidExpo.loading')}</div>
    </div>
  `;

  // Fetch data
  try {
    const response = await api.get<HubStatsResponse>('/hub/stats');

    if (response.ok && response.data) {
      renderPage(contentArea, response.data);
    } else {
      showError(contentArea, response.error || 'Failed to load data');
    }
  } catch (error) {
    showError(contentArea, String(error));
  }
}

function renderPage(contentArea: Element, data: HubStatsResponse): void {
  const ownStatsHtml = buildOwnStatsTable(data.own_stats);
  const allianceStatsHtml = data.alliance_stats
    ? buildAllianceStatsTable(data.alliance_stats)
    : `<div style="text-align: center; padding: 20px; color: #ffc107;">
        <i>${t('hub.raidExpo.noAlliance')}</i>
      </div>`;

  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 10px;">
      <div class="c" style="margin-bottom: 10px;">${t('hub.raidExpo.title')}</div>
      ${ownStatsHtml}
      ${allianceStatsHtml}
    </div>
  `;
}

function buildOwnStatsTable(stats: OwnStats): string {
  let html = `
    <div style="margin-bottom: 20px;">
      <h3 style="color: #8cf; margin-bottom: 10px;">${t('hub.raidExpo.ownStats')}</h3>
      <table style="border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 20px;">
        <tr style="background: rgba(0,0,0,0.3);">
          <th style="text-align: left; padding: 6px;">${t('hub.raidExpo.activity')}</th>
          <th style="text-align: right; padding: 6px;">${t('hub.raidExpo.last24h')}</th>
          <th style="text-align: right; padding: 6px; color: #4caf50;">${t('hub.raidExpo.metal')}</th>
          <th style="text-align: right; padding: 6px; color: #2196f3;">${t('hub.raidExpo.crystal')}</th>
          <th style="text-align: right; padding: 6px; color: #00bcd4;">${t('hub.raidExpo.deuterium')}</th>
          <th style="text-align: right; padding: 6px; color: #ffc107;">${t('hub.raidExpo.points')}</th>
        </tr>
        ${buildOwnStatsRow(t('hub.raidExpo.expos'), stats.expos)}
        ${buildOwnStatsRow(t('hub.raidExpo.raids'), stats.raids)}
        ${buildOwnStatsRow(t('hub.raidExpo.recycling'), stats.recycling)}
      </table>
    </div>
  `;
  return html;
}

function buildOwnStatsRow(label: string, stats: ActivityStats): string {
  return `
    <tr style="border-bottom: 1px solid #333;">
      <td style="text-align: left; padding: 6px;">${label}</td>
      <td style="text-align: right; padding: 6px;">${stats.count}</td>
      <td style="text-align: right; padding: 6px; color: #4caf50;">${formatNumber(stats.metal)}</td>
      <td style="text-align: right; padding: 6px; color: #2196f3;">${formatNumber(stats.crystal)}</td>
      <td style="text-align: right; padding: 6px; color: #00bcd4;">${formatNumber(stats.deuterium)}</td>
      <td style="text-align: right; padding: 6px; color: #ffc107;">${formatNumber(stats.points)}</td>
    </tr>
  `;
}

function buildAllianceStatsTable(players: PlayerStats[]): string {
  let html = '';

  // Expos table
  html += buildActivityTable(
    t('hub.raidExpo.expos24h'),
    players,
    p => p.expos
  );

  // Raids table
  html += buildActivityTable(
    t('hub.raidExpo.raids24h'),
    players,
    p => p.raids
  );

  // Recycling table
  html += buildActivityTable(
    t('hub.raidExpo.recycling24h'),
    players,
    p => p.recycling
  );

  return html;
}

function buildActivityTable(
  title: string,
  players: PlayerStats[],
  getStats: (p: PlayerStats) => ActivityStats
): string {
  let html = `
    <div style="margin-bottom: 20px;">
      <h3 style="color: #8cf; margin-bottom: 10px;">${title}</h3>
      <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
        <tr style="background: rgba(0,0,0,0.3);">
          <th style="text-align: left; padding: 6px;">${t('hub.raidExpo.player')}</th>
          <th style="text-align: right; padding: 6px;">${t('hub.raidExpo.count')}</th>
          <th style="text-align: right; padding: 6px; color: #4caf50;">${t('hub.raidExpo.metal')}</th>
          <th style="text-align: right; padding: 6px; color: #2196f3;">${t('hub.raidExpo.crystal')}</th>
          <th style="text-align: right; padding: 6px; color: #00bcd4;">${t('hub.raidExpo.deuterium')}</th>
          <th style="text-align: right; padding: 6px; color: #ffc107;">${t('hub.raidExpo.points')}</th>
        </tr>
  `;

  for (const player of players) {
    const stats = getStats(player);
    html += `
      <tr style="border-bottom: 1px solid #333;">
        <td style="text-align: left; padding: 6px;">${player.name}</td>
        <td style="text-align: right; padding: 6px;">${stats.count_24h || ''}</td>
        <td style="text-align: right; padding: 6px; color: #4caf50;">${formatNumber(stats.metal) || ''}</td>
        <td style="text-align: right; padding: 6px; color: #2196f3;">${formatNumber(stats.crystal) || ''}</td>
        <td style="text-align: right; padding: 6px; color: #00bcd4;">${formatNumber(stats.deuterium) || ''}</td>
        <td style="text-align: right; padding: 6px; color: #ffc107;">${formatNumber(stats.points) || ''}</td>
      </tr>
    `;
  }

  html += '</table></div>';
  return html;
}

function formatNumber(num: number): string {
  if (!num) return '';
  return num.toLocaleString('de-DE');
}

function showError(contentArea: Element, message: string): void {
  contentArea.innerHTML = `
    <div id="${CONTENT_ID}" style="padding: 10px;">
      <div class="c" style="margin-bottom: 10px;">${t('hub.raidExpo.title')}</div>
      <div style="text-align: center; padding: 20px; color: #f88;">
        ${t('hub.raidExpo.error')}: ${message}
      </div>
    </div>
  `;
}
