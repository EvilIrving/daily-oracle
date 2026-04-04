<script lang="ts">
  import { notifySuccess } from '$lib/notifications';

  type Action = {
    label: string;
    onClick: () => void;
    tone?: 'default' | 'danger';
    disabled?: boolean;
  };

  let {
    text = '',
    textCn = null,
    why = null,
    location = null,
    author = '未知作者',
    work = '未知作品',
    year = null,
    genre = '未标注',
    moods = [],
    themes = [],
    dot = '#b59067',
    actions = []
  } = $props();

  async function copyText() {
    const textToCopy = textCn || text;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      notifySuccess('句子已复制到剪贴板');
    } catch {
      notifySuccess('复制失败');
    }
  }
</script>

<article
  class="flex flex-wrap items-start justify-between gap-1.5 border-b border-[#ded4c7] px-3 py-2 transition-all duration-200 ease-out motion-safe:hover:-translate-y-px hover:border-[#d4c4b0] hover:bg-[#faf6f0] hover:shadow-[inset_0_0_0_1px_rgba(196,176,160,0.28)] sm:px-4"
>
  <div class="min-w-0 flex-1">
    <div class="flex items-start gap-2">
      <span class="tiny-dot mt-1" style={`background:${dot}`}></span>
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <p class:quote-text={!textCn} class:text-[1.08rem]={!textCn} class:text-[0.98rem]={!!textCn} class:leading-7={!!textCn} class:flex-1={true}>
            {text}
          </p>
          <button
            class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c4b0a0] bg-[#faf6f0] text-[#8b7968] transition-all hover:border-[#b59067] hover:bg-[#f5ebe0] hover:text-[#b59067]"
            type="button"
            title="复制句子"
            onclick={copyText}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
        </div>
        {#if textCn}
          <div class="flex items-start gap-2">
            <p class="mt-1 text-[0.9rem] leading-6 text-[#8b7968] flex-1">{textCn}</p>
            <button
              class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c4b0a0] bg-[#faf6f0] text-[#8b7968] transition-all hover:border-[#b59067] hover:bg-[#f5ebe0] hover:text-[#b59067]"
              type="button"
              title="复制译文"
              onclick={copyText}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
          </div>
        {/if}
        <div class="mt-1.5 flex flex-wrap items-center gap-1 text-[0.78rem] text-[#7b6b59]">
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
        {#if why}
          <p class="mt-1.5 text-[0.82rem] leading-5 text-[#6f604f]">{why}</p>
        {/if}
        {#if location}
          <p class="mt-0.5 text-[0.78rem] leading-5 text-[#8b7968]">{location}</p>
        {/if}
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
          onclick={action.onClick}
        >
          {action.label}
        </button>
      {/each}
    </div>
  {/if}
</article>
