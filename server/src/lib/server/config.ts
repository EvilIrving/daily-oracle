import type { ExtractionConfig } from '../types';
import { createDb, readConfig, writeConfig } from './db';
import { loadPromptTemplate } from './ai-client';

export function getDefaultConfig(): ExtractionConfig {
  return {
    apiBaseUrl: process.env.API_BASE_URL || process.env.APIURL || '',
    apiKey: process.env.API_KEY || process.env.APIKEY || '',
    model: process.env.MODEL || 'glm-4.7',
    chunkSize: Number.parseInt(process.env.CHUNK_SIZE || '3000', 10),
    concurrency: Number.parseInt(process.env.CONCURRENCY || '3', 10),
    temperature: Number.parseFloat(process.env.TEMPERATURE || '0.3'),
    maxTokens: Number.parseInt(process.env.MAX_TOKENS || '65536', 10),
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
