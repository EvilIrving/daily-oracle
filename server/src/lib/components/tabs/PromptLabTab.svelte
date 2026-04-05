<script lang="ts">
  import { onMount } from 'svelte';
  import { notifyError, notifySuccess } from '$lib/notifications';
  import type { ExtractConfig } from '$lib/composables/useProviderConfig';
  import BookList from '../extract/BookList.svelte';

  type ReviewStatus = 'pending' | 'reviewing' | 'done' | 'error';
  type ReviewItem = { status: ReviewStatus; raw: string };

  type PromptLabBook = {
    id: string;
    name: string;
    title: string;
    author: string | null;
    year: number | null;
    language: string | null;
    genre: string | null;
    bodyLength: number;
    sizeLabel?: string;
    status: string;
  };

  let { config }: { config: ExtractConfig } = $props();

  // ===== 书籍管理 =====
  let books: PromptLabBook[] = $state([]);
  let currentBookId = $state('');

  // ===== 模型参数 =====
  let temperature = $state(0.9);
  let topP = $derived(config.topP);

  // ===== Prompts =====
  let extractPrompt = $state('');
  let reviewPrompt = $state('');

  // ===== 当前书籍的原始文本 =====
  let currentBookText = $state('');

  // ===== 提取状态 =====
  type ExtractPhase = 'idle' | 'running' | 'done' | 'error';
  let extractPhase = $state<ExtractPhase>('idle');
  let extractRaw = $state('');
  let extractError = $state('');
  let candidates: string[] = $state([]);
  let totalChunks = $state(0);

  // ===== 审核状态 =====
  type ReviewPhase = 'idle' | 'running' | 'done';
  let reviewPhase = $state<ReviewPhase>('idle');
  let reviewItems: ReviewItem[] = $state([]);

  // ===== 持久化的候选句（从数据库加载） =====
  let persistedCandidates: Array<{
    candidateText: string;
    reviewRaw: string | null;
    reviewPassed: boolean | null;
    chunkIndex: number;
  }> = $state([]);

  const reviewDone = $derived(
    reviewItems.filter((r) => r.status === 'done' || r.status === 'error').length
  );

  const reviewPassed = $derived.by(() => {
    return reviewItems.filter((r) => {
      if (r.status !== 'done') return false;
      return /^通过 [：:]/.test(r.raw) || r.raw.startsWith('通过');
    }).length;
  });

  const reviewRejected = $derived.by(() => {
    return reviewItems.filter((r) => {
      if (r.status !== 'done') return false;
      return !(/^通过 [：:]/.test(r.raw) || r.raw.startsWith('通过'));
    }).length;
  });

  const reviewErrorCount = $derived(
    reviewItems.filter((r) => r.status === 'error').length
  );

  const reviewPending = $derived(
    reviewItems.filter((r) => r.status === 'pending' || r.status === 'reviewing').length
  );

  const passRate = $derived.by(() => {
    const completed = reviewPassed + reviewRejected;
    if (completed === 0) return 0;
    return Math.round((reviewPassed / completed) * 100);
  });

  let nextReviewIndex = $state(0);
  let reviewStopped = $state(false);
  let extractController: AbortController | null = null;
  let reviewAbortControllers: AbortController[] = [];

  // 从持久化数据恢复 candidates 和 reviewItems
  $effect(() => {
    if (persistedCandidates.length > 0 && candidates.length === 0) {
      candidates = persistedCandidates.map(c => c.candidateText);
      reviewItems = persistedCandidates.map(c => ({
        status: c.reviewRaw ? 'done' : 'pending',
        raw: c.reviewRaw || ''
      }));
      if (candidates.length > 0) {
        extractPhase = 'done';
        reviewPhase = persistedCandidates.some(c => c.reviewRaw === null) ? 'idle' : 'done';
      }
    }
  });

  async function loadBooks() {
    try {
      const res = await fetch('/api/prompt-lab/books');
      if (res.ok) {
        const data = await res.json();
        books = (data.books || []).map((b: any) => ({
          id: b.id,
          name: b.file_name,
          title: b.title,
          author: b.author,
          year: b.year,
          language: b.language,
          genre: b.genre,
          bodyLength: b.body_length,
          sizeLabel: formatFileSize(b.body_length),
          status: 'idle'
        }));
        if (books.length > 0 && !currentBookId) {
          await selectBook(books[0].id);
        }
      }
    } catch {
      // ignore
    }
  }

  async function selectBook(bookId: string) {
    currentBookId = bookId;
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    // 重置状态
    extractPhase = 'idle';
    reviewPhase = 'idle';
    extractRaw = '';
    extractError = '';
    candidates = [];
    reviewItems = [];
    totalChunks = 0;
    nextReviewIndex = 0;
    reviewStopped = false;
    currentBookText = '';
    persistedCandidates = [];

    // 加载书籍内容和调试结果
    try {
      const res = await fetch(`/api/prompt-lab/books?bookId=${encodeURIComponent(bookId)}`);
      if (res.ok) {
        const data = await res.json();
        currentBookText = data.rawText || '';
        await loadBookResults(bookId);
      }
    } catch {
      // ignore
    }
  }

  async function loadBookResults(bookId: string) {
    try {
      const res = await fetch('/api/prompt-lab/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, action: 'get_results' })
      });
      if (res.ok) {
        const data = await res.json();
        persistedCandidates = data.results || [];
      }
    } catch {
      persistedCandidates = [];
    }
  }

  async function deleteBook(bookId: string) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const response = await fetch(`/api/prompt-lab/books?bookId=${encodeURIComponent(bookId)}`, {
      method: 'DELETE'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      notifyError(payload.error || '删除书籍失败。');
      return;
    }

    books = books.filter(b => b.id !== bookId);
    if (currentBookId === bookId) {
      const nextBook = books[0] ?? null;
      currentBookId = nextBook?.id || '';
      if (nextBook) {
        await selectBook(nextBook.id);
      } else {
        // 清空状态
        extractPhase = 'idle';
        reviewPhase = 'idle';
        extractRaw = '';
        candidates = [];
        reviewItems = [];
        currentBookText = '';
      }
    }
    notifySuccess(`已删除《${book.title || book.name}》`);
  }

  async function clearCurrentBookResults() {
    if (!currentBookId) {
      notifyError('请先选择一本书。');
      return;
    }
    if (extractPhase === 'running' || reviewPhase === 'running') {
      notifyError('提取或审核进行中，暂时不能清空结果。');
      return;
    }

    const response = await fetch('/api/prompt-lab/books', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: currentBookId, action: 'clear_results' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      notifyError(payload.error || '清空结果失败。');
      return;
    }

    extractPhase = 'idle';
    reviewPhase = 'idle';
    extractRaw = '';
    extractError = '';
    candidates = [];
    reviewItems = [];
    persistedCandidates = [];
    totalChunks = 0;
    notifySuccess('已清空当前书的调试结果');
  }

  async function saveResultsToDb() {
    if (!currentBookId || candidates.length === 0) return;

    const results = candidates.map((candidate, i) => ({
      candidateText: candidate,
      reviewRaw: reviewItems[i]?.raw || null,
      reviewPassed: reviewItems[i]?.status === 'done'
        ? /^通过 [：:]/.test(reviewItems[i].raw) || reviewItems[i].raw.startsWith('通过')
        : null,
      chunkIndex: 0 // 调试模式不记录具体 chunk
    }));

    try {
      await fetch('/api/prompt-lab/books', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: currentBookId,
          action: 'save_results',
          results
        })
      });
    } catch {
      // ignore save errors
    }
  }

  function getStatusDotColor(status: string): string {
    return '#a89880'; // 调试书籍没有复杂状态，统一颜色
  }

  function formatFileSize(size: number): string {
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/prompt-lab');
      if (res.ok) {
        const data = await res.json();
        extractPrompt = data.extractPrompt || '';
        reviewPrompt = data.reviewPrompt || '';
      }
    } catch {
      // ignore
    }
    await loadBooks();
  });

  function getApiConfig() {
    return {
      apiBaseUrl: config.apiUrl,
      apiKey: config.apiKey,
      model: config.model,
      temperature,
      topP
    };
  }

  async function runExtract() {
    const book = books.find(b => b.id === currentBookId);
    if (!book) {
      notifyError('请先选择一本书。');
      return;
    }
    if (!config.apiKey || !config.model) {
      notifyError('请先在提取 Tab 配置 AI 提供商。');
      return;
    }

    // 加载书籍内容（如果尚未加载）
    if (!currentBookText.trim()) {
      try {
        const res = await fetch(`/api/prompt-lab/books?bookId=${encodeURIComponent(currentBookId)}`);
        if (res.ok) {
          const data = await res.json();
          currentBookText = data.rawText || '';
        }
      } catch {
        notifyError('无法加载书籍内容。');
        return;
      }
    }

    if (!currentBookText.trim()) {
      notifyError('书籍内容为空。');
      return;
    }

    extractPhase = 'running';
    extractRaw = '';
    extractError = '';
    candidates = [];
    totalChunks = 0;
    reviewItems = [];
    reviewPhase = 'idle';
    nextReviewIndex = 0;
    reviewStopped = false;
    persistedCandidates = [];

    extractController = new AbortController();

    try {
      const res = await fetch('/api/prompt-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract',
          text: currentBookText,
          prompt: extractPrompt,
          config: getApiConfig()
        }),
        signal: extractController.signal
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '提取失败。');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('响应体不可读。');

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                const prevLength = candidates.length;
                extractRaw = extractRaw ? extractRaw + '\n\n---\n\n' + data.raw : data.raw;
                candidates = [...candidates, ...data.candidates];
                totalChunks = data.totalChunks;

                if ((reviewPhase === 'running' || reviewPhase === 'idle') && !reviewStopped) {
                  reviewPhase = 'running';
                  while (reviewItems.length < candidates.length) {
                    reviewItems.push({ status: 'pending', raw: '' });
                  }
                  runReviewForNewCandidates(prevLength);
                }
              } else if (data.type === 'done') {
                extractPhase = 'done';
                // 保存结果到数据库
                await saveResultsToDb();
                return;
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            }
          }
        }
      } catch (readErr) {
        reviewAbortControllers.forEach(c => c.abort());
        reviewAbortControllers = [];
        extractPhase = 'done';
        await saveResultsToDb();
        return;
      }

      extractPhase = 'done';
      await saveResultsToDb();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        extractPhase = 'idle';
        candidates = [];
        reviewItems = [];
        return;
      }
      extractError = err instanceof Error ? err.message : '提取失败。';
      extractPhase = 'error';
    } finally {
      extractController = null;
    }
  }

  function stopExtract() {
    if (extractController) {
      extractController.abort();
      extractController = null;
    }
    reviewAbortControllers.forEach(c => c.abort());
    reviewAbortControllers = [];
  }

  async function runReviewForNewCandidates(startIndex: number) {
    const limit = pLimit(config.concurrency);

    for (let i = startIndex; i < candidates.length; i++) {
      const idx = i;
      const candidate = candidates[idx];

      reviewItems[idx] = { status: 'reviewing', raw: '' };

      const controller = new AbortController();
      reviewAbortControllers.push(controller);

      limit(async () => {
        try {
          const res = await fetch('/api/prompt-lab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'review',
              candidate,
              prompt: reviewPrompt,
              config: getApiConfig()
            }),
            signal: controller.signal
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || '审核失败。');
          reviewItems[idx] = { status: 'done', raw: data.raw || '' };
          // 实时保存
          await saveResultsToDb();
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            reviewItems[idx] = { status: 'pending', raw: '' };
            return;
          }
          reviewItems[idx] = {
            status: 'error',
            raw: err instanceof Error ? err.message : '审核出错'
          };
          await saveResultsToDb();
        }
      });
    }
    nextReviewIndex = candidates.length;
  }

  async function runReview() {
    if (candidates.length === 0) {
      notifyError('请先完成第一步提取。');
      return;
    }
    if (!config.apiKey || !config.model) {
      notifyError('请先在提取 Tab 配置 AI 提供商。');
      return;
    }

    reviewStopped = false;
    reviewPhase = 'running';
    reviewItems = candidates.map(() => ({ status: 'pending' as ReviewStatus, raw: '' }));
    nextReviewIndex = 0;
    reviewAbortControllers = [];

    if (extractPhase === 'running') {
      return;
    }

    const limit = pLimit(config.concurrency);

    await Promise.all(
      candidates.map(async (candidate, i) => {
        const controller = new AbortController();
        reviewAbortControllers.push(controller);

        reviewItems[i] = { status: 'reviewing', raw: '' };
        await limit(async () => {
          try {
            const res = await fetch('/api/prompt-lab', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'review',
                candidate,
                prompt: reviewPrompt,
                config: getApiConfig()
              }),
              signal: controller.signal
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || '审核失败。');
            reviewItems[i] = { status: 'done', raw: data.raw || '' };
            await saveResultsToDb();
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              reviewItems[i] = { status: 'pending', raw: '' };
              return;
            }
            reviewItems[i] = {
              status: 'error',
              raw: err instanceof Error ? err.message : '审核出错'
            };
            await saveResultsToDb();
          }
        });
      })
    );

    reviewPhase = 'done';
    await saveResultsToDb();
  }

  function pLimit<T>(concurrency: number) {
    let activeCount = 0;
    const limit = Math.max(1, concurrency ?? 1);

    return async (fn: () => Promise<T>): Promise<T> => {
      while (activeCount >= limit) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      activeCount++;
      try {
        return await fn();
      } finally {
        activeCount--;
      }
    };
  }

  function reviewColor(item: ReviewItem): string {
    if (item.status === 'reviewing') return 'border-amber-200 bg-amber-50/40';
    if (item.status === 'error') return 'border-red-200 bg-red-50/40';
    if (item.status === 'done') {
      const passed = /^通过[：:]/.test(item.raw) || item.raw.startsWith('通过');
      return passed ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40';
    }
    if (item.status === 'pending') return 'border-amber-200 bg-amber-50/40';
    return 'border-line';
  }

  let sortedCandidates = $derived.by(() => {
    const items = candidates.map((candidate, i) => ({
      candidate,
      index: i,
      reviewItem: reviewItems[i]
    }));

    return items.toSorted((a, b) => {
      const aPassed = a.reviewItem && (/^通过 [：:]/.test(a.reviewItem.raw) || a.reviewItem.raw.startsWith('通过'));
      const bPassed = b.reviewItem && (/^通过 [：:]/.test(b.reviewItem.raw) || b.reviewItem.raw.startsWith('通过'));

      if (aPassed === bPassed) return a.index - b.index;
      return aPassed ? -1 : 1;
    });
  });
</script>

<div class="flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
  <div class="grid grid-cols-[400px_1fr] gap-4 flex-1 min-h-0 overflow-hidden">

    <!-- 左栏：配置 + 提示词 -->
    <section class="min-w-0 min-h-0 flex flex-col">
      <article class="soft-panel flex flex-col h-full overflow-hidden">
        <header class="border-b border-line px-4 py-3.5 sm:px-5 flex items-center justify-between">
          <h2 class="text-[0.95rem] font-medium text-ink">配置</h2>
          <span class="text-xs text-muted">{config.model || '未配置模型'}</span>
        </header>

        <div class="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-5">

          <!-- 模型参数 -->
          <div class="space-y-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">模型参数</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-xs text-muted">Temperature</span>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  class="field w-full px-3 py-1.5 text-sm"
                  bind:value={temperature}
                />
              </label>
              <label class="space-y-1">
                <span class="text-xs text-muted">Top P</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  class="field w-full px-3 py-1.5 text-sm"
                  bind:value={topP}
                />
              </label>
            </div>
          </div>

          <!-- 选取提示词 -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">选取提示词</p>
            <textarea
              class="field w-full px-3 py-2.5 text-xs font-mono resize-none leading-relaxed"
              rows="18"
              placeholder="用于从文本中选取候选句子的系统提示词…"
              bind:value={extractPrompt}
            ></textarea>
          </div>

          <!-- 审核提示词 -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">审核提示词</p>
            <textarea
              class="field w-full px-3 py-2.5 text-xs font-mono resize-none leading-relaxed"
              rows="14"
              placeholder="用于逐条审核候选句子的系统提示词…"
              bind:value={reviewPrompt}
            ></textarea>
          </div>

        </div>
      </article>
    </section>

    <!-- 右栏：书籍管理 + 输入 + 结果 -->
    <section class="min-w-0 min-h-0 flex flex-col gap-4">

      <!-- 书籍管理 -->
      <article class="soft-panel flex flex-col" style="flex: 0 0 auto;">
        <header class="border-b border-line px-4 py-3 sm:px-5 flex items-center justify-between">
          <h2 class="text-[0.95rem] font-medium text-ink">调试书籍</h2>
          <span class="text-xs text-muted">{books.length} 本</span>
        </header>
        <div class="p-3 space-y-3">
          <div class="flex items-stretch gap-3">
            <div class="min-w-0 flex-1">
              <BookList
                selectedFiles={books}
                currentBookId={currentBookId}
                getStatusDotColor={getStatusDotColor}
                onSelectBook={selectBook}
                onDeleteBook={deleteBook}
              />
            </div>
          </div>
        </div>
      </article>

      <!-- 步骤控制行 -->
      <div class="flex items-center gap-3 flex-shrink-0 flex-wrap">
        <button
          class="btn-primary text-sm px-4 py-1.5"
          onclick={runExtract}
          disabled={extractPhase === 'running' || !currentBookId}
        >
          {extractPhase === 'running' ? '提取中…' : '第一步：提取'}
        </button>

        {#if extractPhase === 'running'}
          <button
            class="btn-secondary text-sm px-4 py-1.5 text-red-600"
            onclick={stopExtract}
          >
            停止
          </button>
        {/if}

        <button
          class="btn-secondary text-sm px-4 py-1.5"
          onclick={runReview}
          disabled={candidates.length === 0 || reviewPhase === 'running' || !currentBookId}
        >
          {reviewPhase === 'running'
            ? `审核中…`
            : reviewStopped ? '继续审核' : '第二步：逐条审核'}
        </button>

        {#if reviewPhase === 'running'}
          <button
            class="btn-secondary text-sm px-4 py-1.5 text-red-600"
            onclick={() => {
              reviewAbortControllers.forEach(c => c.abort());
              reviewAbortControllers = [];
              reviewStopped = true;
              reviewPhase = 'idle';
              reviewItems = reviewItems.map(item =>
                item.status === 'reviewing' ? { status: 'pending', raw: '' } : item
              );
            }}
          >
            停止审核
          </button>
        {/if}

        {#if extractPhase === 'error'}
          <span class="text-sm text-red-600">{extractError}</span>
        {:else if extractPhase === 'done'}
          <span class="text-sm text-muted">
            提取完成，共 {candidates.length} 条（{totalChunks} 块）
            {#if reviewPhase === 'done'}
              · 审核完成
            {/if}
          </span>
        {/if}
      </div>

      <!-- 结果区 -->
      <article class="soft-panel flex flex-col flex-1 min-h-0">
        <header class="border-b border-line px-4 py-3 sm:px-5">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-3 flex-wrap">
              <h2 class="text-[0.95rem] font-medium text-ink">
                结果
                {#if candidates.length > 0}
                  <span class="text-xs font-normal text-muted ml-2">{candidates.length} 条候选</span>
                {/if}
              </h2>
              {#if candidates.length > 0 && reviewItems.length > 0}
                <div class="flex items-center gap-4 text-xs">
                  <span class="text-muted">已完成：{reviewDone}</span>
                  <span class="text-green-700">通过：{reviewPassed}</span>
                  <span class="text-red-600">拒绝：{reviewRejected}</span>
                  <span class="text-amber-600">待审：{reviewPending}</span>
                  {#if reviewErrorCount > 0}
                    <span class="text-red-500">出错：{reviewErrorCount}</span>
                  {/if}
                  <span class="text-muted">通过率：{passRate}%</span>
                </div>
              {/if}
            </div>
            {#if currentBookId}
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted">
                  当前：{books.find(b => b.id === currentBookId)?.title || '未选择'}
                </span>
                <button
                  class="btn-secondary text-xs px-3 py-1"
                  onclick={clearCurrentBookResults}
                  disabled={extractPhase === 'running' || reviewPhase === 'running'}
                >
                  清空结果
                </button>
              </div>
            {/if}
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-4">

          {#if !currentBookId}
            <p class="text-sm text-muted text-center py-10">请先在「提取」页面上传书籍，然后在此选择开始调试</p>
          {:else if extractPhase === 'idle' && candidates.length === 0}
            <p class="text-sm text-muted text-center py-10">选择提示词后点击「第一步：提取」开始调试</p>
          {:else if extractPhase === 'running' && candidates.length === 0}
            <p class="text-sm text-muted text-center py-10">AI 正在提取候选句…</p>
          {:else}
            <!-- 原始输出 -->
            {#if extractRaw}
              <details class="group">
                <summary
                  class="cursor-pointer text-xs text-muted select-none list-none flex items-center gap-1.5 mb-2"
                >
                  <span class="inline-block transition-transform group-open:rotate-90">▶</span>
                  查看原始 AI 输出
                </summary>
                <pre class="text-xs font-mono bg-canvas rounded-xl border border-line px-3 py-3 whitespace-pre-wrap text-ink leading-relaxed overflow-x-auto">{extractRaw}</pre>
              </details>
            {/if}

            <!-- 解析后的候选列表 -->
            {#if candidates.length === 0}
              <p class="text-sm text-muted text-center py-6">未解析到候选句，请查看原始输出</p>
            {:else}
              <div class="space-y-3">
                {#each sortedCandidates as item}
                  {@const reviewItem = item.reviewItem}
                  <div
                    class="rounded-xl border px-4 py-3 space-y-2 transition-colors {reviewItem
                      ? reviewColor(reviewItem)
                      : 'border-line'}"
                  >
                    <!-- 候选文本 -->
                    <div class="flex items-start gap-2.5">
                      <span class="mt-0.5 flex-shrink-0 text-xs text-muted w-5 text-right leading-5"
                        >{item.index + 1}</span
                      >
                      <p class="text-sm text-ink leading-relaxed flex-1">{item.candidate}</p>
                    </div>

                    <!-- 审核结果 -->
                    {#if reviewItem && reviewItem.status === 'reviewing'}
                      <div class="pl-7">
                        <p class="text-xs text-amber-600">审核中…</p>
                      </div>
                    {:else if reviewItem && reviewItem.status === 'done'}
                      <div class="pl-7">
                        {#if /^通过 [：:]/.test(reviewItem.raw) || reviewItem.raw.startsWith('通过')}
                          <p class="text-xs text-green-700">{reviewItem.raw}</p>
                        {:else}
                          <p class="text-xs text-red-600">{reviewItem.raw}</p>
                        {/if}
                      </div>
                    {:else if reviewItem && reviewItem.status === 'error'}
                      <div class="pl-7">
                        <p class="text-xs text-red-500">出错：{reviewItem.raw}</p>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          {/if}

        </div>
      </article>

    </section>
  </div>
</div>
