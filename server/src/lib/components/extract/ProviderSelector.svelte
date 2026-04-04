<script lang="ts">
  let {
    providers = [],
    activeProviderId = '',
    onSwitch = () => {},
    onAdd = () => {},
    onRemove = () => {},
    onEdit = () => {}
  } = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each providers as provider}
    <div class="group relative">
      <button
        class="chip cursor-pointer transition-all"
        class:is-active={provider.id === activeProviderId}
        onclick={() => onSwitch(provider.id)}
        ondblclick={() => onEdit(provider)}
        type="button"
      >
        {provider.name}
      </button>
      <button
        class="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#c4b0a0] text-[9px] text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-[#a08070]"
        class:hidden={providers.length <= 1}
        onclick={(e) => { e.stopPropagation(); onRemove(provider.id); }}
        type="button"
      >
        ×
      </button>
    </div>
  {/each}
  <button
    class="chip cursor-pointer border-dashed transition-all hover:border-[#c4b0a0] hover:bg-[#faf5ee]"
    onclick={() => onAdd()}
    type="button"
  >
    + 新增
  </button>
</div>
