import type { ExtractionConfig } from '../types';
import { createDb, readConfig, writeConfig } from './db';
import { loadPromptTemplate } from './ai-client';
import { readServerEnv } from './env';

export function getDefaultConfig(): ExtractionConfig {
  return {
    apiBaseUrl: readServerEnv('API_BASE_URL', 'APIURL'),
    apiKey: readServerEnv('API_KEY', 'APIKEY'),
    model: readServerEnv('MODEL') || 'glm-4.7',
    chunkSize: Number.parseInt(readServerEnv('CHUNK_SIZE') || '3000', 10),
    concurrency: Number.parseInt(readServerEnv('CONCURRENCY') || '3', 10),
    temperature: Number.parseFloat(readServerEnv('TEMPERATURE') || '0.3'),
    topP: Number.parseFloat(readServerEnv('TOP_P') || '0.9'),
    topK: Number.parseInt(readServerEnv('TOP_K') || '50', 10),
    maxTokens: Number.parseInt(readServerEnv('MAX_TOKENS') || '4096', 10),
    promptTemplate: loadPromptTemplate()
  };
}

export function getStoredConfig(): ExtractionConfig {
  const db = createDb();
  const persisted = readConfig(db);
  const defaults = getDefaultConfig();
  return {
    ...defaults,
    ...persisted,
    promptTemplate: persisted.promptTemplate || defaults.promptTemplate
  };
}

export function saveStoredConfig(next: Partial<ExtractionConfig>): ExtractionConfig {
  const db = createDb();
  writeConfig(db, next);
  return getStoredConfig();
}
