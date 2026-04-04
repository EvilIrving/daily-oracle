<script module>
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

  export type ProviderProfile = {
    id: string;
    name: string;
    config: ExtractConfig;
  };

  export type ProviderConfigState = {
    activeProviderId: string;
    providers: ProviderProfile[];
  };
</script>

<script lang="ts">
  import { notifyError, notifySuccess } from '$lib/notifications';
  import { deriveExtractionProgress, type ExtractionProgressSnapshot } from '$lib/extraction-progress';
  import QuoteCard from '$lib/components/QuoteCard.svelte';
  import ProviderSelector from '../extract/ProviderSelector.svelte';
  import ConfigForm from '../extract/ConfigForm.svelte';
  import FileUploader from '../extract/FileUploader.svelte';
  import BookList from '../extract/BookList.svelte';
  import ExtractionProgress from '../extract/ExtractionProgress.svelte';

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

  type Candidate = {
    id: string;
    text: string;
    textCn: string | null;
    why: string | null;
    location: string | null;
    author: string;
    work: string;
    year?: number | null;
    genre: string;
    moods: string[];
    themes: string[];
    status: 'pending' | 'approved' | 'rejected';
    dot: string;
  };

  // Props using Svelte 5 $props() rune
  let {
    config,
    providerState,
    activeProviderId,
    selectedFiles,
    currentBookId,
    extractStatus,
    runProcessedChunks,
    runTotalChunks,
    runFailedChunks,
    runActiveWorkers,
    runLastError,
    stopRequestPending,
    frozenExtractionProgress,
    candidates,
    runReviewTotal,
    runReviewAccepted,
    onRefreshExtraction = (_bookId: string) => {},
    onUpsertSelectedFile = (_file: BookFile) => {},
    onImportBooks = (_files: File[]) => {},
    onStartExtraction = () => {},
    onStopExtraction = () => {},
    onClearCurrentBookResults = () => {},
    onDeleteBook = (_bookId: string) => {},
    onSetCandidateStatus = (_id: string, _status: 'approved' | 'rejected') => {},
    onSelectBook = (_bookId: string) => {},
    onSwitchProvider = (_providerId: string) => {},
    onAddProvider = () => {},
    onRemoveProvider = (_providerId: string) => {},
    onEditProvider = (_provider: ProviderProfile) => {},
    onUpdateConfig = (_config: ExtractConfig) => {},
    onUpdateProviderState = (_state: ProviderConfigState) => {},
    onCopyValue = (_label: string, _value: string) => {}
  } = $props();

  // Internal state
  let fileInput = $state.raw<HTMLInputElement | null>(null);
  let isUploadDragging = $state(false);
  let promptExpanded = $state(false);

  // Derived
  let currentBookDerived = $derived(selectedFiles.find((file: BookFile) => file.id === currentBookId) ?? selectedFiles[0] ?? null);
  let pendingCount = $derived(candidates.filter((c: Candidate) => c.status === 'pending').length);
  let reviewPoolSize = $derived(runReviewTotal > 0 ? runReviewTotal : candidates.length);
  let extractionDensity = $derived.by(() => {
    const bodyLen = currentBookDerived?.bodyLength;
    if (!bodyLen || bodyLen <= 0) return null;
    if (reviewPoolSize <= 0) return null;
    return (reviewPoolSize / (bodyLen / 10000)).toFixed(1);
  });
  let acceptanceRate = $derived(
    runReviewTotal > 0 ? Math.round((runReviewAccepted / runReviewTotal) * 100) : null
  );
  let extractionProgress = $derived(
    deriveExtractionProgress({
      runId: currentBookId,
      status: extractStatus,
      processedChunks: runProcessedChunks,
      failedChunks: runFailedChunks,
      activeWorkers: runActiveWorkers,
      totalChunks: runTotalChunks,
      candidatesCount: candidates.length,
      stopRequestPending,
      lastError: runLastError,
      frozenProgress: frozenExtractionProgress
    })
  );

  function getStatusDotColor(status: string): string {
    switch (status) {
      case 'idle': return '#a89880';
      case 'queued': return '#c4b090';
      case 'running': return '#d4a86a';
      case 'partial': return '#d4a040';
      case 'done': return '#a8c4a0';
      case 'error': return '#c09090';
      case 'stopped': return '#989080';
      default: return '#a89880';
    }
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files || []);
    onImportBooks(files);
    input.value = '';
  }

  function openFileInput() {
    fileInput?.click();
  }

  function handleUploadDragEnter(event: DragEvent) {
    event.preventDefault();
    isUploadDragging = true;
  }

  function handleUploadDragOver(event: DragEvent) {
    event.preventDefault();
    isUploadDragging = true;
  }

  function handleUploadDragLeave(event: DragEvent) {
    event.preventDefault();
    const current = event.currentTarget as Node | null;
    const next = event.relatedTarget as Node | null;
    if (current && next && current.contains(next)) return;
    isUploadDragging = false;
  }

  async function handleUploadDrop(event: DragEvent) {
    event.preventDefault();
    isUploadDragging = false;
    const files = Array.from(event.dataTransfer?.files || []).filter(
      (file) => file.type === 'text/plain' || /\.txt$/i.test(file.name)
    );
    if (!files.length) {
      notifyError('只支持导入 txt 文件。');
      return;
    }
    await onImportBooks(files);
  }
</script>

<div class="flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
  <div class="grid grid-cols-[1fr_1fr] gap-4 flex-1 min-h-0 overflow-hidden">
  <section class="min-w-0 min-h-0 flex flex-col flex-1">
    <article class="soft-panel flex flex-col h-full">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded4c7] px-4 py-3.5 sm:px-5">
        <h2 class="text-[0.98rem] font-medium text-ink">提取</h2>
        <ProviderSelector
          providers={providerState.providers}
          activeProviderId={activeProviderId}
          onSwitch={onSwitchProvider}
          onAdd={onAddProvider}
          onRemove={onRemoveProvider}
          onEdit={onEditProvider}
        />
      </header>

      <div class="flex-1 overflow-y-auto space-y-4 p-4 sm:p-5">
        <ConfigForm
          config={config}
          promptExpanded={promptExpanded}
          onTogglePrompt={() => promptExpanded = !promptExpanded}
          onUpdateConfig={onUpdateConfig}
          onCopyValue={onCopyValue}
        />

        <div class="flex items-stretch gap-3">
          <FileUploader
            fileInput={fileInput}
            isUploadDragging={isUploadDragging}
            onFileChange={handleFileChange}
            onOpenFileInput={openFileInput}
            onDragEnter={handleUploadDragEnter}
            onDragOver={handleUploadDragOver}
            onDragLeave={handleUploadDragLeave}
            onDrop={handleUploadDrop}
          />

          <div class="min-w-0 flex-1 space-y-4">
            <BookList
              selectedFiles={selectedFiles}
              currentBookId={currentBookId}
              getStatusDotColor={getStatusDotColor}
              onSelectBook={onSelectBook}
              onDeleteBook={onDeleteBook}
            />

            <ExtractionProgress
              extractStatus={extractStatus}
              extractionProgress={extractionProgress}
              stopRequestPending={stopRequestPending}
              onStart={onStartExtraction}
              onStop={onStopExtraction}
            />
          </div>
        </div>
      </div>
    </article>
  </section>

  <section class="min-w-0 min-h-0 flex flex-col flex-1">
    <article class="soft-panel flex flex-col h-full">
      <header class="border-b border-[#ded4c7] px-4 py-4 sm:px-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-[0.98rem] font-medium text-ink">待审清单</h2>
            {#if currentBookDerived}
              <p class="mt-1 text-sm text-[#7b6b59]">
                <span>当前书籍：{currentBookDerived?.title || currentBookDerived?.name}</span>
                <span class="text-[#6f604f]"> · 待处理 {pendingCount} / {reviewPoolSize}</span>
                {#if extractionDensity !== null}
                  <span class="text-[#6f604f]"> · 提取密度 {extractionDensity} 条/万字</span>
                {/if}
                {#if acceptanceRate !== null}
                  <span class="text-[#6f604f]"> · 采纳率 {acceptanceRate}%</span>
                {:else}
                  <span class="text-[#a89880]"> · 收/弃后统计采纳率</span>
                {/if}
              </p>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            {#if !currentBookDerived}
              <span class="text-sm text-[#6f604f]">待处理 {pendingCount} / {reviewPoolSize}</span>
            {/if}
            <button class="btn-secondary px-3.5 py-2 text-sm font-medium" type="button" onclick={() => onClearCurrentBookResults()}>
              清空当前书结果
            </button>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-2 pb-3" style="min-height: 0;">
        {#if candidates.length}
          {#each candidates as candidate}
            <QuoteCard
              text={candidate.text}
              textCn={candidate.textCn}
              why={candidate.why}
              location={candidate.location}
              author={candidate.author}
              work={candidate.work}
              year={candidate.year ?? null}
              genre={candidate.genre}
              moods={candidate.moods}
              themes={candidate.themes}
              dot={candidate.dot}
              actions={[
                {
                  label: '收',
                  onClick: () => onSetCandidateStatus(candidate.id, 'approved')
                },
                {
                  label: '弃',
                  onClick: () => onSetCandidateStatus(candidate.id, 'rejected')
                }
              ]}
            />
          {/each}
        {:else}
          <div class="px-4 py-12 text-center text-sm text-[#7b6b59] sm:px-5">
            当前没有待审核候选。先读取 txt，再开始提取。
          </div>
        {/if}
      </div>
    </article>
  </section>
</div>
</div>
