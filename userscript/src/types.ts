/**
 * Global HG_HUB interface exposed by Tampermonkey loader
 */
export interface HGHubGlobal {
  apiUrl: string;
  version: string;
  devMode: boolean;
  setValue: (key: string, value: string) => void;
  getValue: (key: string, defaultValue?: string) => string;
  request: (options: RequestOptions) => Promise<RequestResponse>;
  api: (endpoint: string, options?: ApiOptions) => Promise<RequestResponse>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  data?: unknown;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: unknown;
}

export interface RequestResponse {
  status: number;
  data: string;
  json: () => unknown | null;
}

declare global {
  interface Window {
    HG_HUB: HGHubGlobal;
  }
}
