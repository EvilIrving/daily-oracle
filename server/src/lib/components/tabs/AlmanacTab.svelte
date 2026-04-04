<script lang="ts">
  type AlmanacTodayCard = {
    dateLabel: string;
    archivedAt: string;
    signals: string[];
    yi: string;
    ji: string;
  };

  type AlmanacEntry = {
    id?: string;
    date: string;
    week: string;
    weather: string;
    temp: string;
    yi: string;
    ji: string;
  };

  let {
    almanacToday = null,
    almanacHistory = []
  } = $props();
</script>

<div class="px-4 py-4 sm:px-6 sm:py-5 flex-1 min-h-0 flex flex-col overflow-hidden">
  <section class="soft-panel overflow-hidden flex-1 min-h-0 flex flex-col">
    {#each almanacToday ? [almanacToday] : [] as today}
      <section class="space-y-4 border-b border-[#ded4c7] px-4 py-4 sm:px-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-[1.04rem] font-medium text-ink">{today.dateLabel}</h3>
          <span class="text-sm text-[#7b6b59]">{today.archivedAt}</span>
        </div>

        <div class="flex flex-wrap gap-2">
          {#each today.signals as signal}
            <span class="chip">{signal}</span>
          {/each}
        </div>

        <div class="space-y-3">
          <div class="flex items-start gap-3">
            <span class="rounded-[8px] bg-[#eef7d8] px-2 py-1 text-[0.84rem] text-[#668331]">宜</span>
            <p class="quote-text text-[1rem]">{today.yi}</p>
          </div>
          <div class="flex items-start gap-3">
            <span class="rounded-[8px] bg-[#fff0d3] px-2 py-1 text-[0.84rem] text-[#9a7124]">忌</span>
            <p class="quote-text text-[1rem]">{today.ji}</p>
          </div>
        </div>
      </section>
    {/each}

    <div class="flex-1 min-h-0 overflow-y-auto">
      {#if almanacHistory.length}
        {#each almanacHistory as entry}
          <article class="border-b border-[#ded4c7] px-4 py-5 sm:px-5">
            <div class="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)]">
              <div class="text-sm text-[#7b6b59]">{entry.date}</div>
              <div class="space-y-2">
                <p class="quote-text text-[0.98rem]"><span class="mr-2 font-medium">宜</span>{entry.yi}</p>
                <p class="quote-text text-[0.98rem]"><span class="mr-2 font-medium">忌</span>{entry.ji}</p>
                <div class="flex flex-wrap gap-2">
                  <span class="chip">{entry.weather}</span>
                  <span class="chip">{entry.temp}</span>
                  <span class="chip">{entry.week}</span>
                </div>
              </div>
            </div>
          </article>
        {/each}
      {:else}
        <div class="px-4 py-12 text-center text-sm text-[#7b6b59] sm:px-5">
          还没有宜忌记录。
        </div>
      {/if}
    </div>
  </section>
</div>
