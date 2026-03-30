<script lang="ts">
  type Action = {
    label: string;
    onClick: () => void;
    tone?: 'default' | 'danger';
    disabled?: boolean;
  };

  export let text = '';
  export let author = '未知作者';
  export let work = '未知作品';
  export let year: number | null = null;
  export let genre = '未标注';
  export let moods: string[] = [];
  export let themes: string[] = [];
  export let dot = '#b59067';
  export let actions: Action[] = [];
</script>

<article class="flex flex-wrap items-start justify-between gap-4 border-b border-[#ded4c7] px-4 py-5 sm:px-5">
  <div class="min-w-0 flex-1">
    <div class="flex items-start gap-3">
      <span class="tiny-dot mt-2" style={`background:${dot}`}></span>
      <div class="min-w-0">
        <p class="quote-text text-[1.08rem]">{text}</p>
        <div class="mt-4 flex flex-wrap items-center gap-2 text-[0.84rem] text-[#7b6b59]">
          <span>{author}</span>
          <span>{work}</span>
          {#if year}
            <span>{year}</span>
          {/if}
          <span>{genre}</span>
          {#each moods as mood}
            <span class="tag">{mood}</span>
          {/each}
          {#each themes as theme}
            <span class="tag">{theme}</span>
          {/each}
        </div>
      </div>
    </div>
  </div>

  {#if actions.length}
    <div class="action-stack flex items-center gap-2">
      {#each actions as action}
        <button
          class:action-button={action.tone !== 'danger'}
          class:btn-secondary={action.tone === 'danger'}
          class:px-3={action.tone === 'danger'}
          class:py-1.5={action.tone === 'danger'}
          class:text-sm={action.tone === 'danger'}
          class:font-medium={action.tone === 'danger'}
          class:text-[#9c5a55]={action.tone === 'danger'}
          type="button"
          disabled={action.disabled}
          on:click={action.onClick}
        >
          {action.label}
        </button>
      {/each}
    </div>
  {/if}
</article>
