export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface IpcChannelMetrics {
  channel: string;
  callCount: number;
  totalMs: number;
  maxMs: number;
  avgMs: number;
  slowQueries: { timestamp: string; durationMs: number }[];
}

export interface SystemInfo {
  appVersion: string;
  platform: string;
  arch: string;
  dbSizeBytes: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  tableCounts: Record<string, number>;
}
