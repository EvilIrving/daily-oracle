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
</script>

<script lang="ts">
  let {
    config,
    promptExpanded = false,
    onTogglePrompt = () => {},
    onUpdateConfig = () => {},
    onCopyValue = () => {}
  } = $props();

  function updateField<K extends keyof ExtractConfig>(field: K, value: ExtractConfig[K]) {
    onUpdateConfig({ ...config, [field]: value });
  }
</script>

<div>
  <button
    class="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[#85715d] transition hover:text-[#5f4e3b]"
    type="button"
    onclick={() => onTogglePrompt()}
  >
    <span class="inline-block transition-transform duration-150" class:rotate-90={promptExpanded}>▶</span>
    Prompt
  </button>
  {#if promptExpanded}
    <textarea
      class="field mt-2 min-h-[80px] w-full resize-none overflow-y-auto px-4 py-3 text-sm leading-7 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      bind:value={config.prompt}
      onchange={(e) => updateField('prompt', e.currentTarget.value)}
    ></textarea>
  {/if}
</div>
