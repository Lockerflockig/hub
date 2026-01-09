/**
 * Marketplace page enhancements
 * - Resource converter based on reference ratio
 */

import { storage } from '../../utils/storage';

/**
 * Initialize marketplace page enhancements
 */
export function initMarketplacePage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'marketPlace') {
    return;
  }

  if (!storage.isConfigured()) {
    console.log('[HG Hub] Marketplace: Not configured, skipping');
    return;
  }

  console.log('[HG Hub] Marketplace: Initializing...');

  // Wait for page to be fully loaded
  setTimeout(() => {
    addResourceConverter();
  }, 300);
}

/**
 * Add resource converter boxes below reference ratio
 */
function addResourceConverter(): void {
  // Find the ratio table
  const ratioTable = document.querySelector('table[style="width:50%"]');
  if (!ratioTable) {
    console.warn('[HG Hub] Marketplace: Ratio table not found');
    return;
  }

  // Get ratio inputs
  const ratioMetal = ratioTable.querySelector('input[name="ratio-metal"]') as HTMLInputElement;
  const ratioCrystal = ratioTable.querySelector('input[name="ratio-cristal"]') as HTMLInputElement;
  const ratioDeut = ratioTable.querySelector('input[name="ratio-deuterium"]') as HTMLInputElement;

  if (!ratioMetal || !ratioCrystal || !ratioDeut) {
    console.warn('[HG Hub] Marketplace: Ratio inputs not found');
    return;
  }

  // Create converter container
  const converterDiv = document.createElement('div');
  converterDiv.id = 'hg-hub-resource-converter';
  converterDiv.style.cssText = 'margin-top: 10px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;';

  // Create the three resource boxes
  const resources = [
    { name: 'metal', label: 'Metal', color: '#c0c0c0', icon: 'metal.gif' },
    { name: 'crystal', label: 'Crystal', color: '#87ceeb', icon: 'crystal.gif' },
    { name: 'deuterium', label: 'Deuterium', color: '#98fb98', icon: 'deuterium.gif' }
  ];

  const inputs: Record<string, HTMLInputElement> = {};

  resources.forEach(res => {
    const box = document.createElement('div');
    box.style.cssText = `
      background: rgba(0,0,0,0.3);
      border: 1px solid #444;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: center;
      min-width: 140px;
    `;

    const label = document.createElement('div');
    label.style.cssText = `color: ${res.color}; font-size: 12px; margin-bottom: 5px;`;
    label.textContent = res.label;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `hg-converter-${res.name}`;
    input.placeholder = '0';
    input.style.cssText = `
      width: 100%;
      background: rgba(0,0,0,0.5);
      border: 1px solid #555;
      color: ${res.color};
      padding: 5px 8px;
      text-align: right;
      font-size: 13px;
      border-radius: 3px;
    `;

    inputs[res.name] = input;
    box.appendChild(label);
    box.appendChild(input);
    converterDiv.appendChild(box);
  });

  // Insert after ratio table
  ratioTable.parentNode?.insertBefore(converterDiv, ratioTable.nextSibling);

  // Flag to prevent recursive updates
  let isUpdating = false;

  // Helper to parse number (handles German format with dots)
  const parseNum = (val: string): number => {
    const cleaned = val.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(cleaned) || 0;
  };

  // Helper to format number with thousand separators
  const formatNum = (num: number): string => {
    if (num === 0) return '';
    return Math.round(num).toLocaleString('de-DE');
  };

  // Get current ratios
  const getRatios = () => ({
    metal: parseFloat(ratioMetal.value) || 2,
    crystal: parseFloat(ratioCrystal.value) || 1,
    deut: parseFloat(ratioDeut.value) || 1
  });

  // Update other fields based on changed field
  const updateFromField = (changedField: string) => {
    if (isUpdating) return;
    isUpdating = true;

    const ratios = getRatios();
    const value = parseNum(inputs[changedField].value);

    if (value === 0) {
      // Clear all if input is empty/zero
      Object.keys(inputs).forEach(key => {
        if (key !== changedField) {
          inputs[key].value = '';
        }
      });
      isUpdating = false;
      return;
    }

    // Calculate base value (normalized to ratio 1)
    let baseValue: number;
    switch (changedField) {
      case 'metal':
        baseValue = value / ratios.metal;
        break;
      case 'crystal':
        baseValue = value / ratios.crystal;
        break;
      case 'deuterium':
        baseValue = value / ratios.deut;
        break;
      default:
        baseValue = value;
    }

    // Update other fields
    if (changedField !== 'metal') {
      inputs.metal.value = formatNum(baseValue * ratios.metal);
    }
    if (changedField !== 'crystal') {
      inputs.crystal.value = formatNum(baseValue * ratios.crystal);
    }
    if (changedField !== 'deuterium') {
      inputs.deuterium.value = formatNum(baseValue * ratios.deut);
    }

    isUpdating = false;
  };

  // Add event listeners to converter inputs
  Object.keys(inputs).forEach(key => {
    inputs[key].addEventListener('input', () => updateFromField(key));
    inputs[key].addEventListener('focus', function() {
      this.select();
    });
  });

  // Also recalculate when ratio changes
  const recalcOnRatioChange = () => {
    // Find which field has a value and recalculate from that
    for (const key of Object.keys(inputs)) {
      if (parseNum(inputs[key].value) > 0) {
        updateFromField(key);
        break;
      }
    }
  };

  ratioMetal.addEventListener('input', recalcOnRatioChange);
  ratioCrystal.addEventListener('input', recalcOnRatioChange);
  ratioDeut.addEventListener('input', recalcOnRatioChange);

  console.log('[HG Hub] Marketplace: Resource converter added');
}
