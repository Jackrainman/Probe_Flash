import { execa } from 'execa';
import { CliBridgeError } from './types.js';

const MIN_LARK_CLI_MAJOR = 1;

let versionPromise: Promise<void> | null = null;

export function resetCliVersionCheck(): void {
  versionPromise = null;
}

export async function ensureLarkCli(): Promise<void> {
  if (versionPromise) return versionPromise;
  versionPromise = (async () => {
    let stdout: string;
    try {
      const result = await execa('lark', ['--version']);
      stdout = result.stdout;
    } catch (err) {
      versionPromise = null;
      throw new CliBridgeError(
        'lark-cli not found on PATH. Install: npm install -g @larksuite/cli',
        undefined,
        (err as Error).message,
      );
    }
    const match = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match || Number(match[1]) < MIN_LARK_CLI_MAJOR) {
      versionPromise = null;
      throw new CliBridgeError(
        `lark-cli >= ${MIN_LARK_CLI_MAJOR}.x required, got "${stdout.trim()}"`,
        undefined,
        '',
      );
    }
  })();
  return versionPromise;
}

export async function cliApi<T = unknown>(
  method: string,
  payload: unknown,
): Promise<T> {
  await ensureLarkCli();
  const args = ['api', method, '--data', JSON.stringify(payload)];
  try {
    const { stdout } = await execa('lark', args);
    return JSON.parse(stdout) as T;
  } catch (err) {
    const e = err as { exitCode?: number; stderr?: string; message: string };
    throw new CliBridgeError(
      `lark api ${method} failed`,
      e.exitCode,
      e.stderr ?? e.message,
    );
  }
}
