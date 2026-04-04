<script lang="ts">
  type BookFile = {
    id?: string;
    name: string;
    sizeLabel: string;
    title: string;
    author: string;
    year?: number | null;
    language?: string | null;
    genre?: string | null;
    bodyLength?: number;
    status: string;
  };

  let {
    selectedFiles = [],
    currentBookId = '',
    getStatusDotColor = (status: string) => '#a89880',
    onSelectBook = (bookId: string) => {},
    onDeleteBook = (bookId: string) => {}
  } = $props();
</script>

{#if selectedFiles.length > 0}
  <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
    {#each selectedFiles as file}
      <div class="group relative">
        <button
          class={`flex w-full items-center justify-between rounded-[14px] px-3 py-2 pr-10 text-left text-sm transition-all duration-200 ease-out motion-safe:hover:-translate-y-px ${
            currentBookId === file.id
              ? 'bg-[#eadfce] shadow-sm ring-1 ring-[#c4b0a0]/35 hover:bg-[#e5d8c4] hover:shadow-md hover:ring-[#b59067]/45'
              : 'bg-[#f6f2eb] ring-1 ring-transparent hover:bg-[#efe8de] hover:shadow-md hover:ring-[#d4c7b8]/60'
          }`}
          type="button"
          onclick={() => onSelectBook(file.id || '')}
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="inline-block h-2.5 w-2.5 flex-none rounded-full"
                style={`background-color: ${getStatusDotColor(file.status)}`}
                title={`状态：${file.status}`}
              ></span>
              <p class="truncate font-medium text-[#5f5244]">{file.title || file.name}</p>
            </div>
            <p class="mt-0.5 truncate text-xs text-[#867562]">
              {#if file.author}{file.author}{/if}{#if file.author && file.year} · {/if}{#if file.year}{file.year}{/if}
              {#if file.sizeLabel}<span class="ml-1 text-[#a89880]">{file.sizeLabel}</span>{/if}
            </p>
          </div>
        </button>
        <button
          class="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[#dbcbb9] bg-[#fffaf2] text-sm text-[#9c5a55] opacity-100 shadow-sm transition sm:opacity-0 sm:group-hover:opacity-100"
          type="button"
          aria-label={`删除《${file.title || file.name}》`}
          onclick={(e) => { e.stopPropagation(); onDeleteBook(file.id || ''); }}
        >
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}
