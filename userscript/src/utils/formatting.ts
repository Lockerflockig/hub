/**
 * Centralized formatting utilities
 */

/**
 * Debug logging utility - only logs if HG_HUB.devMode is enabled
 */
export function debugLog(...args: unknown[]): void {
  if (window.HG_HUB?.devMode) {
    console.log('[HG Hub]', ...args);
  }
}

/**
 * Get the main content area element
 */
export function getContentArea(): HTMLElement | null {
  return document.getElementById('content') ??
         document.getElementById('inhalt') ??
         document.querySelector('content');
}

/**
 * Format a number with German locale (dot as thousand separator)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  return num.toLocaleString('de-DE');
}

/**
 * Parse a formatted number string (removes dots and commas as thousand separators)
 */
export function parseGermanNumber(str: string): number {
  return parseInt(str.replace(/[.,]/g, ''), 10) || 0;
}

/**
 * Format a timestamp as relative age (e.g., "2d", "5h", "<1h")
 */
export function formatAge(timestamp: string | null | undefined): string {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp.replace(' ', 'T'));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return '<1h';
  } catch {
    return '-';
  }
}

/**
 * Format a diff value with + or - prefix
 */
export function formatDiff(diff: number | null | undefined): string {
  if (diff === null || diff === undefined) return '-';
  if (diff === 0) return '0';
  return diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff);
}

/**
 * Get CSS style for a diff value (green for positive, red for negative)
 */
export function getDiffStyle(diff: number | null | undefined): string {
  if (diff === null || diff === undefined || diff === 0) return 'color: #666;';
  return diff > 0 ? 'color: #4caf50;' : 'color: #f44336;';
}

/**
 * Get a gradient color between red and green based on value ratio
 */
export function getGradientColor(value: number, maxValue: number): string {
  if (value === 0) return '#666';
  const ratio = value / maxValue;
  const r = Math.round(255 * (1 - ratio));
  const g = Math.round(255 * ratio);
  return `rgb(${r}, ${g}, 100)`;
}
