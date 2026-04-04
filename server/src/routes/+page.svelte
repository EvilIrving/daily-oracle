<script lang="ts">
  import { browser } from '$app/environment';
  import { notifyError, notifySuccess } from '$lib/notifications';
  import { type ExtractionProgressSnapshot } from '$lib/extraction-progress';
  import type { ExtractConfig, ProviderProfile, ProviderConfigState } from '$lib/composables/useProviderConfig';
  import {
    createEmptyConfig,
    createEmptyProviderState,
    normalizeConfig,
    getProviderById,
    loadLocalProviderState,
    persistLocalProviderState
  } from '$lib/composables/useProviderConfig';
  import type { BookFile, Candidate, LibraryQuote, AlmanacEntry, AlmanacTodayCard } from '$lib/composables/useMappers';
  import { mapBookSummary, mapCandidate, mapLibraryQuote, mapAlmanacEntry, mapAlmanacToday, formatFileSize } from '$lib/composables/useMappers';
  import ExtractTab from '$lib/components/tabs/ExtractTab.svelte';
  import LibraryTab from '$lib/components/tabs/LibraryTab.svelte';
  import AlmanacTab from '$lib/components/tabs/AlmanacTab.svelte';
  import ReviewLogTab from '$lib/components/tabs/ReviewLogTab.svelte';
  import ProviderEditDialog from '$lib/components/extract/ProviderEditDialog.svelte';

  type MainTab = 'extract' | 'library' | 'almanac' | 'review-log';
  type ReviewLogBook = { bookId: string; bookTitle: string | null; total: number; accepted: number; rejected: number; lastDecidedAt: string };

  const mainTabs: { id: MainTab; label: string }[] = [
    { id: 'extract', label: '提取' },
    { id: 'library', label: '名句库' },
    { id: 'almanac', label: '宜忌' },
    { id: 'review-log', label: '审核日志' }
  ];

  // --- 状态 ---
  let activeTab = $state<MainTab>('extract');
  let currentBookId = $state('');
  let currentRunId = $state('');
  let extractStatus = $state('IDLE');
  let runProcessedChunks = $state(0);
  let runTotalChunks = $state(0);
  let runFailedChunks = $state(0);
  let runActiveWorkers = $state(0);
  let runLastError: string | null = $state(null);
  let stopRequestPending = $state(false);
  let frozenExtractionProgress: ExtractionProgressSnapshot | null = $state(null);
  let progressStream: EventSource | null = null;
  let progressStreamBookId = $state('');

  let config = $state(createEmptyConfig());
  let providerState = $state(createEmptyProviderState());
  let activeProviderId = $derived.by(() => providerState.activeProviderId);
  let configReady = $state(false);

  let selectedFiles: BookFile[] = $state([]);
  let candidates: Candidate[] = $state([]);
  let runReviewTotal = $state(0);
  let runReviewAccepted = $state(0);

  let libraryQuotes: LibraryQuote[] = $state([]);
  let selectedLibraryAuthor = $state('all');
  let selectedLibraryMood = $state('all');
  let selectedLibraryTheme = $state('all');
  let authorFiltersExpanded = $state(false);
  let moodFiltersExpanded = $state(false);
  let themeFiltersExpanded = $state(false);
  let deletingLibraryQuoteIds = $state(new Set<string>());

  let almanacToday: AlmanacTodayCard | null = $state(null);
  let almanacHistory: AlmanacEntry[] = $state([]);
  let reviewLogBooks: ReviewLogBook[] = $state([]);
  let reviewLogLoading = $state(false);

  let editDialogProvider: ProviderProfile | null = $state(null);
  let editDialogName = $state('');
  let editDialogConfig = $state(createEmptyConfig());


  // --- 工具函数 ---
  function hydrateConfigFromProvider(providerId: string) {
    const provider = getProviderById(providerState, providerId) ?? providerState.providers[0] ?? null;
    if (!provider) return;
    config = normalizeConfig(provider.config);
    activeProviderId = provider.id;
  }

  function applyRunState(run: any) {
    if (!run) {
      currentRunId = '';
      extractStatus = 'IDLE';
      runProcessedChunks = 0;
      runTotalChunks = 0;
      runFailedChunks = 0;
      runActiveWorkers = 0;
      runLastError = null;
      stopRequestPending = false;
      frozenExtractionProgress = null;
      return;
    }
    currentRunId = run?.id || '';
    extractStatus = run?.status?.toUpperCase?.() || 'IDLE';
    runProcessedChunks = Number(run?.processedChunks ?? run?.processed_chunks ?? 0);
    runTotalChunks = Number(run?.totalChunks ?? run?.total_chunks ?? 0);
    runFailedChunks = Number(run?.failedChunks ?? run?.failed_chunks ?? 0);
    runActiveWorkers = Number(run?.activeWorkers ?? run?.active_workers ?? 0);
    runLastError = run?.lastError ?? run?.last_error ?? null;
    if (extractStatus === 'STOPPED') {
      if (!frozenExtractionProgress || frozenExtractionProgress.runId !== currentRunId) {
        frozenExtractionProgress = {
          runId: currentRunId,
          processedChunks: runProcessedChunks,
          failedChunks: runFailedChunks,
          activeWorkers: runActiveWorkers,
          totalChunks: runTotalChunks
        };
      }
      stopRequestPending = false;
      return;
    }
    if (frozenExtractionProgress?.runId === currentRunId && !stopRequestPending) {
      frozenExtractionProgress = null;
    }
    if (!['RUNNING', 'QUEUED'].includes(extractStatus)) {
      stopRequestPending = false;
    }
  }

  function syncFromExtractionPayload(payload: any, { preserveNotice = false } = {}) {
    applyRunState(payload.run);
    candidates = (payload.candidates || []).map(mapCandidate);
    const rt = payload.runReviewTotals as { total: number; accepted: number } | null | undefined;
    if (rt && typeof rt.total === 'number' && typeof rt.accepted === 'number') {
      runReviewTotal = rt.total;
      runReviewAccepted = rt.accepted;
    } else if (!payload.run) {
      runReviewTotal = 0;
      runReviewAccepted = 0;
    }
    if (preserveNotice) return;
  }

  // --- 提取进度流 ---
  function closeProgressStream() { progressStream?.close(); progressStream = null; progressStreamBookId = ''; }

  function ensureProgressStream(bookId: string) {
    if (!browser || !bookId) return;
    if (!currentRunId || !['RUNNING', 'QUEUED'].includes(extractStatus)) { closeProgressStream(); return; }
    if (progressStreamBookId && progressStreamBookId !== bookId) closeProgressStream();
    if (progressStream) return;
    progressStream = new EventSource(`/api/extract?bookId=${encodeURIComponent(bookId)}&stream=1`);
    progressStreamBookId = bookId;
    progressStream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        syncFromExtractionPayload(payload);
        if (!['RUNNING', 'QUEUED'].includes(extractStatus)) closeProgressStream();
      } catch (error) { console.error('Failed to parse extraction stream payload.', error); }
    };
    progressStream.onerror = async () => { closeProgressStream(); if (bookId) await refreshExtraction(bookId); };
  }

  // --- API 调用 ---
  async function refreshExtraction(bookId: string) {
    const response = await fetch(`/api/extract?bookId=${encodeURIComponent(bookId)}`);
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '读取提取结果失败。');
    const payload = await response.json();
    syncFromExtractionPayload(payload);
    ensureProgressStream(bookId);
  }

  async function importBooks(files: File[]) {
    if (!files.length) return;
    try {
      const mapped = await Promise.all(files.map(async (file) => {
        const text = await file.text();
        const response = await fetch('/api/books', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, rawText: text })
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'TXT 解析失败。');
        const payload = await response.json();
        const book = payload.book as { id: string; fileName: string; title: string; author: string | null;
          year: number | null; language: string | null; genre: string | null; bodyLength: number };
        return { ...mapBookSummary(book), sizeLabel: formatFileSize(file.size) };
      }));
      for (const book of mapped) upsertSelectedFile(book);
      currentBookId = mapped.at(-1)?.id || currentBookId;
      notifySuccess(`已完成 ${mapped.length} 本 txt 文件的读取与解析`);
      if (currentBookId) await refreshExtraction(currentBookId);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'TXT 解析失败。');
    }
  }

  function upsertSelectedFile(file: BookFile) {
    selectedFiles = [file, ...selectedFiles.filter((item) => item.id !== file.id)];
  }

  async function refreshLibrary() {
    const response = await fetch('/api/library');
    const payload = await response.json().catch(() => ({}));
    libraryQuotes = (payload.quotes || []).map(mapLibraryQuote);
    if (!response.ok) notifyError(payload.error || '读取语料管理库失败。');
  }

  async function refreshAlmanac() {
    const response = await fetch('/api/almanac');
    const payload = await response.json().catch(() => ({}));
    almanacToday = payload.today ? mapAlmanacToday(payload.today) : null;
    almanacHistory = (payload.history || []).map(mapAlmanacEntry);
    if (!response.ok) notifyError(payload.error || '读取宜忌失败。');
  }

  async function refreshReviewLog() {
    reviewLogLoading = true;
    try { const res = await fetch('/api/review-log'); if (res.ok) reviewLogBooks = await res.json(); }
    finally { reviewLogLoading = false; }
  }

  function exportReviewLog(bookId: string) { window.open(`/api/review-log?bookId=${encodeURIComponent(bookId)}`, '_blank'); }

  async function clearCurrentBookResults() {
    const book = selectedFiles.find((item) => item.id === currentBookId) ?? null;
    if (!book?.id) { notifyError('请先选择一本书。'); return; }
    if (extractStatus === 'RUNNING') { notifyError('提取进行中，暂时不能清空结果。'); return; }
    const response = await fetch('/api/books', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, action: 'clear_results' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { notifyError(payload.error || '清空提取结果失败。'); return; }
    currentRunId = ''; runProcessedChunks = 0; runTotalChunks = 0; runFailedChunks = 0;
    runActiveWorkers = 0; runLastError = null; stopRequestPending = false;
    frozenExtractionProgress = null; candidates = [];
    runReviewTotal = 0; runReviewAccepted = 0; extractStatus = 'IDLE'; closeProgressStream();
    notifySuccess(`已清空《${book.title || book.name}》的提取结果`);
  }

  async function deleteBook(bookId: string) {
    const book = selectedFiles.find((item) => item.id === bookId) ?? null;
    if (!book?.id) { notifyError('未找到要删除的书。'); return; }
    if (extractStatus === 'RUNNING' && currentBookId === book.id) {
      notifyError('提取进行中，暂时不能删除书籍。'); return;
    }
    const response = await fetch(`/api/books?bookId=${encodeURIComponent(book.id)}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { notifyError(payload.error || '删除书籍失败。'); return; }
    selectedFiles = selectedFiles.filter((item) => item.id !== book.id);
    if (currentBookId === book.id) {
      const nextBook = selectedFiles[0] ?? null;
      currentBookId = nextBook?.id || ''; currentRunId = ''; runProcessedChunks = 0; runTotalChunks = 0;
      runFailedChunks = 0; runActiveWorkers = 0; runLastError = null; stopRequestPending = false;
      frozenExtractionProgress = null; candidates = []; runReviewTotal = 0;
      runReviewAccepted = 0; extractStatus = 'IDLE'; closeProgressStream();
      if (nextBook?.id) {
        notifySuccess(`已删除《${book.title || book.name}》，切换到《${nextBook.title || nextBook.name}》`);
        await refreshExtraction(nextBook.id); return;
      }
      notifySuccess(`已删除《${book.title || book.name}》`); return;
    }
    notifySuccess(`已删除《${book.title || book.name}》`);
  }

  async function startExtraction() {
    const book = selectedFiles.find((item) => item.id === currentBookId) ?? null;
    if (!book?.id) { notifyError('请先读取 txt。'); return; }
    if (!config.apiUrl.trim() || !config.model.trim() || !config.apiKey.trim()) {
      notifyError('当前浏览器没有可用的提供商配置。'); return;
    }
    try {
      stopRequestPending = false; frozenExtractionProgress = null; extractStatus = 'RUNNING';
      closeProgressStream();
      const response = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, config: {
          apiBaseUrl: config.apiUrl, apiKey: config.apiKey, model: config.model,
          chunkSize: Number(config.chunkSize), concurrency: Number(config.concurrency),
          temperature: Number(config.temperature), topP: Number(config.topP), promptTemplate: config.prompt
        }})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '提取失败。');
      syncFromExtractionPayload(payload);
      ensureProgressStream(book.id);
    } catch (error) {
      stopRequestPending = false; frozenExtractionProgress = null; extractStatus = 'ERROR';
      notifyError(error instanceof Error ? error.message : '提取失败。');
    }
  }

  async function stopExtraction() {
    const book = selectedFiles.find((item) => item.id === currentBookId) ?? null;
    if (!book?.id) { notifyError('当前没有可停止的提取任务。'); return; }
    try {
      stopRequestPending = true;
      frozenExtractionProgress = { runId: currentRunId, processedChunks: runProcessedChunks,
        failedChunks: runFailedChunks, activeWorkers: runActiveWorkers, totalChunks: runTotalChunks };
      const response = await fetch('/api/extract', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, runId: currentRunId || undefined })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '停止提取失败。');
      closeProgressStream(); applyRunState(payload.run);
      notifySuccess('提取已停止');
      await refreshExtraction(book.id);
    } catch (error) {
      stopRequestPending = false; frozenExtractionProgress = null;
      notifyError(error instanceof Error ? error.message : '停止提取失败。');
    }
  }

  async function setCandidateStatus(id: string, status: 'approved' | 'rejected') {
    const removedIndex = candidates.findIndex((candidate) => candidate.id === id);
    const removedCandidate = removedIndex >= 0 ? candidates[removedIndex] : null;
    if (!removedCandidate) return;
    candidates = candidates.filter((candidate) => candidate.id !== id);
    try {
      const response = await fetch('/api/review', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: id, status })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        candidates = [...candidates.slice(0, removedIndex), removedCandidate, ...candidates.slice(removedIndex)];
        notifyError(payload.error || '审核更新失败。'); return;
      }
      notifySuccess(status === 'approved' ? '已收录到 Supabase' : '已丢弃当前候选');
      const rt = payload.runReviewTotals as { total: number; accepted: number } | undefined;
      if (rt && typeof rt.total === 'number' && typeof rt.accepted === 'number') {
        runReviewTotal = rt.total; runReviewAccepted = rt.accepted;
      }
      if (status === 'approved') await refreshLibrary();
    } catch (error) {
      candidates = [...candidates.slice(0, removedIndex), removedCandidate, ...candidates.slice(removedIndex)];
      notifyError(error instanceof Error ? error.message : '审核更新失败。');
    }
  }

  async function deleteLibraryQuote(id: string) {
    const target = libraryQuotes.find((quote) => quote.id === id);
    if (!target || deletingLibraryQuoteIds.has(id)) return;
    deletingLibraryQuoteIds = new Set([...deletingLibraryQuoteIds, id]);
    libraryQuotes = libraryQuotes.filter((quote) => quote.id !== id);
    notifySuccess('已从语料管理库删除这条名句');
    const response = await fetch('/api/library', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: id })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      libraryQuotes = [target, ...libraryQuotes];
      notifyError(payload.error || '删除名句失败。');
      deletingLibraryQuoteIds = new Set([...deletingLibraryQuoteIds].filter((quoteId) => quoteId !== id));
      return;
    }
    deletingLibraryQuoteIds = new Set([...deletingLibraryQuoteIds].filter((quoteId) => quoteId !== id));
  }

  async function copyValue(label: string, value: string) {
    if (!browser) return;
    const text = value || '';
    if (!text) { notifyError(`${label} 为空，无法复制。`); return; }
    try {
      await navigator.clipboard.writeText(text);
      notifySuccess(`${label} 已复制到剪贴板`);
    } catch { notifyError(`复制 ${label} 失败，请检查浏览器权限。`); }
  }

  function openEditDialog(provider: ProviderProfile) {
    editDialogProvider = provider; editDialogName = provider.name; editDialogConfig = { ...provider.config };
  }

  function confirmEdit() {
    if (!editDialogProvider) return;
    const newConfig = normalizeConfig(editDialogConfig);
    providerState = { ...providerState, providers: providerState.providers.map((p) =>
      p.id === editDialogProvider!.id ? { ...p, name: editDialogName.trim() || p.name, config: newConfig } : p
    )};
    if (editDialogProvider.id === activeProviderId) config = { ...newConfig, prompt: config.prompt };
    editDialogProvider = null;
  }

  function cancelEdit() { editDialogProvider = null; }

  // --- Provider 操作 ---
  function switchProvider(providerId: string) {
    const target = getProviderById(providerState, providerId);
    if (!target) return;
    providerState = { ...providerState, activeProviderId: providerId,
      providers: providerState.providers.map((provider) =>
        provider.id === activeProviderId ? { ...provider, config: normalizeConfig(config) } : provider
      )
    };
    hydrateConfigFromProvider(providerId);
  }

  function addProvider() {
    const newId = `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newProvider: ProviderProfile = { id: newId, name: `提供商 ${providerState.providers.length + 1}`, config: normalizeConfig(config) };
    providerState = { ...providerState, providers: [...providerState.providers, newProvider], activeProviderId: newId };
    activeProviderId = newId; hydrateConfigFromProvider(newId);
  }

  function removeProvider(providerId: string) {
    const remaining = providerState.providers.filter((p) => p.id !== providerId);
    if (remaining.length === 0) return;
    const newActive = providerId === activeProviderId ? remaining[0].id : activeProviderId;
    providerState = { providers: remaining, activeProviderId: newActive };
    activeProviderId = newActive; hydrateConfigFromProvider(newActive);
  }

  // --- 提取 Tab 回调 ---
  function handleSelectBook(bookId: string) { currentBookId = bookId; refreshExtraction(bookId); }

  // --- 初始化 ---
  $effect(() => {
    void (async () => {
      try {
        const booksResponse = await fetch('/api/books');
        providerState = loadLocalProviderState(createEmptyConfig()) ?? createEmptyProviderState();
        activeProviderId = providerState.activeProviderId;
        if (activeProviderId) hydrateConfigFromProvider(activeProviderId);
        configReady = true;
        if (booksResponse.ok) {
          const booksPayload = await booksResponse.json();
          selectedFiles = (booksPayload.books || []).map((book: any) => mapBookSummary(book));
          if (selectedFiles.length) {
            currentBookId = selectedFiles[0]?.id || '';
            if (currentBookId) await refreshExtraction(currentBookId);
          }
        }
        await Promise.all([refreshLibrary(), refreshAlmanac(), refreshReviewLog()]);
      } catch { notifyError('初始化本地工作台失败。'); }
    })();
    return () => { closeProgressStream(); };
  });

  $effect(() => {
    if (configReady) {
      const nextState: ProviderConfigState = { ...providerState, activeProviderId,
        providers: providerState.providers.map((provider) =>
          provider.id === activeProviderId ? { ...provider, config: normalizeConfig(config) } : provider
        )
      };
      persistLocalProviderState(nextState);
    }
  });

</script>

<svelte:head>
  <title>Layer1 工作台</title>
  <meta name="description" content="本地语料工作台，包含提取配置、待审核清单、名句库和宜忌浏览。" />
</svelte:head>

<div class="m-0   w-full h-screen overflow-hidden p-2">
  <section class="shell-panel flex flex-col overflow-hidden h-full">
      <header class="px-4 pt-4 sm:px-5 sm:pt-5">
        <nav class="flex gap-6 border-b border-[#ded4c7] text-sm">
          {#each mainTabs as tab}
            <button class:tab-trigger={true} class:is-active={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>
              {tab.label}
            </button>
          {/each}
        </nav>
      </header>

      <div class="flex-1 min-h-0 flex flex-col">
      {#if activeTab === 'extract'}
        <ExtractTab
          config={config}
          providerState={providerState}
          activeProviderId={activeProviderId}
          selectedFiles={selectedFiles}
          currentBookId={currentBookId}
          extractStatus={extractStatus}
          runProcessedChunks={runProcessedChunks}
          runTotalChunks={runTotalChunks}
          runFailedChunks={runFailedChunks}
          runActiveWorkers={runActiveWorkers}
          runLastError={runLastError}
          stopRequestPending={stopRequestPending}
          frozenExtractionProgress={frozenExtractionProgress}
          candidates={candidates}
          runReviewTotal={runReviewTotal}
          runReviewAccepted={runReviewAccepted}
          onRefreshExtraction={refreshExtraction}
          onUpsertSelectedFile={upsertSelectedFile}
          onImportBooks={importBooks}
          onStartExtraction={startExtraction}
          onStopExtraction={stopExtraction}
          onClearCurrentBookResults={clearCurrentBookResults}
          onDeleteBook={deleteBook}
          onSetCandidateStatus={setCandidateStatus}
          onSelectBook={handleSelectBook}
          onSwitchProvider={switchProvider}
          onAddProvider={addProvider}
          onRemoveProvider={removeProvider}
          onEditProvider={openEditDialog}
          onUpdateConfig={(nextConfig: ExtractConfig) => { config = normalizeConfig(nextConfig); }}
          onUpdateProviderState={(nextState: ProviderConfigState) => { providerState = nextState; }}
          onCopyValue={copyValue}
        />
      {:else if activeTab === 'library'}
        <LibraryTab
          libraryQuotes={libraryQuotes}
          selectedLibraryAuthor={selectedLibraryAuthor}
          selectedLibraryMood={selectedLibraryMood}
          selectedLibraryTheme={selectedLibraryTheme}
          authorFiltersExpanded={authorFiltersExpanded}
          moodFiltersExpanded={moodFiltersExpanded}
          themeFiltersExpanded={themeFiltersExpanded}
          deletingLibraryQuoteIds={deletingLibraryQuoteIds}
          onSelectAuthor={(value: string) => { selectedLibraryAuthor = value; }}
          onSelectMood={(value: string) => { selectedLibraryMood = value; }}
          onSelectTheme={(value: string) => { selectedLibraryTheme = value; }}
          onDeleteQuote={deleteLibraryQuote}
        />
      {:else if activeTab === 'almanac'}
        <AlmanacTab almanacToday={almanacToday} almanacHistory={almanacHistory} />
      {:else if activeTab === 'review-log'}
        <ReviewLogTab
          reviewLogBooks={reviewLogBooks}
          reviewLogLoading={reviewLogLoading}
          onRefresh={refreshReviewLog}
          onExport={exportReviewLog}
        />
      {/if}
      </div>
    </section>
</div>

{#if editDialogProvider}
  <ProviderEditDialog
    provider={editDialogProvider}
    name={editDialogName}
    config={editDialogConfig}
    onConfirm={confirmEdit}
    onCancel={cancelEdit}
  />
{/if}
