<script lang="ts">
  type ReviewLogBook = {
    bookId: string;
    bookTitle: string | null;
    total: number;
    accepted: number;
    rejected: number;
    lastDecidedAt: string;
  };

  let {
    reviewLogBooks = [],
    reviewLogLoading = false,
    onRefresh = () => {},
    onExport = (_bookId: string) => {}
  } = $props();
</script>

<div class="px-4 py-4 sm:px-6 sm:py-5 flex-1 min-h-0 flex flex-col overflow-hidden">
  <section class="soft-panel overflow-hidden flex-1 min-h-0 flex flex-col">
    <header class="flex items-center justify-between border-b border-[#ded4c7] px-4 py-3.5 sm:px-5">
      <h2 class="text-[0.98rem] font-medium text-ink">审核日志</h2>
      <button class="btn btn-ghost text-xs" onclick={() => onRefresh()}>
        刷新
      </button>
    </header>
    <div class="flex-1 min-h-0 overflow-y-auto">
      {#if reviewLogLoading}
        <div class="px-4 py-12 text-center text-sm text-[#7b6b59] sm:px-5">加载中...</div>
      {:else if reviewLogBooks.length}
        {#each reviewLogBooks as book}
          <div class="flex items-center justify-between border-b border-[#ded4c7] px-4 py-3.5 sm:px-5">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-ink">{book.bookTitle || book.bookId}</div>
              <div class="mt-1 flex gap-3 text-xs text-[#7b6b59]">
                <span>共 {book.total} 条</span>
                <span class="text-green-700">收 {book.accepted}</span>
                <span class="text-red-700">弃 {book.rejected}</span>
                <span>采纳率 {book.total ? Math.round((book.accepted / book.total) * 100) : 0}%</span>
              </div>
            </div>
            <button class="btn btn-outline text-xs" onclick={() => onExport(book.bookId)}>
              导出 JSON
            </button>
          </div>
        {/each}
      {:else}
        <div class="px-4 py-12 text-center text-sm text-[#7b6b59] sm:px-5">
          还没有审核记录。
        </div>
      {/if}
    </div>
  </section>
</div>
