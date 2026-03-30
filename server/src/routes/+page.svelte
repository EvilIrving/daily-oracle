<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import '../app.css';

  type MainTab = 'extract' | 'library' | 'almanac';
  type ReviewFilter = 'all' | 'pending' | 'approved' | 'rejected';
  type CandidateStatus = 'pending' | 'approved' | 'rejected';
  type LibraryFilter = 'all' | 'pending' | 'sad' | 'classical';

  type Candidate = {
    id: string;
    text: string;
    author: string;
    work: string;
    genre: string;
    moods: string[];
    themes: string[];
    status: CandidateStatus;
    dot: string;
  };

  type LibraryQuote = {
    id: string;
    text: string;
    author: string;
    work: string;
    genre: string;
    moods: string[];
    themes: string[];
    state?: string;
    dot: string;
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

  type AlmanacTodayCard = {
    dateLabel: string;
    archivedAt: string;
    signals: string[];
    yi: string;
    ji: string;
  };

  const CONFIG_STORAGE_KEY = 'daily-quote.extract-config';
  const DEFAULT_PROMPT = `你是一个文学语料库编辑，任务是从以下书籍文本中提取适合「每日名句」产品使用的候选句子。

## 产品背景
这些句子会出现在一个极简 iOS 小组件上，用户每天看一句，可以按心情筛选。目标是让用户读完之后产生「这说的是我」的感受。

## 入选标准
只保留同时满足以下所有条件的句子：
1. 长度：中文 15–60 字，英文 10–40 词
2. 脱离上下文仍然成立
3. 经验可代入
4. 语言有密度
      5. 开放性：给出张力但不完全解释张力`;
  const mainTabs: { id: MainTab; label: string }[] = [
    { id: 'extract', label: '提取' },
    { id: 'library', label: '名句库' },
    { id: 'almanac', label: '宜忌' }
  ];

  const reviewFilters: { id: ReviewFilter; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'pending', label: '未审' },
    { id: 'approved', label: '通过' },
    { id: 'rejected', label: '排除' }
  ];

  const libraryFilters: { id: LibraryFilter; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'pending', label: '待审' },
    { id: 'sad', label: 'sad' },
    { id: 'classical', label: '古典' }
  ];

  let activeTab: MainTab = 'extract';
  let activeReviewFilter: ReviewFilter = 'all';
  let activeLibraryFilter: LibraryFilter = 'all';
  let currentBookId = '';
  let currentRunId = '';
  let extractStatus = 'IDLE';
  let selectedFiles: {
    id?: string;
    name: string;
    sizeLabel: string;
    title: string;
    author: string;
    year?: number | null;
    language?: string | null;
    genre?: string | null;
    bodyLength?: number;
  }[] = [];

  let config = createDefaultConfig();
  let serverConfigFallback = createDefaultConfig();
  let configReady = false;

  let candidates: Candidate[] = [];
  let libraryQuotes: LibraryQuote[] = [];
  let almanacToday: AlmanacTodayCard | null = createInitialAlmanacToday();
  let libraryStats = {
    totalCommitted: 0,
    pending: 0
  };

  let extractNotice = '等待导入 txt 文件';
  let extractError = '';

  let almanacHistory: AlmanacEntry[] = [];

  function mapBookSummary(book: any) {
    const bodyLength = book.bodyLength ?? book.body_length;

    return {
      id: book.id,
      name: book.fileName || book.file_name,
      sizeLabel: typeof bodyLength === 'number' && bodyLength > 0 ? formatFileSize(bodyLength) : '已解析',
      title: book.title,
      author: book.author || '自动解析',
      year: book.year,
      language: book.language,
      genre: book.genre,
      bodyLength
    };
  }

  function upsertSelectedFile(file: ReturnType<typeof mapBookSummary>) {
    selectedFiles = [file, ...selectedFiles.filter((item) => item.id !== file.id)];
  }

  function createInitialAlmanacToday(): AlmanacTodayCard | null {
    return null;
  }

  function createDefaultConfig() {
    return {
      apiUrl: 'https://open.bigmodel.cn/api/anthropic',
      model: 'glm-5.1',
      apiKey: '',
      chunkSize: 3000,
      concurrency: 3,
      temperature: 0.3,
      prompt: DEFAULT_PROMPT
    };
  }

  function normalizeConfig(input: Partial<typeof config> | null | undefined) {
    const fallback = createDefaultConfig();
    const next = input || {};

    return {
      apiUrl: String(next.apiUrl ?? fallback.apiUrl),
      model: String(next.model ?? fallback.model),
      apiKey: String(next.apiKey ?? fallback.apiKey),
      chunkSize: Number(next.chunkSize ?? fallback.chunkSize),
      concurrency: Number(next.concurrency ?? fallback.concurrency),
      temperature: Number(next.temperature ?? fallback.temperature),
      prompt: String(next.prompt ?? fallback.prompt)
    };
  }

  function loadLocalConfig() {
    if (!browser) return null;

    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return null;
      return normalizeConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function persistLocalConfig(nextConfig = config) {
    if (!browser) return;
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalizeConfig(nextConfig)));
  }

  function clearLocalConfig() {
    if (!browser) return;
    window.localStorage.removeItem(CONFIG_STORAGE_KEY);
  }

  function getCurrentBook() {
    return selectedFiles.find((file) => file.id === currentBookId) ?? selectedFiles[0] ?? null;
  }

  function formatFileSize(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    extractError = '';

    try {
      const mapped = await Promise.all(
        files.map(async (file) => {
          const text = await file.text();
          const response = await fetch('/api/books', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fileName: file.name,
              rawText: text
            })
          });

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.error || 'TXT 解析失败。');
          }

          const payload = await response.json();
          const book = payload.book as {
            id: string;
            fileName: string;
            title: string;
            author: string | null;
            year: number | null;
            language: string | null;
            genre: string | null;
            bodyLength: number;
          };

          return {
            ...mapBookSummary(book),
            sizeLabel: formatFileSize(file.size)
          };
        })
      );

      for (const book of mapped) {
        upsertSelectedFile(book);
      }
      currentBookId = mapped.at(-1)?.id || currentBookId;
      extractNotice = `已完成 ${mapped.length} 本 txt 文件的读取与解析`;
      if (currentBookId) {
        await refreshExtraction(currentBookId);
      }
    } catch (error) {
      extractError = error instanceof Error ? error.message : 'TXT 解析失败。';
    } finally {
      input.value = '';
    }
  }

  async function saveConfig() {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiBaseUrl: config.apiUrl,
        apiKey: config.apiKey,
        model: config.model,
        chunkSize: Number(config.chunkSize),
        concurrency: Number(config.concurrency),
        temperature: Number(config.temperature),
        promptTemplate: config.prompt
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || '配置保存失败。');
    }
  }

  function clearApiKey() {
    config = {
      ...config,
      apiKey: ''
    };
  }

  function mapCandidate(item: any): Candidate {
    return {
      id: item.id,
      text: item.text,
      author: item.author || '未知作者',
      work: item.work || item.sourceBook || '未知作品',
      genre: item.genre || '未标注',
      moods: item.moods || [],
      themes: item.themes || [],
      status: item.reviewStatus,
      dot: item.reviewStatus === 'approved' ? '#7ca36c' : item.reviewStatus === 'rejected' ? '#c58a7b' : '#b59067'
    };
  }

  function mapLibraryQuote(item: any): LibraryQuote {
    return {
      id: item.id,
      text: item.text,
      author: item.author || '未知作者',
      work: item.work || '未知作品',
      genre: item.genre || '未标注',
      moods: item.mood || [],
      themes: item.themes || [],
      dot: '#7d8f70'
    };
  }

  function formatDateLabel(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function mapAlmanacEntry(item: any): AlmanacEntry {
    const signals = item.signals && typeof item.signals === 'object' ? Object.values(item.signals) : [];
    return {
      id: item.id,
      date: formatDateLabel(item.date),
      week: item.date ? new Date(item.date).toLocaleDateString('zh-CN', { weekday: 'short' }) : '',
      weather: String(signals[0] || '无天气信号'),
      temp: String(signals[1] || '无温度信号'),
      yi: item.yi,
      ji: item.ji
    };
  }

  function mapAlmanacToday(item: any): AlmanacTodayCard {
    const signals =
      item.signals && typeof item.signals === 'object'
        ? Object.entries(item.signals).map(([key, value]) => `${key}: ${String(value)}`)
        : [];

    return {
      dateLabel: formatDateLabel(item.date),
      archivedAt: item.created_at ? `归档于 ${formatDateLabel(item.created_at)}` : '今日记录',
      signals,
      yi: item.yi,
      ji: item.ji
    };
  }

  async function refreshExtraction(bookId: string) {
    const response = await fetch(`/api/extract?bookId=${encodeURIComponent(bookId)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || '读取提取结果失败。');
    }

    const payload = await response.json();
    currentRunId = payload.run?.id || '';
    extractStatus = payload.run?.status?.toUpperCase?.() || 'IDLE';
    candidates = (payload.candidates || []).map(mapCandidate);

    const stats = payload.stats || {};
    extractNotice = currentRunId
      ? `已加载批次 ${currentRunId.slice(0, 8)}，候选 ${stats.total || 0} 条`
      : '当前书目还没有提取批次';
  }

  async function clearCurrentBookResults() {
    const book = getCurrentBook();
    if (!book?.id) {
      extractError = '请先选择一本书。';
      return;
    }

    if (extractStatus === 'RUNNING') {
      extractError = '提取进行中，暂时不能清空结果。';
      return;
    }

    const response = await fetch('/api/books', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookId: book.id,
        action: 'clear_results'
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      extractError = payload.error || '清空提取结果失败。';
      return;
    }

    extractError = '';
    currentRunId = '';
    candidates = [];
    extractStatus = 'IDLE';
    extractNotice = `已清空《${book.title || book.name}》的提取结果`;
  }

  async function deleteCurrentBook() {
    const book = getCurrentBook();
    if (!book?.id) {
      extractError = '请先选择一本书。';
      return;
    }

    if (extractStatus === 'RUNNING') {
      extractError = '提取进行中，暂时不能删除书籍。';
      return;
    }

    const response = await fetch(`/api/books?bookId=${encodeURIComponent(book.id)}`, {
      method: 'DELETE'
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      extractError = payload.error || '删除书籍失败。';
      return;
    }

    extractError = '';
    selectedFiles = selectedFiles.filter((item) => item.id !== book.id);
    const nextBook = selectedFiles[0] ?? null;
    currentBookId = nextBook?.id || '';
    currentRunId = '';
    candidates = [];
    extractStatus = 'IDLE';

    if (nextBook?.id) {
      extractNotice = `已删除《${book.title || book.name}》，切换到《${nextBook.title || nextBook.name}》`;
      await refreshExtraction(nextBook.id);
      return;
    }

    extractNotice = `已删除《${book.title || book.name}》`;
  }

  async function refreshLibrary() {
    const response = await fetch('/api/library');
    const payload = await response.json().catch(() => ({}));

    libraryQuotes = (payload.quotes || []).map(mapLibraryQuote);
    libraryStats = payload.stats || libraryStats;
  }

  async function refreshAlmanac() {
    const response = await fetch('/api/almanac');
    const payload = await response.json().catch(() => ({}));

    almanacToday = payload.today ? mapAlmanacToday(payload.today) : null;
    almanacHistory = (payload.history || []).map(mapAlmanacEntry);
  }

  async function startExtraction() {
    const book = getCurrentBook();
    if (!book?.id) {
      extractError = '请先读取 txt。';
      return;
    }

    extractError = '';
    extractStatus = 'RUNNING';
    extractNotice = '正在提取，请稍候…';

    try {
      await saveConfig();

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookId: book.id })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Extraction request failed.', {
          status: response.status,
          payload
        });
        throw new Error(payload.error || '提取失败。');
      }

      currentRunId = payload.run?.id || '';
      extractStatus = payload.run?.status?.toUpperCase?.() || 'DONE';
      candidates = (payload.candidates || []).map(mapCandidate);
      extractNotice =
        candidates.length > 0
          ? `提取完成，生成 ${candidates.length} 条候选`
          : payload.run?.lastError
            ? payload.run.lastError
            : '提取结束，但未生成候选。请检查 prompt、源文本或元数据。';
    } catch (error) {
      console.error('Extraction failed with raw error.', error);
      extractStatus = 'ERROR';
      extractError = error instanceof Error ? error.message : '提取失败。';
    }
  }

  async function setCandidateStatus(id: string, status: CandidateStatus) {
    const response = await fetch('/api/review', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        candidateId: id,
        status
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      extractError = payload.error || '审核更新失败。';
      return;
    }

    candidates = candidates.map((candidate) =>
      candidate.id === id ? mapCandidate(payload.candidate) : candidate
    );
  }

  async function commitApproved() {
    const book = getCurrentBook();
    if (!book?.id || !currentRunId) {
      extractError = '当前没有可提交批次。';
      return;
    }

    const response = await fetch('/api/commit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookId: book.id,
        runId: currentRunId
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      extractError = payload.error || '提交 Supabase 失败。';
      return;
    }

    extractNotice = `已提交 ${payload.insertedCount || 0} 条到 Supabase`;
    await refreshExtraction(book.id);
    await refreshLibrary();
  }

  function reviewFilterCount(filter: ReviewFilter) {
    if (filter === 'all') return candidates.length;
    return candidates.filter((candidate) => candidate.status === filter).length;
  }

  function libraryFilterMatch(item: LibraryQuote) {
    if (activeLibraryFilter === 'all') return true;
    if (activeLibraryFilter === 'pending') return item.state === '待审';
    if (activeLibraryFilter === 'sad') return item.moods.includes('sad');
    if (activeLibraryFilter === 'classical') return item.genre === '古典';
    return true;
  }

  $: filteredCandidates =
    activeReviewFilter === 'all'
      ? candidates
      : candidates.filter((candidate) => candidate.status === activeReviewFilter);
  $: approvedCount = candidates.filter((candidate) => candidate.status === 'approved').length;
  $: pendingCount = candidates.filter((candidate) => candidate.status === 'pending').length;
  $: rejectedCount = candidates.filter((candidate) => candidate.status === 'rejected').length;
  $: processedCount = approvedCount + rejectedCount;
  $: approvalRate = candidates.length ? Math.round((approvedCount / candidates.length) * 100) : 0;
  $: filteredLibraryQuotes = libraryQuotes.filter(libraryFilterMatch);
  $: extractProgressWidth =
    extractStatus === 'RUNNING'
      ? 'w-[55%]'
      : currentRunId && extractStatus === 'DONE'
        ? 'w-full'
        : 'w-0';
  $: if (configReady) {
    persistLocalConfig(config);
  }

  onMount(async () => {
    try {
      const [configResponse, booksResponse] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/books')
      ]);
      if (configResponse.ok) {
        const configPayload = await configResponse.json();
        const nextConfig = configPayload.config;
        serverConfigFallback = normalizeConfig({
          apiUrl: nextConfig.apiBaseUrl || config.apiUrl,
          model: nextConfig.model || config.model,
          apiKey: nextConfig.apiKey || '',
          chunkSize: nextConfig.chunkSize || config.chunkSize,
          concurrency: nextConfig.concurrency || config.concurrency,
          temperature: nextConfig.temperature ?? config.temperature,
          prompt: nextConfig.promptTemplate || config.prompt
        });
        config = loadLocalConfig() ?? serverConfigFallback;
      } else {
        config = loadLocalConfig() ?? createDefaultConfig();
      }
      configReady = true;

      if (booksResponse.ok) {
        const booksPayload = await booksResponse.json();
        selectedFiles = (booksPayload.books || []).map((book: any) => mapBookSummary(book));
        if (selectedFiles.length) {
          currentBookId = selectedFiles[0]?.id || '';
          extractNotice = `已恢复 ${selectedFiles.length} 本本地解析记录`;
          if (currentBookId) {
            await refreshExtraction(currentBookId);
          }
        }
      }

      await Promise.all([refreshLibrary(), refreshAlmanac()]);
    } catch {
      extractError = '初始化本地工作台失败。';
    }
  });
</script>

<svelte:head>
  <title>Layer1 工作台</title>
  <meta
    name="description"
    content="本地语料工作台，包含提取配置、待审核清单、名句库和宜忌浏览。"
  />
</svelte:head>

<div class="min-h-screen px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
  <div class="mx-auto max-w-[1180px]">
    <section class="shell-panel overflow-hidden">
      <header class="px-5 pt-5 sm:px-7 sm:pt-6">
        <div>
          <h1 class="text-[1.05rem] font-semibold text-ink">语料工作台</h1>
        </div>

        <nav class="mt-6 flex gap-6 border-b border-[#ded4c7] text-sm">
          {#each mainTabs as tab}
            <button class:tab-trigger={true} class:is-active={activeTab === tab.id} on:click={() => (activeTab = tab.id)}>
              {tab.label}
            </button>
          {/each}
        </nav>
      </header>

      {#if activeTab === 'extract'}
        <div class="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          <section class="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
            <article class="soft-panel overflow-hidden">
              <header class="flex items-center justify-between border-b border-[#ded4c7] px-4 py-3.5 sm:px-5">
                <h2 class="text-[0.98rem] font-medium text-ink">提取配置</h2>
                <span class="chip">{extractStatus}</span>
              </header>

              <div class="space-y-4 p-4 sm:p-5">
                <div class="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
                  <label class="block">
                    <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API URL</span>
                    <input class="field px-4 py-2.5 text-sm" bind:value={config.apiUrl} />
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">模型</span>
                    <input class="field px-4 py-2.5 text-sm" bind:value={config.model} />
                  </label>
                </div>

                <label class="block">
                  <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API KEY</span>
                  <div class="field flex items-center gap-2 px-4 py-2.5">
                    <input class="min-w-0 flex-1 bg-transparent text-sm outline-none" bind:value={config.apiKey} />
                    {#if config.apiKey}
                      <button
                        class="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none text-[#8b7a67] transition hover:bg-[#efe5d8] hover:text-[#5f5244]"
                        type="button"
                        aria-label="清空 API Key"
                        on:click={clearApiKey}
                      >
                        ×
                      </button>
                    {/if}
                  </div>
                </label>

                <div class="grid gap-4 md:grid-cols-3">
                  <label class="block">
                    <div class="mb-1.5 flex items-center justify-between text-[12px] text-[#6f604f]">
                      <span>切片大小</span>
                      <span>{config.chunkSize} 字</span>
                    </div>
                    <input class="w-full accent-[#b59067]" type="range" min="1000" max="6000" step="500" bind:value={config.chunkSize} />
                  </label>

                  <label class="block">
                    <div class="mb-1.5 flex items-center justify-between text-[12px] text-[#6f604f]">
                      <span>并发数</span>
                      <span>{config.concurrency}</span>
                    </div>
                    <input class="w-full accent-[#b59067]" type="range" min="1" max="5" step="1" bind:value={config.concurrency} />
                  </label>

                  <label class="block">
                    <div class="mb-1.5 flex items-center justify-between text-[12px] text-[#6f604f]">
                      <span>Temperature</span>
                      <span>{config.temperature.toFixed(1)}</span>
                    </div>
                    <input
                      class="w-full accent-[#b59067]"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      bind:value={config.temperature}
                    />
                  </label>
                </div>

                <label class="block">
                  <textarea class="field min-h-[260px] resize-none px-4 py-3 text-sm leading-7" bind:value={config.prompt}></textarea>
                </label>
              </div>
            </article>

            <article class="soft-panel overflow-hidden">
              <header class="flex items-center justify-between border-b border-[#ded4c7] px-4 py-3.5 sm:px-5">
                <h2 class="text-[0.98rem] font-medium text-ink">导入 txt 文件</h2>
              </header>

              <div class="space-y-4 p-4 sm:p-5">
                <label class="block">
                  <div class="rounded-[18px] border border-dashed border-[#d4c7b8] bg-[#fffdf8] px-4 py-8 text-center">
                    <p class="text-sm text-[#7a6a58]">拖入或点击选择</p>
                    <p class="mt-2 text-xs text-[#8b7a67]">仅在当前设备解析，不上传到服务器</p>
                    <span class="btn-secondary mt-4 inline-flex cursor-pointer">
                      选择 txt 文件
                      <input class="hidden" type="file" multiple accept=".txt,text/plain" on:change={handleFileChange} />
                    </span>
                  </div>
                </label>

                <div class="flex flex-wrap justify-end gap-2">
                  <button class="btn-secondary px-3 py-2 text-sm font-medium" type="button" on:click={clearCurrentBookResults}>
                    清空当前书结果
                  </button>
                  <button class="btn-secondary px-3 py-2 text-sm font-medium text-[#9c5a55]" type="button" on:click={deleteCurrentBook}>
                    删除当前书
                  </button>
                </div>

                <div class="space-y-2">
                  {#each selectedFiles as file}
                    <button
                      class={`flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm ${currentBookId === file.id ? 'bg-[#eadfce]' : 'bg-[#f6f2eb]'}`}
                      type="button"
                      on:click={async () => {
                        currentBookId = file.id || '';
                        if (currentBookId) {
                          await refreshExtraction(currentBookId);
                        }
                      }}
                    >
                      <div class="min-w-0">
                        <p class="truncate text-[#5f5244]">{file.name}</p>
                        <p class="mt-1 truncate text-xs text-[#867562]">
                          {file.title}
                          {#if file.author}
                            · {file.author}
                          {/if}
                          {#if file.genre}
                            · {file.genre}
                          {/if}
                        </p>
                      </div>
                      <div class="ml-3 flex items-center gap-2 text-xs text-[#8b7a67]">
                        <span>{file.sizeLabel}</span>
                      </div>
                    </button>
                  {/each}
                </div>

                <div class="space-y-2 rounded-[18px] bg-[#fbf7f0] px-4 py-3">
                  <div class="metric flex items-center justify-between">
                    <span>{extractNotice}</span>
                    <span>批次 {currentRunId ? currentRunId.slice(0, 8) : '--'}　并发 {config.concurrency}</span>
                  </div>
                  <div class="h-2 rounded-full bg-[#ece4da]">
                    <div
                      class={`h-2 rounded-full bg-[#d7c2a2] transition-all duration-300 ${extractProgressWidth}`}
                    ></div>
                  </div>
                </div>

                {#if extractError}
                  <div class="rounded-[16px] border border-[#e4c7c7] bg-[#fff4f3] px-4 py-3 text-sm text-[#9c5a55]">
                    {extractError}
                  </div>
                {/if}

                <button class="btn-primary w-full font-medium" type="button" on:click={startExtraction}>开始提取</button>
              </div>
            </article>
          </section>

          <section class="soft-panel overflow-hidden">
            <header class="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div>
                <h2 class="text-[0.98rem] font-medium text-ink">待审清单</h2>
              </div>
              <div class="flex items-center gap-3">
                <span class="chip border-[#b5cca8] bg-[#f2f9ed] text-[#648150]">已提取 {candidates.length} 条</span>
                <button class="chip chip-action font-medium" type="button" on:click={commitApproved}>入库已通过 {approvedCount} 条</button>
              </div>
            </header>

            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div class="flex flex-wrap gap-2">
                {#each reviewFilters as filter}
                  <button
                    class:chip={true}
                    class:is-active={activeReviewFilter === filter.id}
                    on:click={() => (activeReviewFilter = filter.id)}
                  >
                    {filter.label} {reviewFilterCount(filter.id)}
                  </button>
                {/each}
              </div>
              <div class="text-sm text-[#6f604f]">已审 {processedCount}/{candidates.length}</div>
            </div>

            <div>
              {#if filteredCandidates.length}
                {#each filteredCandidates as candidate}
                  <article class="flex flex-wrap items-start justify-between gap-4 border-b border-[#ded4c7] px-4 py-5 sm:px-5">
                    <div class="min-w-0 flex-1">
                      <p class="quote-text text-[1.08rem]">{candidate.text}</p>
                      <div class="mt-4 flex flex-wrap items-center gap-2 text-[0.84rem] text-[#7b6b59]">
                        <span class="tiny-dot" style={`background:${candidate.dot}`}></span>
                        <span>{candidate.author}</span>
                        <span>{candidate.work}</span>
                        <span>{candidate.genre}</span>
                        {#each candidate.moods as mood}
                          <span class="tag">{mood}</span>
                        {/each}
                        {#each candidate.themes as theme}
                          <span class="tag">{theme}</span>
                        {/each}
                        <span class="text-base leading-none text-[#8f806f]">•••</span>
                      </div>
                    </div>

                    <div class="action-stack flex items-center gap-2">
                      <button class="action-button" type="button" on:click={() => setCandidateStatus(candidate.id, 'approved')}>收</button>
                      <button class="action-button" type="button" on:click={() => setCandidateStatus(candidate.id, 'rejected')}>弃</button>
                    </div>
                  </article>
                {/each}
              {:else}
                <div class="px-4 py-12 text-center text-sm text-[#7b6b59] sm:px-5">
                  当前没有待审核候选。先读取 txt，再开始提取。
                </div>
              {/if}
            </div>

            <footer class="flex flex-wrap gap-x-6 gap-y-2 bg-[#f5f1ea] px-4 py-3 text-[0.82rem] text-[#6f604f] sm:px-5">
              <span>本批 {candidates.length} 条</span>
              <span>通过率 {approvalRate}%</span>
              <span>待审 {pendingCount} 条</span>
              <span>待入库 {approvedCount} 条</span>
            </footer>
          </section>
        </div>
      {:else if activeTab === 'library'}
        <div class="px-4 py-4 sm:px-6 sm:py-5">
          <section class="soft-panel overflow-hidden">
            <header class="flex items-center justify-between border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div>
                <h2 class="text-[0.98rem] font-medium text-ink">语料管理</h2>
                <div class="mt-3 flex gap-6 border-b border-transparent text-sm">
                  <span class="tab-trigger is-active">名句库</span>
                </div>
              </div>
            </header>

            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div class="flex flex-wrap gap-2">
                {#each libraryFilters as filter}
                  <button
                    class:chip={true}
                    class:is-active={activeLibraryFilter === filter.id}
                    on:click={() => (activeLibraryFilter = filter.id)}
                  >
                    {filter.label}
                  </button>
                {/each}
              </div>
              <button class="btn-secondary px-6" type="button">导入</button>
            </div>

            <div>
              {#if filteredLibraryQuotes.length}
                {#each filteredLibraryQuotes as quote}
                  <article class="flex items-start justify-between gap-4 border-b border-[#ded4c7] px-4 py-5 sm:px-5">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start gap-3">
                        <span class="tiny-dot mt-2" style={`background:${quote.dot}`}></span>
                        <div class="min-w-0">
                          <p class="quote-text text-[1.08rem]">{quote.text}</p>
                          <div class="mt-4 flex flex-wrap items-center gap-2 text-[0.84rem] text-[#7b6b59]">
                            <span>{quote.author}</span>
                            <span>{quote.work}</span>
                            <span class="tag">{quote.genre}</span>
                            {#each quote.moods as mood}
                              <span class="tag">{mood}</span>
                            {/each}
                            {#each quote.themes as theme}
                              <span class="tag">{theme}</span>
                            {/each}
                            {#if quote.state}
                              <span class="tag bg-[#f7f0dd] text-[#8b7047]">{quote.state}</span>
                            {/if}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button class="text-xl leading-none text-[#8f806f]" type="button">⋮</button>
                  </article>
                {/each}
              {:else}
                <div class="px-4 py-12 text-center text-sm text-[#7b6b59] sm:px-5">
                  名句库为空。提交通过的候选后，这里才会出现内容。
                </div>
              {/if}
            </div>

            <footer class="flex flex-wrap gap-x-6 gap-y-2 bg-[#f5f1ea] px-4 py-3 text-[0.82rem] text-[#6f604f] sm:px-5">
              <span>{libraryStats.totalCommitted} 条已入库</span>
              <span>{libraryStats.pending} 条待审</span>
              <span>{filteredLibraryQuotes.length} 条当前列表</span>
            </footer>
          </section>
        </div>
      {:else}
        <div class="px-4 py-4 sm:px-6 sm:py-5">
          <section class="soft-panel overflow-hidden">
            <header class="border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <h2 class="text-[0.98rem] font-medium text-ink">语料管理</h2>
              <div class="mt-3 flex gap-6 text-sm">
                <span class="tab-trigger is-active">宜忌</span>
              </div>
            </header>

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

            <div>
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
                  宜忌记录为空。连接 Supabase 后，这里会显示今日与历史记录。
                </div>
              {/if}
            </div>
          </section>
        </div>
      {/if}
    </section>
  </div>
</div>
