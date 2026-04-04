import { browser } from '$app/environment';

// ==================== 类型定义 ====================

export type ExtractConfig = {
  apiUrl: string;
  model: string;
  apiKey: string;
  chunkSize: number;
  concurrency: number;
  temperature: number;
  topP: number;
  prompt: string;
};

export type ProviderProfile = {
  id: string;
  name: string;
  config: ExtractConfig;
};

export type ProviderConfigState = {
  activeProviderId: string;
  providers: ProviderProfile[];
};

// ==================== 工具函数 ====================
const LEGACY_CONFIG_STORAGE_KEY = 'daily-quote.extract-config';
const CONFIG_STORAGE_KEY = 'daily-quote.extract-config.providers.v1';

export function createEmptyConfig(): ExtractConfig {
  return {
    apiUrl: '',
    model: '',
    apiKey: '',
    chunkSize: 3000,
    concurrency: 1,
    temperature: 0.2,
    topP: 0.9,
    prompt: ''
  };
}

export function createEmptyProviderState(): ProviderConfigState {
  return { activeProviderId: '', providers: [] };
}

export function createProviderState(baseConfig: ExtractConfig): ProviderConfigState {
  const newId = `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    activeProviderId: newId,
    providers: [{ id: newId, name: `提供商 1`, config: normalizeConfig(baseConfig) }]
  };
}

export function normalizeConfig(input: Partial<ExtractConfig> | null | undefined): ExtractConfig {
  const fallback = createEmptyConfig();
  const next = input || {};
  const toFiniteNumber = (value: unknown, defaultValue: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };
  return {
    apiUrl: String(next.apiUrl ?? fallback.apiUrl),
    model: String(next.model ?? fallback.model),
    apiKey: String(next.apiKey ?? fallback.apiKey),
    chunkSize: toFiniteNumber(next.chunkSize, fallback.chunkSize),
    concurrency: toFiniteNumber(next.concurrency, fallback.concurrency),
    temperature: toFiniteNumber(next.temperature, fallback.temperature),
    topP: toFiniteNumber(next.topP, fallback.topP),
    prompt: String(next.prompt ?? fallback.prompt)
  };
}

export function stripPromptFromConfig(input: Partial<ExtractConfig> | null | undefined): Partial<ExtractConfig> {
  if (!input) return {};
  const { prompt: _prompt, ...rest } = input;
  return rest;
}

export function normalizeProviderState(
  input: Partial<ProviderConfigState> | null | undefined,
  baseConfig: ExtractConfig
): ProviderConfigState {
  const fallback = createProviderState(baseConfig);
  const rawProviders = Array.isArray(input?.providers) ? input?.providers : [];
  const providerMap = new Map<string, ProviderProfile>();

  for (const raw of rawProviders) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').trim();
    if (!id) continue;
    providerMap.set(id, {
      id,
      name: String(raw.name || id),
      config: normalizeConfig(stripPromptFromConfig(raw.config))
    });
  }

  let providers: ProviderProfile[];
  if (providerMap.size > 0) {
    providers = Array.from(providerMap.values());
  } else {
    const newId = `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    providers = [{
      id: newId,
      name: `提供商 1`,
      config: normalizeConfig(stripPromptFromConfig(baseConfig))
    }];
  }

  const requestedActiveId = String(input?.activeProviderId || '').trim();
  const activeProviderId = providers.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : providers[0]?.id || fallback.activeProviderId;

  return { activeProviderId, providers };
}

export function getProviderById(state: ProviderConfigState, id: string): ProviderProfile | null {
  return state.providers.find((provider) => provider.id === id) ?? null;
}

export function loadLocalProviderState(baseConfig: ExtractConfig): ProviderConfigState | null {
  if (!browser) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      return normalizeProviderState(JSON.parse(raw), baseConfig);
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_CONFIG_STORAGE_KEY);
    if (!legacyRaw) return null;
    const legacyConfig = normalizeConfig(stripPromptFromConfig(JSON.parse(legacyRaw)));
    return createProviderState(legacyConfig);
  } catch {
    return null;
  }
}

export function persistLocalProviderState(nextState: ProviderConfigState): void {
  if (!browser) return;
  const persistedState: ProviderConfigState = {
    activeProviderId: nextState.activeProviderId,
    providers: nextState.providers.map((provider) => ({
      ...provider,
      config: normalizeConfig(stripPromptFromConfig(provider.config))
    }))
  };
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(persistedState));
}
