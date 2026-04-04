<script lang="ts">
  import type { ExtractionProgressState } from '$lib/extraction-progress';

  let {
    extractStatus = 'IDLE',
    extractionProgress,
    stopRequestPending = false,
    onStart = () => {},
    onStop = () => {}
  } = $props();
</script>

<div class="space-y-3 rounded-[18px] bg-[#fbf7f0] px-4 py-3">
  <div class="flex items-center justify-between gap-3">
    {#if extractStatus === 'DONE'}
      <span class="chip border-[#a8c4a0] bg-[#eaf3e5] text-[#5a7a4a]">{extractStatus}</span>
    {:else if extractStatus === 'RUNNING' || extractStatus === 'QUEUED'}
      <span class="chip border-[#d4b896] bg-[#faf3e8] text-[#9c6a38]">{extractStatus}</span>
    {:else if extractStatus === 'ERROR'}
      <span class="chip border-[#c4a0a0] bg-[#f5eaea] text-[#8a4a4a]">{extractStatus}</span>
    {:else if extractStatus === 'STOPPED' || extractStatus === 'PARTIAL'}
      <span class="chip border-[#d4c4a0] bg-[#f5f0e0] text-[#8a7a3a]">{extractStatus}</span>
    {:else}
      <span class="chip border-[#d9c7b1] bg-[#fffaf2] text-[#7a6a58]">{extractStatus}</span>
    {/if}
    <span class="text-sm font-medium text-[#6a5a48]">
      {extractionProgress.processedChunks}<span class="font-normal text-[#a09080]">/{extractionProgress.totalChunks}</span>
    </span>
    {#if extractionProgress.failedChunks > 0}
      <span class="text-sm text-[#a05050]">{extractionProgress.failedChunks} 失败</span>
    {/if}
  </div>
  <div class="h-2 rounded-full bg-[#ece4da]">
    {#if extractStatus === 'DONE'}
      <div class="h-2 rounded-full bg-[#a8c4a0] transition-all duration-500" style={`width:${extractionProgress.progressPercent}%`}></div>
    {:else if extractStatus === 'ERROR'}
      <div class="h-2 rounded-full bg-[#c09090] transition-all duration-300" style={`width:${extractionProgress.progressPercent}%`}></div>
    {:else if extractStatus === 'RUNNING' || extractStatus === 'QUEUED'}
      <div class="h-2 rounded-full bg-[#d4a86a] transition-all duration-300" style={`width:${extractionProgress.progressPercent}%`}></div>
    {:else}
      <div class="h-2 rounded-full bg-[#c4b090] transition-all duration-300" style={`width:${extractionProgress.progressPercent}%`}></div>
    {/if}
  </div>
</div>

{#if extractionProgress.isRunning}
  <button
    class="btn-secondary w-full py-2.5 text-sm font-medium text-[#9c5a55] disabled:cursor-not-allowed disabled:opacity-50"
    type="button"
    disabled={stopRequestPending}
    onclick={() => onStop()}
  >
    {extractionProgress.actionLabel}
  </button>
{:else}
  <button class="btn-primary w-full py-2.5 text-sm font-medium" type="button" onclick={() => onStart()}>
    {extractionProgress.actionLabel}
  </button>
{/if}
