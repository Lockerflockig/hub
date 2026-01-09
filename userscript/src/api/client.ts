/**
 * API Client for communicating with the HG Hub backend
 */

import { storage } from '../utils/storage';

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

export interface LoginResponse {
  success: boolean;
  user: {
    id: number;
    player_id: number | null;
    alliance_id: number | null;
    language: string;
  };
}

class ApiClient {
  private get baseUrl(): string {
    return window.HG_HUB.apiUrl;
  }

  private get apiKey(): string {
    return storage.getApiKey();
  }

  /**
   * Make an API request
   */
  async request<T = unknown>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      data?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', data, headers = {} } = options;

    try {
      const response = await window.HG_HUB.request({
        method,
        url: `${this.baseUrl}/api${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...headers
        },
        data
      });

      const ok = response.status >= 200 && response.status < 300;

      let errorMessage: string | undefined;
      let responseData: T | null = null;

      if (ok) {
        responseData = response.json() as T;
      } else {
        // Try to extract error message from response body
        try {
          const errorBody = response.json() as { error?: string; message?: string };
          // Prefer message (human-readable) over error (error type)
          errorMessage = errorBody.message || errorBody.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}`;
        }
      }

      return {
        ok,
        status: response.status,
        data: responseData,
        error: errorMessage
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate an API key and return user info including language
   */
  async validateApiKey(apiKey: string): Promise<ApiResponse<LoginResponse>> {
    try {
      const response = await window.HG_HUB.request({
        method: 'GET',
        url: `${this.baseUrl}/api/login`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });

      return {
        ok: response.status === 200,
        status: response.status,
        data: response.status === 200 ? (response.json() as LoginResponse) : null,
        error: response.status !== 200 ? 'Invalid API key' : undefined
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: 'Connection failed'
      };
    }
  }

  /**
   * Update user language
   */
  async updateLanguage(language: string): Promise<ApiResponse> {
    return this.post('/users/language', { language });
  }

  // Convenience methods
  get<T = unknown>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T = unknown>(endpoint: string, data: unknown) {
    return this.request<T>(endpoint, { method: 'POST', data });
  }

  put<T = unknown>(endpoint: string, data: unknown) {
    return this.request<T>(endpoint, { method: 'PUT', data });
  }

  delete<T = unknown>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
