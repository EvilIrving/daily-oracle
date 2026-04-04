<script lang="ts">
  import QuoteCard from '$lib/components/QuoteCard.svelte';

  type LibraryQuote = {
    id: string;
    text: string;
    author: string;
    work: string;
    year?: number | null;
    genre: string;
    moods: string[];
    themes: string[];
    dot: string;
  };

  let {
    libraryQuotes = [],
    selectedLibraryAuthor = 'all',
    selectedLibraryMood = 'all',
    selectedLibraryTheme = 'all',
    authorFiltersExpanded = false,
    moodFiltersExpanded = false,
    themeFiltersExpanded = false,
    deletingLibraryQuoteIds = new Set<string>(),
    onSelectAuthor = (value: string) => {},
    onSelectMood = (value: string) => {},
    onSelectTheme = (value: string) => {},
    onDeleteQuote = (id: string) => {}
  } = $props();

const VISIBLE_LIMIT = 8;

  function buildLibraryOptions(values: string[], allLabel: string) {
    const counts = new Map<string, number>();
    for (const value of values) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [
      { value: 'all', label: allLabel, count: values.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
        .map(([value, count]) => ({ value, label: value, count }))
    ];
  }

  function visibleLibraryOptions(
    options: { value: string; label: string; count: number }[],
    expanded: boolean,
    limit = 8
  ) {
    if (expanded || options.length <= limit) return options;
    return options.slice(0, limit);
  }

  function applyLibraryFilters(
    quotes: LibraryQuote[],
    authorFilter: string,
    moodFilter: string,
    themeFilter: string
  ) {
    return quotes.filter((quote) => {
      const authorMatch = authorFilter === 'all' || quote.author === authorFilter;
      const moodMatch = moodFilter === 'all' || quote.moods.includes(moodFilter);
      const themeMatch = themeFilter === 'all' || quote.themes.includes(themeFilter);
      return authorMatch && moodMatch && themeMatch;
    });
  }

  let libraryAuthorOptionsDerived = $derived(
    buildLibraryOptions(
      libraryQuotes.map((quote) => quote.author).filter(Boolean),
      '全部'
    )
  );
  let libraryMoodOptionsDerived = $derived(
    buildLibraryOptions(
      libraryQuotes.flatMap((quote) => quote.moods).filter(Boolean),
      '全部'
    )
  );
  let libraryThemeOptionsDerived = $derived(
    buildLibraryOptions(
      libraryQuotes.flatMap((quote) => quote.themes).filter(Boolean),
      '全部'
    )
  );

  let filteredLibraryQuotesDerived = $derived(
    applyLibraryFilters(
      libraryQuotes,
      selectedLibraryAuthor,
      selectedLibraryMood,
      selectedLibraryTheme
    )
  );

  function handleSelectAuthor(value: string) {
    onSelectAuthor(value);
  }

  function handleSelectMood(value: string) {
    onSelectMood(value);
  }

  function handleSelectTheme(value: string) {
    onSelectTheme(value);
  }

  $effect(() => {
    if (selectedLibraryAuthor !== 'all' && !libraryAuthorOptionsDerived.some((option) => option.value === selectedLibraryAuthor)) {
      onSelectAuthor('all');
    }
  });
  $effect(() => {
    if (selectedLibraryMood !== 'all' && !libraryMoodOptionsDerived.some((option) => option.value === selectedLibraryMood)) {
      onSelectMood('all');
    }
  });
  $effect(() => {
    if (selectedLibraryTheme !== 'all' && !libraryThemeOptionsDerived.some((option) => option.value === selectedLibraryTheme)) {
      onSelectTheme('all');
    }
  });
</script>

<div class="px-4 py-4 sm:px-6 sm:py-5 flex-1 min-h-0 flex flex-col overflow-hidden">
  <section class="soft-panel overflow-hidden flex-1 min-h-0 flex flex-col">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-4 sm:px-5">
      <div class="min-w-0 flex-1 space-y-3">
        <div class="flex items-start gap-3 text-sm text-[var(--muted)]">
          <span class="w-12 shrink-0 pt-1">作者</span>
          <div class="min-w-0 flex-1 flex flex-wrap items-center gap-2">
            {#each visibleLibraryOptions(libraryAuthorOptionsDerived, authorFiltersExpanded, VISIBLE_LIMIT) as option}
              <button
                type="button"
                class="chip chip-action"
                class:is-active={selectedLibraryAuthor === option.value}
                aria-pressed={selectedLibraryAuthor === option.value}
                onclick={() => handleSelectAuthor(option.value)}
              >
                {option.label} {option.count}
              </button>
            {/each}
            {#if libraryAuthorOptionsDerived.length > VISIBLE_LIMIT}
              <button
                type="button"
                class="chip chip-action"
                aria-expanded={authorFiltersExpanded}
                onclick={() => (authorFiltersExpanded = !authorFiltersExpanded)}
              >
                {authorFiltersExpanded ? '收起' : `... ${libraryAuthorOptionsDerived.length - VISIBLE_LIMIT}`}
              </button>
            {/if}
          </div>
        </div>
        <div class="flex items-start gap-3 text-sm text-[var(--muted)]">
          <span class="w-12 shrink-0 pt-1">心情</span>
          <div class="min-w-0 flex-1 flex flex-wrap items-center gap-2">
            {#each visibleLibraryOptions(libraryMoodOptionsDerived, moodFiltersExpanded, VISIBLE_LIMIT) as option}
              <button
                type="button"
                class="chip chip-action"
                class:is-active={selectedLibraryMood === option.value}
                aria-pressed={selectedLibraryMood === option.value}
                onclick={() => handleSelectMood(option.value)}
              >
                {option.label} {option.count}
              </button>
            {/each}
            {#if libraryMoodOptionsDerived.length > VISIBLE_LIMIT}
              <button
                type="button"
                class="chip chip-action"
                aria-expanded={moodFiltersExpanded}
                onclick={() => (moodFiltersExpanded = !moodFiltersExpanded)}
              >
                {moodFiltersExpanded ? '收起' : `... ${libraryMoodOptionsDerived.length - VISIBLE_LIMIT}`}
              </button>
            {/if}
          </div>
        </div>
        <div class="flex items-start gap-3 text-sm text-[var(--muted)]">
          <span class="w-12 shrink-0 pt-1">主题</span>
          <div class="min-w-0 flex-1 flex flex-wrap items-center gap-2">
            {#each visibleLibraryOptions(libraryThemeOptionsDerived, themeFiltersExpanded, VISIBLE_LIMIT) as option}
              <button
                type="button"
                class="chip chip-action"
                class:is-active={selectedLibraryTheme === option.value}
                aria-pressed={selectedLibraryTheme === option.value}
                onclick={() => handleSelectTheme(option.value)}
              >
                {option.label} {option.count}
              </button>
            {/each}
            {#if libraryThemeOptionsDerived.length > VISIBLE_LIMIT}
              <button
                type="button"
                class="chip chip-action"
                aria-expanded={themeFiltersExpanded}
                onclick={() => (themeFiltersExpanded = !themeFiltersExpanded)}
              >
                {themeFiltersExpanded ? '收起' : `... ${libraryThemeOptionsDerived.length - VISIBLE_LIMIT}`}
              </button>
            {/if}
          </div>
        </div>
      </div>
      <div class="text-sm text-[var(--muted)]">筛选结果 {filteredLibraryQuotesDerived.length} 条</div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      {#if filteredLibraryQuotesDerived.length}
        {#each filteredLibraryQuotesDerived as quote}
          <QuoteCard
            text={quote.text}
            author={quote.author}
            work={quote.work}
            year={quote.year ?? null}
            genre={quote.genre}
            moods={quote.moods}
            themes={quote.themes}
            dot={quote.dot}
            actions={[{
              label: '删除',
              onClick: () => onDeleteQuote(quote.id),
              tone: 'danger' as const,
              disabled: deletingLibraryQuoteIds.has(quote.id)
            }]}
          />
        {/each}
      {:else}
        <div class="px-4 py-12 text-center text-sm text-[var(--muted)] sm:px-5">
          还没有已入库名句。
        </div>
      {/if}
    </div>
  </section>
</div>
