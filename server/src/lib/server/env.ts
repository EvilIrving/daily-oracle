import { env as privateEnv } from '$env/dynamic/private';

export function readServerEnv(...keys: string[]) {
  for (const key of keys) {
    const value = privateEnv[key] || process.env[key];
    if (value) return value;
  }

  return '';
}

export function requireServerEnv(...keys: string[]) {
  const value = readServerEnv(...keys);
  if (value) return value;

  throw new Error(`缺少环境变量：${keys.join(' / ')}`);
}
