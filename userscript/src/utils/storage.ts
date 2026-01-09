/**
 * Storage utility - wraps Tampermonkey's GM storage
 */

const STORAGE_PREFIX = 'hg_';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HubSettings {
  // Settings can be added here in the future
}

const defaultSettings: HubSettings = {};

export const storage = {
  get(key: string, defaultValue: string = ''): string {
    return window.HG_HUB.getValue(STORAGE_PREFIX + key, defaultValue);
  },

  set(key: string, value: string): void {
    window.HG_HUB.setValue(STORAGE_PREFIX + key, value);
  },

  getApiKey(): string {
    return window.HG_HUB.getValue('api_key', '');
  },

  setApiKey(key: string): void {
    window.HG_HUB.setValue('api_key', key);
  },

  isConfigured(): boolean {
    return !!this.getApiKey();
  },

  getSettings(): HubSettings {
    const stored = window.HG_HUB.getValue(STORAGE_PREFIX + 'settings', '');
    if (!stored) return { ...defaultSettings };
    try {
      return { ...defaultSettings, ...JSON.parse(stored) };
    } catch {
      return { ...defaultSettings };
    }
  },

  setSettings(settings: Partial<HubSettings>): void {
    const current = this.getSettings();
    const merged = { ...current, ...settings };
    window.HG_HUB.setValue(STORAGE_PREFIX + 'settings', JSON.stringify(merged));
  },
};
