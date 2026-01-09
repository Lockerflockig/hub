/**
 * Centralized theme constants for consistent styling
 */

export const THEME = {
  // Primary colors
  primaryBlue: '#4a8aba',
  lightBlue: '#8cf',
  darkBlue: '#2a4a6a',

  // Background colors
  darkBg: '#1a2a3a',
  semiTransparent: 'rgba(0,0,0,0.3)',
  panelBg: 'rgba(0,0,0,0.3)',

  // Text colors
  textMuted: '#888',
  textDimmed: '#666',
  textWarning: '#ffc107',
  textError: '#f88',
  textSuccess: '#8f8',

  // Status colors
  success: '#4caf50',
  error: '#f44336',
  warning: '#ffc107',
  info: '#2196f3',

  // Border colors
  borderPrimary: '#4a8aba',
  borderDark: '#333',
} as const;

/**
 * Common button styles
 */
export const BUTTON_STYLES = {
  primary: `
    background: ${THEME.primaryBlue};
    color: #fff;
    border: 1px solid ${THEME.primaryBlue};
    padding: 6px 12px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 12px;
  `,
  secondary: `
    background: ${THEME.darkBlue};
    color: ${THEME.lightBlue};
    border: 1px solid ${THEME.primaryBlue};
    padding: 6px 10px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 11px;
  `,
  danger: `
    background: ${THEME.error};
    color: #fff;
    border: none;
    padding: 3px 8px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 11px;
  `,
  success: `
    background: ${THEME.success};
    color: #fff;
    border: none;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 12px;
  `,
} as const;

/**
 * Common panel/card styles
 */
export const PANEL_STYLES = {
  card: `
    background: ${THEME.semiTransparent};
    border: 1px solid ${THEME.primaryBlue};
    border-radius: 5px;
    padding: 15px;
    margin-bottom: 20px;
  `,
  header: `
    color: ${THEME.lightBlue};
    margin: 0 0 15px 0;
    font-size: 14px;
  `,
} as const;

/**
 * Common input styles
 */
export const INPUT_STYLES = {
  text: `
    padding: 6px;
    background: ${THEME.darkBg};
    color: #fff;
    border: 1px solid ${THEME.primaryBlue};
    border-radius: 3px;
    font-size: 12px;
  `,
  select: `
    padding: 6px;
    background: ${THEME.darkBg};
    color: #fff;
    border: 1px solid ${THEME.primaryBlue};
    border-radius: 3px;
    font-size: 12px;
  `,
} as const;

/**
 * Apply button style helper
 */
export function applyButtonStyle(element: HTMLElement, style: keyof typeof BUTTON_STYLES): void {
  element.style.cssText = BUTTON_STYLES[style];
}
