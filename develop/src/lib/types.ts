// 类型定义

export interface BookMeta {
  title: string | null;
  author: string | null;
  year: number | null;
  language: string | null;
  genre: string | null;
}

export interface ParsedBook {
  meta: BookMeta;
  body: string;
  header: string;
}

export interface TextChunk {
  index: number;
  text: string;
  charCount: number;
}

// 模型配置
export type ModelProvider = 'anthropic' | 'openai';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  apiBaseUrl?: string;
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  concurrency: number;
}

// 流程配置
export interface ExtractProcessConfig {
  modelConfig: ModelConfig;
  chunkSize: number;
  prompt: string;
}

export interface ReviewProcessConfig {
  modelConfig: ModelConfig;
  mode: 'one-by-one' | 'chunk-by-chunk';
  batchSize: number;
  prompt: string;
}

// AI 提取结果
export interface ExtractedQuote {
  text: string;
}

// AI 精筛结果
export type ReviewDecision = 'approved' | 'rejected';
