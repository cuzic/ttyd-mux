// Type definitions for Caddy config

export interface CaddyConfig {
  apps?: {
    http?: {
      servers?: Record<string, CaddyServer>;
    };
  };
}

export interface CaddyServer {
  listen?: string[];
  routes?: CaddyRoute[];
}

export interface CaddyRoute {
  match?: CaddyMatch[];
  handle?: CaddyHandler[];
}

export interface CaddyMatch {
  host?: string[];
  path?: string[];
}

export interface CaddyHandler {
  handler: string;
  upstreams?: Array<{ dial: string }>;
  body?: string;
}
