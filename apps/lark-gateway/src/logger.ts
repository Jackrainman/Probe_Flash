// Minimal structured logger. Console-only for MVP; format is JSON-ish line
// so logs can be grep'd. Replace with pino / winston post-MVP if needed.

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const line = meta
    ? `[${level}] ${msg} ${JSON.stringify(meta)}`
    : `[${level}] ${msg}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
