import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ModelConfig } from './types';

const REQUEST_TIMEOUT_MS = 120_000;

export interface AiRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}

export interface AiClient {
  call(options: AiRequestOptions): Promise<string>;
}

// Anthropic 客户端
class AnthropicClient implements AiClient {
  constructor(private config: ModelConfig) {}

  async call(options: AiRequestOptions): Promise<string> {
    const baseURL = this.config.apiBaseUrl?.trim();
    const useBearerAuth = baseURL != null && baseURL.toLowerCase().includes('longcat');

    const client = new Anthropic({
      baseURL,
      ...(useBearerAuth
        ? { apiKey: null as unknown as string, authToken: this.config.apiKey }
        : { apiKey: this.config.apiKey, authToken: null })
    });

    const response = await this.withTimeout(
      client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          system: options.systemPrompt,
          messages: [{ role: 'user', content: options.userPrompt }]
        },
        options.signal ? { signal: options.signal } : undefined
      ),
      REQUEST_TIMEOUT_MS,
      options.signal
    );

    return response.content
      .map((item) => ('text' in item ? item.text : ''))
      .join('\n')
      .trim();
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    externalSignal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`AI 请求超时（>${timeoutMs / 1000}s）。`));
    }, timeoutMs);

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timer);
        controller.abort(externalSignal.reason);
        throw externalSignal.reason;
      }

      externalSignal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.abort(externalSignal.reason);
      }, { once: true });
    }

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(controller.signal.reason));
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}

// OpenAI 客户端
class OpenAIClient implements AiClient {
  constructor(private config: ModelConfig) {}

  async call(options: AiRequestOptions): Promise<string> {
    const client = new OpenAI({
      baseURL: this.config.apiBaseUrl,
      apiKey: this.config.apiKey
    });

    const response = await this.withTimeout(
      client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt }
        ]
      }),
      REQUEST_TIMEOUT_MS,
      options.signal
    );

    return response.choices[0]?.message?.content?.trim() || '';
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    externalSignal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`AI 请求超时（>${timeoutMs / 1000}s）。`));
    }, timeoutMs);

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timer);
        controller.abort(externalSignal.reason);
        throw externalSignal.reason;
      }

      externalSignal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.abort(externalSignal.reason);
      }, { once: true });
    }

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(controller.signal.reason));
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}

// 工厂函数
export function createAiClient(config: ModelConfig): AiClient {
  if (config.provider === 'openai') {
    return new OpenAIClient(config);
  }
  return new AnthropicClient(config);
}

// 并发控制
export class ConcurrencyControl {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrency: number) {
    if (maxConcurrency < 1) {
      throw new Error('maxConcurrency must be at least 1');
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  get activeCount(): number {
    return this.running;
  }
}
