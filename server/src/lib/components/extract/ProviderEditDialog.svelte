<script module lang="ts">
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
</script>

<script lang="ts">
  let {
    provider,
    name,
    config,
    onConfirm = () => {},
    onCancel = () => {}
  } = $props();

  function updateField<K extends keyof ExtractConfig>(field: K, value: ExtractConfig[K]) {
    config = { ...config, [field]: value };
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
  onclick={(event) => {
    if (event.target === event.currentTarget) onCancel();
  }}
  onkeydown={(e) => e.key === 'Escape' && onCancel()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="soft-panel w-[420px] max-h-[90vh] overflow-y-auto p-5" role="presentation" onclick={(event) => event.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <p class="mb-4 text-sm font-medium text-ink">编辑提供商</p>
    <div class="space-y-3">
      <label class="block">
        <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">名称</span>
        <input class="field w-full px-3 py-2 text-sm" bind:value={name} onkeydown={(e) => { if (e.key === 'Escape') onCancel(); }} />
      </label>
      <label class="block">
        <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API URL</span>
        <input class="field w-full px-3 py-2 text-sm" bind:value={config.apiUrl} onchange={(e) => updateField('apiUrl', e.currentTarget.value)} />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">模型</span>
          <input class="field w-full px-3 py-2 text-sm" bind:value={config.model} onchange={(e) => updateField('model', e.currentTarget.value)} />
        </label>
        <label class="block">
          <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">并发数</span>
          <input class="field w-full px-3 py-2 text-sm" type="number" min="1" max="10" step="1" bind:value={config.concurrency} onchange={(e) => updateField('concurrency', Number(e.currentTarget.value))} />
        </label>
      </div>
      <label class="block">
        <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API KEY</span>
        <input class="field w-full px-3 py-2 text-sm font-mono" type="password" bind:value={config.apiKey} onchange={(e) => updateField('apiKey', e.currentTarget.value)} />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <div class="mb-1 flex items-center justify-between text-[11px] text-[#6f604f]">
            <span class="uppercase tracking-[0.12em]">Temperature</span>
            <span>{Number(config.temperature).toFixed(1)}</span>
          </div>
          <input class="w-full accent-[#b59067]" type="range" min="0" max="1" step="0.1" bind:value={config.temperature} onchange={(e) => updateField('temperature', Number(e.currentTarget.value))} />
        </label>
        <label class="block">
          <div class="mb-1 flex items-center justify-between text-[11px] text-[#6f604f]">
            <span class="uppercase tracking-[0.12em]">Top P</span>
            <span>{Number(config.topP).toFixed(2)}</span>
          </div>
          <input class="w-full accent-[#b59067]" type="range" min="0" max="1" step="0.01" bind:value={config.topP} onchange={(e) => updateField('topP', Number(e.currentTarget.value))} />
        </label>
      </div>
      <label class="block">
        <div class="mb-1 flex items-center justify-between text-[11px] text-[#6f604f]">
          <span class="uppercase tracking-[0.12em]">切片</span>
          <span>{config.chunkSize}</span>
        </div>
        <input class="w-full accent-[#b59067]" type="range" min="1000" max="6000" step="500" bind:value={config.chunkSize} onchange={(e) => updateField('chunkSize', Number(e.currentTarget.value))} />
      </label>
    </div>
    <div class="mt-5 flex justify-end gap-2">
      <button class="btn-secondary px-4 py-2 text-sm" onclick={() => onCancel()} type="button">取消</button>
      <button class="btn-primary px-4 py-2 text-sm" onclick={() => onConfirm()} type="button">保存</button>
    </div>
  </div>
</div>
