/*
 * Types for extension-gateway-fake.mjs, so tests/ can import it under
 * `typecheck:tests` without `allowJs`. Keep in step with the .mjs exports.
 */
import type { Server } from "node:http";

export interface FakeGatewayOptions {
  /** The shared secret, accepted in the path (/mcp/<token>) or as a Bearer header. */
  token: string;
  /** Defaults to the spec found next to the fake (see its header). */
  specPath?: string;
  /** Origins that get CORS headers (plan R4). Default: none. */
  allowedOrigins?: string[];
  /** IANA zone for "today" and day ranges; null = the process's zone. */
  timeZone?: string | null;
  /** The serving app's extension_apps.slug — create_record's source_app. Default "fake-app". */
  app?: string;
  /** The Apps ledger list_extension_apps reads. Default: none. */
  extensionApps?: Array<{
    slug: string;
    name: string;
    url?: string | null;
    icon?: string | null;
    description?: string | null;
    sort_order: number;
  }>;
}

export interface RecordedCall {
  tool: string;
  arguments: unknown;
  ok: boolean;
  error: string | null;
  timestamp: string;
}

export interface FakeGateway {
  fetch(request: Request): Promise<Response>;
  calls(): RecordedCall[];
  reset(): void;
}

export interface ListeningFake {
  port: number;
  url: string;
  server: Server;
  close(): Promise<void>;
}

export declare const DEFAULT_SPEC_PATH: string;
export declare const GATEWAY_VERSION: string;
export declare const LIFE_EDITOR_COMMIT: string;
export declare function createFakeGateway(
  options: FakeGatewayOptions,
): FakeGateway;
export declare function listen(
  gateway: FakeGateway,
  port?: number,
  host?: string,
): Promise<ListeningFake>;
