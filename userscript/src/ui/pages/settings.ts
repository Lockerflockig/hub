/**
 * Settings page enhancement - Injects Hub settings into game's settings page
 * Includes: API Key, Language, and Admin features (for admins only)
 */

import { api } from '../../api/client';
import { t, getLanguage, setLanguage, getSupportedLanguages, Language } from '../../locales';
import { storage } from '../../utils/storage';
import { updateMenuState } from '../menu';

const CONTENT_ID = 'hg-hub-settings';

interface AdminUser {
  id: number;
  player_id: number | null;
  player_name: string | null;
  alliance_id: number | null;
  alliance_name: string | null;
  language: string;
  role: string;
  last_activity_at: string | null;
  created_at: string | null;
}

interface AdminUsersResponse {
  users: AdminUser[];
}

interface AdminCheckResponse {
  is_admin: boolean;
}

interface HubConfigResponse {
  galaxies: number;
  systems: number;
  galaxy_wrapped: boolean;
}

interface CreateUserResponse {
  success: boolean;
  user_id: number;
  api_key: string;
}

// State
let isAdmin = false;
let users: AdminUser[] = [];
let config = { galaxies: 9, systems: 499, galaxy_wrapped: true };
let containerElement: HTMLElement | null = null;
let lastCreatedApiKey: string | null = null;
let activeTab = 'general';

/**
 * Initialize settings page enhancement
 * Only runs on the game's settings page (page=settings)
 */
export function initSettingsPage(): void {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');

  if (page !== 'settings') {
    return;
  }

  waitForContentArea(0);
}

function waitForContentArea(attempt: number): void {
  const maxAttempts = 10;
  const delay = 200;

  const contentArea = document.getElementById('content') ||
    document.getElementById('inhalt') ||
    document.querySelector('content');

  if (contentArea) {
    initSettingsContent(contentArea as HTMLElement);
  } else if (attempt < maxAttempts) {
    setTimeout(() => waitForContentArea(attempt + 1), delay);
  } else {
    console.error('[HG Hub] Settings content area not found');
  }
}

async function initSettingsContent(contentArea: HTMLElement): Promise<void> {
  // Create container for Hub settings section
  const container = document.createElement('div');
  container.id = CONTENT_ID;
  container.style.cssText = 'margin-top: 20px;';
  contentArea.appendChild(container);
  containerElement = container;

  // Check admin status and load data
  await checkAdminAndLoadData();

  renderHubSettings();
}

async function checkAdminAndLoadData(): Promise<void> {
  if (!storage.isConfigured()) {
    isAdmin = false;
    return;
  }

  try {
    const checkResponse = await api.get<AdminCheckResponse>('/admin/check');
    isAdmin = checkResponse.ok && checkResponse.data?.is_admin === true;
  } catch {
    isAdmin = false;
  }

  if (isAdmin) {
    try {
      const [usersResponse, configResponse] = await Promise.all([
        api.get<AdminUsersResponse>('/admin/users'),
        api.get<HubConfigResponse>('/hub/config'),
      ]);

      if (usersResponse.ok && usersResponse.data) {
        users = usersResponse.data.users;
      }

      if (configResponse.ok && configResponse.data) {
        config = {
          galaxies: configResponse.data.galaxies,
          systems: configResponse.data.systems,
          galaxy_wrapped: configResponse.data.galaxy_wrapped ?? true,
        };
      }
    } catch (error) {
      console.error('[HG Hub] Failed to load admin data', error);
    }
  }
}

function renderHubSettings(): void {
  if (!containerElement) return;

  const tabs = [
    { id: 'general', label: t('hub.overview.tabs.general') },
  ];

  // Add admin tab if user is admin
  if (isAdmin) {
    tabs.push({ id: 'admin', label: t('hub.admin.title') });
  }

  const tabsHtml = tabs.map(tab => `
    <button class="hg-settings-tab" data-tab="${tab.id}" style="
      background: ${activeTab === tab.id ? '#4a8aba' : '#2a4a6a'};
      color: ${activeTab === tab.id ? '#fff' : '#8cf'};
      border: 1px solid #4a8aba;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 3px 3px 0 0;
      margin-right: 2px;
      font-size: 11px;
    ">${tab.label}</button>
  `).join('');

  let contentHtml = '';
  if (activeTab === 'general') {
    contentHtml = buildGeneralTab();
  } else if (activeTab === 'admin' && isAdmin) {
    contentHtml = buildAdminTab();
  }

  containerElement.innerHTML = `
    <table width="519">
      <tbody>
        <tr>
          <td class="c" colspan="2">Hub-Settings</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 10px;">
            <div style="margin-bottom: 10px;">
              ${tabsHtml}
            </div>
            <div style="background: rgba(0,0,0,0.3); border: 1px solid #4a8aba; border-radius: 0 5px 5px 5px; padding: 15px;">
              ${contentHtml}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;

  bindEvents();
}

function buildGeneralTab(): string {
  const currentLang = getLanguage();
  const languages = getSupportedLanguages();
  const currentApiKey = storage.getApiKey();

  const langOptions = languages
    .map(lang => `<option value="${lang}" ${lang === currentLang ? 'selected' : ''}>${t(`languages.${lang}`)}</option>`)
    .join('');

  return `
    <div style="font-size: 12px;">
      <div style="font-weight: bold; margin-bottom: 15px; color: #8cf;">${t('settings.title')}</div>

      <!-- API Key -->
      <div style="margin-bottom: 15px;">
        <p style="color: #888; font-size: 11px; margin-bottom: 10px;">
          ${t('settings.apiKeyDescription')}
        </p>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
          <span style="width: 100px;">${t('settings.apiKey')}:</span>
          <input
            type="password"
            id="hg-settings-api-key"
            value="${currentApiKey}"
            placeholder="${t('settings.apiKeyPlaceholder')}"
            style="width: 250px; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; font-size: 12px;"
          />
          <button id="hg-toggle-key-btn" style="
            background: #2a4a6a;
            color: #8cf;
            border: 1px solid #4a8aba;
            padding: 6px 10px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 11px;
          ">${t('settings.showApiKey')}</button>
          <button id="hg-validate-key-btn" style="
            background: #2a4a6a;
            color: #8cf;
            border: 1px solid #4a8aba;
            padding: 6px 10px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 11px;
          ">${t('settings.validate')}</button>
        </div>
        <div id="hg-api-key-status" style="margin-top: 8px; padding: 8px; display: none; border-radius: 3px; font-size: 12px;"></div>
      </div>

      <!-- Language -->
      <div style="margin-bottom: 15px; padding-top: 10px; border-top: 1px solid #333;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="width: 100px;">${t('settings.language')}:</span>
          <select id="hg-settings-language" style="padding: 6px; min-width: 150px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; font-size: 12px;">
            ${langOptions}
          </select>
        </div>
      </div>

      <!-- Save Button -->
      <div style="margin-bottom: 15px; padding-top: 10px; border-top: 1px solid #333;">
        <button id="hg-save-settings-btn" style="
          background: #4a8aba;
          color: #fff;
          border: 1px solid #4a8aba;
          padding: 8px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 12px;
        ">${t('settings.save')}</button>
      </div>

      <!-- Server Info -->
      <div style="padding-top: 10px; border-top: 1px solid #333;">
        <small style="color: #666;">
          ${t('settings.server')}: ${window.HG_HUB?.apiUrl || '-'}<br/>
          ${t('settings.version')}: ${window.HG_HUB?.version || '-'}
        </small>
      </div>
    </div>
  `;
}

function buildAdminTab(): string {
  return `
    <div style="font-size: 12px;">
      <!-- Universe Config -->
      <div style="margin-bottom: 20px;">
        <div style="font-weight: bold; margin-bottom: 10px; color: #8cf;">${t('hub.admin.universeConfig')}</div>
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
          <div>
            <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 5px;">${t('hub.admin.galaxies')}</label>
            <input type="number" id="hg-config-galaxies" value="${config.galaxies}" min="1" max="20"
              style="width: 80px; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px;">
          </div>
          <div>
            <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 5px;">${t('hub.admin.systemsPerGalaxy')}</label>
            <input type="number" id="hg-config-systems" value="${config.systems}" min="1" max="999"
              style="width: 80px; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px;">
          </div>
          <div style="margin-top: 18px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #aaa; cursor: pointer;">
              <input type="checkbox" id="hg-config-galaxy-wrapped" ${config.galaxy_wrapped ? 'checked' : ''}
                style="width: 16px; height: 16px; cursor: pointer;">
              ${t('hub.admin.galaxyWrapped')}
            </label>
          </div>
          <div style="margin-top: 18px;">
            <button id="hg-save-config-btn" style="
              background: #4a8aba;
              color: #fff;
              border: none;
              padding: 8px 16px;
              cursor: pointer;
              border-radius: 3px;
              font-size: 12px;
            ">${t('hub.admin.save')}</button>
          </div>
        </div>
        <div id="hg-config-status" style="margin-top: 10px; font-size: 12px; display: none;"></div>
      </div>

      <!-- User Management -->
      <div style="padding-top: 15px; border-top: 1px solid #333;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div style="font-weight: bold; color: #8cf;">${t('hub.admin.users')} (${users.length})</div>
          <button id="hg-add-user-btn" style="
            background: #4caf50;
            color: #fff;
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
          ">${t('hub.admin.addUser')}</button>
        </div>

        <!-- Add User Form -->
        <div id="hg-add-user-form" style="display: none; margin-bottom: 15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 3px;">
          <div style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;">
            <div>
              <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.admin.playerName')}</label>
              <input type="text" id="hg-new-user-name" placeholder="${t('hub.admin.playerName')}"
                style="width: 150px; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; font-size: 12px;">
            </div>
            <div>
              <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 3px;">${t('hub.admin.allianceId')}</label>
              <input type="number" id="hg-new-user-alliance" placeholder="ID"
                style="width: 100px; padding: 6px; background: #1a2a3a; color: #fff; border: 1px solid #4a8aba; border-radius: 3px; font-size: 12px;">
            </div>
            <button id="hg-create-user-btn" style="
              background: #4caf50;
              color: #fff;
              border: none;
              padding: 6px 12px;
              cursor: pointer;
              border-radius: 3px;
              font-size: 12px;
            ">${t('hub.admin.create')}</button>
            <button id="hg-cancel-add-user-btn" style="
              background: #666;
              color: #fff;
              border: none;
              padding: 6px 12px;
              cursor: pointer;
              border-radius: 3px;
              font-size: 12px;
            ">${t('hub.admin.cancel')}</button>
          </div>
          <div id="hg-add-user-status" style="margin-top: 10px; font-size: 12px; display: none;"></div>
        </div>

        <!-- Last Created API Key -->
        ${lastCreatedApiKey ? `
          <div style="margin-bottom: 15px; padding: 10px; background: rgba(76, 175, 80, 0.2); border: 1px solid #4caf50; border-radius: 3px;">
            <div style="font-size: 12px; color: #4caf50; margin-bottom: 5px;">${t('hub.admin.newApiKeyCreated')}</div>
            <code style="font-size: 13px; color: #fff; word-break: break-all;">${lastCreatedApiKey}</code>
            <button id="hg-copy-apikey-btn" style="
              margin-left: 10px;
              background: #4a8aba;
              color: #fff;
              border: none;
              padding: 4px 8px;
              cursor: pointer;
              border-radius: 3px;
              font-size: 11px;
            ">${t('hub.admin.copy')}</button>
          </div>
        ` : ''}

        <!-- Users Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: rgba(0,0,0,0.5);">
              <th style="padding: 8px; text-align: left;">${t('hub.admin.tableId')}</th>
              <th style="padding: 8px; text-align: left;">${t('hub.admin.tablePlayer')}</th>
              <th style="padding: 8px; text-align: left;">${t('hub.admin.tableAlliance')}</th>
              <th style="padding: 8px; text-align: center;">${t('hub.admin.tableRole')}</th>
              <th style="padding: 8px; text-align: center;">${t('hub.admin.tableLastActivity')}</th>
              <th style="padding: 8px; text-align: center;">${t('hub.admin.tableActions')}</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 8px;">${u.id}</td>
                <td style="padding: 8px;">${u.player_name || '-'}</td>
                <td style="padding: 8px;">${u.alliance_name || '-'}</td>
                <td style="padding: 8px; text-align: center;">
                  <select class="hg-role-select" data-user-id="${u.id}" style="
                    background: ${u.role === 'admin' ? '#4a8aba' : '#2a4a6a'};
                    color: #fff;
                    border: 1px solid #4a8aba;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                  ">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                  </select>
                </td>
                <td style="padding: 8px; text-align: center; color: #888;">${formatDate(u.last_activity_at)}</td>
                <td style="padding: 8px; text-align: center;">
                  <button class="hg-show-apikey-btn" data-user-id="${u.id}" style="
                    background: #2a4a6a;
                    color: #8cf;
                    border: 1px solid #4a8aba;
                    padding: 3px 8px;
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 11px;
                    margin-right: 5px;
                  ">${t('hub.admin.apiKey')}</button>
                  <button class="hg-delete-user-btn" data-user-id="${u.id}" data-user-name="${u.player_name || 'User ' + u.id}" style="
                    background: #f44336;
                    color: #fff;
                    border: none;
                    padding: 3px 8px;
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 11px;
                  ">${t('hub.admin.delete')}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindEvents(): void {
  if (!containerElement) return;

  // Tab navigation
  containerElement.querySelectorAll('.hg-settings-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      activeTab = (e.target as HTMLElement).dataset.tab || 'general';
      renderHubSettings();
    });
  });

  // General tab events
  if (activeTab === 'general') {
    bindGeneralTabEvents();
  }

  // Admin tab events
  if (activeTab === 'admin' && isAdmin) {
    bindAdminTabEvents();
  }
}

function bindGeneralTabEvents(): void {
  // Toggle API key visibility
  const toggleKeyBtn = document.getElementById('hg-toggle-key-btn');
  toggleKeyBtn?.addEventListener('click', () => {
    const input = document.getElementById('hg-settings-api-key') as HTMLInputElement;
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      toggleKeyBtn.textContent = t('settings.hideApiKey');
    } else {
      input.type = 'password';
      toggleKeyBtn.textContent = t('settings.showApiKey');
    }
  });

  // Validate API key
  document.getElementById('hg-validate-key-btn')?.addEventListener('click', handleValidateApiKey);

  // Save settings
  document.getElementById('hg-save-settings-btn')?.addEventListener('click', handleSaveSettings);
}

function bindAdminTabEvents(): void {
  // Save config
  document.getElementById('hg-save-config-btn')?.addEventListener('click', saveConfig);

  // Add user form toggle
  document.getElementById('hg-add-user-btn')?.addEventListener('click', () => {
    const form = document.getElementById('hg-add-user-form');
    if (form) form.style.display = 'block';
  });

  document.getElementById('hg-cancel-add-user-btn')?.addEventListener('click', () => {
    const form = document.getElementById('hg-add-user-form');
    if (form) form.style.display = 'none';
  });

  // Create user
  document.getElementById('hg-create-user-btn')?.addEventListener('click', createUser);

  // Copy API key
  document.getElementById('hg-copy-apikey-btn')?.addEventListener('click', () => {
    if (lastCreatedApiKey) {
      navigator.clipboard.writeText(lastCreatedApiKey);
    }
  });

  // Role changes
  containerElement?.querySelectorAll('.hg-role-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const userId = parseInt(target.dataset.userId || '0');
      const role = target.value;
      updateUserRole(userId, role);
    });
  });

  // Show API key
  containerElement?.querySelectorAll('.hg-show-apikey-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const userId = parseInt(target.dataset.userId || '0');
      showUserApiKey(userId);
    });
  });

  // Delete user
  containerElement?.querySelectorAll('.hg-delete-user-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const userId = parseInt(target.dataset.userId || '0');
      const userName = target.dataset.userName || '';
      deleteUser(userId, userName);
    });
  });
}

// ============================================================================
// General Tab Handlers
// ============================================================================

async function handleValidateApiKey(): Promise<void> {
  const input = document.getElementById('hg-settings-api-key') as HTMLInputElement;
  const button = document.getElementById('hg-validate-key-btn') as HTMLButtonElement;
  const apiKey = input?.value.trim();

  if (!apiKey) {
    showApiKeyStatus(t('messages.apiKeyRequired'), 'error');
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = t('settings.validating');

  try {
    const response = await api.validateApiKey(apiKey);

    if (response.ok && response.data) {
      storage.setApiKey(apiKey);

      // Update language from server if different
      const serverLang = response.data.user.language;
      if (serverLang && serverLang !== getLanguage()) {
        setLanguage(serverLang as Language);
      }

      showApiKeyStatus(t('messages.apiKeyValid'), 'success');
      updateMenuState();

      // Check if admin status changed - only re-render if it did
      const wasAdmin = isAdmin;
      await checkAdminAndLoadData();
      if (wasAdmin !== isAdmin) {
        renderHubSettings();
      }
    } else if (response.status === 401) {
      showApiKeyStatus(t('messages.apiKeyInvalid'), 'error');
    } else {
      showApiKeyStatus(`${t('messages.serverError')}: ${response.error || response.status}`, 'error');
    }
  } catch {
    showApiKeyStatus(t('messages.connectionError'), 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function handleSaveSettings(): Promise<void> {
  const saveBtn = document.getElementById('hg-save-settings-btn') as HTMLButtonElement;
  const apiKeyInput = document.getElementById('hg-settings-api-key') as HTMLInputElement;
  const languageSelect = document.getElementById('hg-settings-language') as HTMLSelectElement;

  if (!saveBtn) return;

  saveBtn.disabled = true;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = t('settings.saving');

  try {
    // Save API key if changed
    const currentApiKey = apiKeyInput?.value.trim() || '';
    const storedApiKey = storage.getApiKey();
    if (currentApiKey && currentApiKey !== storedApiKey) {
      storage.setApiKey(currentApiKey);
      updateMenuState();
    }

    // Save language if changed
    const selectedLang = languageSelect?.value as Language;
    const currentLang = getLanguage();
    if (selectedLang && selectedLang !== currentLang) {
      setLanguage(selectedLang);

      // Try to update on server if connected
      if (storage.isConfigured()) {
        try {
          await api.updateLanguage(selectedLang);
        } catch (error) {
          console.warn('[HG Hub] Failed to update language on server:', error);
        }
      }
    }

    showApiKeyStatus(t('messages.settingsSaved'), 'success');

    // Reload to reflect changes
    await checkAdminAndLoadData();
    renderHubSettings();
  } catch {
    showApiKeyStatus(t('messages.settingsSaveFailed'), 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

function showApiKeyStatus(message: string, type: 'success' | 'error' | 'info'): void {
  const statusDiv = document.getElementById('hg-api-key-status');
  if (!statusDiv) return;

  const styles: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: '#1a4d1a', color: '#5cb85c', border: '#2d662d' },
    error: { bg: '#4d1a1a', color: '#d9534f', border: '#662d2d' },
    info: { bg: '#1a1a4d', color: '#5bc0de', border: '#2d2d66' }
  };

  const style = styles[type];
  statusDiv.style.display = 'block';
  statusDiv.textContent = message;
  statusDiv.style.background = style.bg;
  statusDiv.style.color = style.color;
  statusDiv.style.border = `1px solid ${style.border}`;
}

// ============================================================================
// Admin Tab Handlers
// ============================================================================

async function saveConfig(): Promise<void> {
  const galaxiesInput = document.getElementById('hg-config-galaxies') as HTMLInputElement;
  const systemsInput = document.getElementById('hg-config-systems') as HTMLInputElement;
  const galaxyWrappedInput = document.getElementById('hg-config-galaxy-wrapped') as HTMLInputElement;
  const statusDiv = document.getElementById('hg-config-status');

  const galaxies = parseInt(galaxiesInput?.value || '9');
  const systems = parseInt(systemsInput?.value || '499');
  const galaxy_wrapped = galaxyWrappedInput?.checked ?? true;

  try {
    const response = await api.put('/admin/config', { galaxies, systems, galaxy_wrapped });

    if (response.ok) {
      config = { galaxies, systems, galaxy_wrapped };
      showStatus(statusDiv, t('hub.admin.configSaved'), 'success');
    } else {
      showStatus(statusDiv, response.error || t('hub.admin.saveError'), 'error');
    }
  } catch {
    showStatus(statusDiv, t('hub.admin.networkError'), 'error');
  }
}

async function createUser(): Promise<void> {
  const nameInput = document.getElementById('hg-new-user-name') as HTMLInputElement;
  const allianceInput = document.getElementById('hg-new-user-alliance') as HTMLInputElement;
  const statusDiv = document.getElementById('hg-add-user-status');

  const playerName = nameInput?.value.trim();
  const allianceId = allianceInput?.value ? parseInt(allianceInput.value) : null;

  if (!playerName) {
    showStatus(statusDiv, t('hub.admin.playerNameRequired'), 'error');
    return;
  }

  try {
    const response = await api.post<CreateUserResponse>('/admin/users', {
      player_name: playerName,
      alliance_id: allianceId,
    });

    if (response.ok && response.data) {
      lastCreatedApiKey = response.data.api_key;
      nameInput.value = '';
      allianceInput.value = '';
      await checkAdminAndLoadData();
      renderHubSettings();
    } else {
      showStatus(statusDiv, response.error || t('hub.admin.createError'), 'error');
    }
  } catch {
    showStatus(statusDiv, t('hub.admin.networkError'), 'error');
  }
}

async function updateUserRole(userId: number, role: string): Promise<void> {
  try {
    const response = await api.put(`/admin/users/${userId}/role`, { role });

    if (!response.ok) {
      alert(response.error || t('hub.admin.roleChangeError'));
      await checkAdminAndLoadData();
      renderHubSettings();
    }
  } catch {
    alert(t('hub.admin.networkError'));
  }
}

async function showUserApiKey(userId: number): Promise<void> {
  try {
    const response = await api.get<{ api_key: string }>(`/admin/users/${userId}/apikey`);

    if (response.ok && response.data) {
      const apiKey = response.data.api_key;
      const copied = await navigator.clipboard.writeText(apiKey).then(() => true).catch(() => false);
      alert(`${t('hub.admin.apiKeyLabel')} ${apiKey}\n\n${copied ? t('hub.admin.copiedToClipboard') : ''}`);
    } else {
      alert(response.error || t('hub.admin.loadApiKeyError'));
    }
  } catch {
    alert(t('hub.admin.networkError'));
  }
}

async function deleteUser(userId: number, userName: string): Promise<void> {
  if (!confirm(t('hub.admin.confirmDelete').replace('{name}', userName))) {
    return;
  }

  try {
    const response = await api.delete(`/admin/users/${userId}`);

    if (response.ok) {
      await checkAdminAndLoadData();
      renderHubSettings();
    } else {
      alert(response.error || t('hub.admin.deleteError'));
    }
  } catch {
    alert(t('hub.admin.networkError'));
  }
}

function showStatus(element: HTMLElement | null, message: string, type: 'success' | 'error' | 'info'): void {
  if (!element) return;

  const styles: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: '#1a4d1a', color: '#5cb85c', border: '#2d662d' },
    error: { bg: '#4d1a1a', color: '#d9534f', border: '#662d2d' },
    info: { bg: '#1a1a4d', color: '#5bc0de', border: '#2d2d66' }
  };

  const style = styles[type];
  element.style.display = 'block';
  element.textContent = message;
  element.style.background = style.bg;
  element.style.color = style.color;
  element.style.border = `1px solid ${style.border}`;

  setTimeout(() => {
    element.style.display = 'none';
  }, 3000);
}

function formatDate(timestamp: string | null): string {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp.replace(' ', 'T'));
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '-';
  }
}
