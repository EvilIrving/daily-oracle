type LogLevel = 'INFO' | 'ERROR';

function stringify(payload: unknown): string {
  if (payload === undefined) {
    return '';
  }

  try {
    return JSON.stringify(
      payload,
      (_key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          };
        }

        return value;
      },
      2
    );
  } catch (error) {
    return JSON.stringify({
      message: 'LOG_SERIALIZE_FAILED',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function write(level: LogLevel, scope: string, message: string, payload?: unknown) {
  const prefix = `[${new Date().toISOString()}] [${level}] [${scope}] ${message}`;
  const details = stringify(payload);

  if (details) {
    const writer = level === 'ERROR' ? console.error : console.info;
    writer(`${prefix}\n${details}`);
    return;
  }

  if (level === 'ERROR') {
    console.error(prefix);
    return;
  }

  console.info(prefix);
}

export function logInfo(scope: string, message: string, payload?: unknown) {
  write('INFO', scope, message, payload);
}

export function logError(scope: string, message: string, payload?: unknown) {
  write('ERROR', scope, message, payload);
}
