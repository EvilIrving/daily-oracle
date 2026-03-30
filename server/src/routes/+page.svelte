<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import QuoteCard from '$lib/components/QuoteCard.svelte';
  import { notifyError, notifySuccess } from '$lib/notifications';
  import { deriveExtractionProgress, type ExtractionProgressSnapshot } from '$lib/extraction-progress';

  type MainTab = 'extract' | 'library' | 'almanac';
  type ReviewFilter = 'all' | 'pending';
  type CandidateStatus = 'pending' | 'approved' | 'rejected';

  type Candidate = {
    id: string;
    text: string;
    author: string;
    work: string;
    year?: number | null;
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
    year?: number | null;
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

  type ExtractConfig = {
    apiUrl: string;
    model: string;
    apiKey: string;
    chunkSize: number;
    concurrency: number;
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
    prompt: string;
  };

  type ProviderProfile = {
    id: string;
    name: string;
    config: ExtractConfig;
  };

  type ProviderConfigState = {
    activeProviderId: string;
    providers: ProviderProfile[];
  };

  const LEGACY_CONFIG_STORAGE_KEY = 'daily-quote.extract-config';
  const CONFIG_STORAGE_KEY = 'daily-quote.extract-config.providers.v1';
  const DEFAULT_PROVIDER_IDS = ['provider-1', 'provider-2', 'provider-3', 'provider-4'] as const;
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
    { id: 'pending', label: '待处理' }
  ];

  let activeTab: MainTab = 'extract';
  let activeReviewFilter: ReviewFilter = 'all';
  let currentBookId = '';
  let currentRunId = '';
  let currentRunLabel = '--';
  let extractStatus = 'IDLE';
  let runProcessedChunks = 0;
  let runTotalChunks = 0;
  let runFailedChunks = 0;
  let runActiveWorkers = 0;
  let runLastError: string | null = null;
  let stopRequestPending = false;
  let frozenExtractionProgress: ExtractionProgressSnapshot | null = null;
  let progressStream: EventSource | null = null;
  let progressStreamBookId = '';
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
  let currentBook: (typeof selectedFiles)[number] | null = null;

  let config = createDefaultConfig();
  let serverConfigFallback = createDefaultConfig();
  let providerState = createDefaultProviderState();
  let activeProviderId = providerState.activeProviderId;
  let activeProvider: ProviderProfile | null = null;
  let configReady = false;

  let candidates: Candidate[] = [];
  let libraryQuotes: LibraryQuote[] = [];
  let libraryAuthorOptions: { value: string; label: string; count: number }[] = [];
  let libraryMoodOptions: { value: string; label: string; count: number }[] = [];
  let libraryThemeOptions: { value: string; label: string; count: number }[] = [];
  let selectedLibraryAuthor = 'all';
  let selectedLibraryMood = 'all';
  let selectedLibraryTheme = 'all';
  let authorFiltersExpanded = false;
  let moodFiltersExpanded = false;
  let themeFiltersExpanded = false;
  let filteredLibraryQuotes: LibraryQuote[] = [];
  let deletingLibraryQuoteIds = new Set<string>();
  let almanacToday: AlmanacTodayCard | null = createInitialAlmanacToday();
  let libraryStats = {
    totalCommitted: 0,
    pending: 0
  };

  let extractNotice = '等待导入 txt 文件';

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

  function createDefaultConfig(): ExtractConfig {
    return {
      apiUrl: 'https://open.bigmodel.cn/api/anthropic',
      model: 'glm-5.1',
      apiKey: '',
      chunkSize: 3000,
      concurrency: 3,
      temperature: 0.3,
      topP: 0.9,
      topK: 50,
      maxTokens: 4096,
      prompt: DEFAULT_PROMPT
    };
  }

  function createDefaultProviderState(baseConfig: ExtractConfig = createDefaultConfig()): ProviderConfigState {
    return {
      activeProviderId: DEFAULT_PROVIDER_IDS[0],
      providers: DEFAULT_PROVIDER_IDS.map((id, index) => ({
        id,
        name: `提供商 ${index + 1}`,
        config: normalizeConfig(baseConfig)
      }))
    };
  }

  function normalizeConfig(input: Partial<ExtractConfig> | null | undefined): ExtractConfig {
    const fallback = createDefaultConfig();
    const next = input || {};
    const toFiniteNumber = (value: unknown, defaultValue: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    };

    return {
      apiUrl: String(next.apiUrl ?? fallback.apiUrl),
      model: String(next.model ?? fallback.model),
      apiKey: String(next.apiKey ?? fallback.apiKey),
      chunkSize: toFiniteNumber(next.chunkSize, fallback.chunkSize),
      concurrency: toFiniteNumber(next.concurrency, fallback.concurrency),
      temperature: toFiniteNumber(next.temperature, fallback.temperature),
      topP: toFiniteNumber(next.topP, fallback.topP),
      topK: toFiniteNumber(next.topK, fallback.topK),
      maxTokens: toFiniteNumber(next.maxTokens, fallback.maxTokens),
      prompt: String(next.prompt ?? fallback.prompt)
    };
  }

  function normalizeProviderState(
    input: Partial<ProviderConfigState> | null | undefined,
    baseConfig: ExtractConfig
  ): ProviderConfigState {
    const fallback = createDefaultProviderState(baseConfig);
    const rawProviders = Array.isArray(input?.providers) ? input?.providers : [];
    const providerMap = new Map<string, ProviderProfile>();

    for (const raw of rawProviders) {
      if (!raw || typeof raw !== 'object') continue;
      const id = String(raw.id || '').trim();
      if (!id) continue;
      providerMap.set(id, {
        id,
        name: String(raw.name || id),
        config: normalizeConfig(raw.config)
      });
    }

    const providers = DEFAULT_PROVIDER_IDS.map((id, index) => {
      const hit = providerMap.get(id);
      if (hit) {
        return hit;
      }

      return {
        id,
        name: `提供商 ${index + 1}`,
        config: normalizeConfig(baseConfig)
      };
    });

    const requestedActiveId = String(input?.activeProviderId || '').trim();
    const activeProviderId = providers.some((item) => item.id === requestedActiveId)
      ? requestedActiveId
      : providers[0]?.id || fallback.activeProviderId;

    return {
      activeProviderId,
      providers
    };
  }

  function getProviderById(state: ProviderConfigState, id: string) {
    return state.providers.find((provider) => provider.id === id) ?? null;
  }

  function loadLocalProviderState(baseConfig: ExtractConfig) {
    if (!browser) return null;

    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        return normalizeProviderState(JSON.parse(raw), baseConfig);
      }

      const legacyRaw = window.localStorage.getItem(LEGACY_CONFIG_STORAGE_KEY);
      if (!legacyRaw) return null;

      const legacyConfig = normalizeConfig(JSON.parse(legacyRaw));
      return createDefaultProviderState(legacyConfig);
    } catch {
      return null;
    }
  }

  function persistLocalProviderState(nextState = providerState) {
    if (!browser) return;
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(nextState));
  }

  function hydrateConfigFromProvider(providerId: string) {
    const provider = getProviderById(providerState, providerId) ?? providerState.providers[0] ?? null;
    if (!provider) return;
    config = normalizeConfig(provider.config);
    activeProviderId = provider.id;
  }

  function getCurrentBook() {
    return selectedFiles.find((file) => file.id === currentBookId) ?? selectedFiles[0] ?? null;
  }

  $: currentBook = getCurrentBook();

  function formatFileSize(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  function formatRunLabel(run: any) {
    if (!run) return '--';

    const stamp = run.startedAt || run.started_at || run.finishedAt || run.finished_at;
    if (!stamp) return '本次提取';

    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return '本次提取';

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute} 提取`;
  }

  function applyRunState(run: any) {
    if (!run) {
      currentRunId = '';
      currentRunLabel = '--';
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
    currentRunLabel = formatRunLabel(run);
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

  function closeProgressStream() {
    progressStream?.close();
    progressStream = null;
    progressStreamBookId = '';
  }

  function syncFromExtractionPayload(payload: any, { preserveNotice = false } = {}) {
    applyRunState(payload.run);
    candidates = (payload.candidates || []).map(mapCandidate);

    if (preserveNotice) return;

    if (!payload.run) {
      extractNotice = '当前书目还没有提取批次';
      return;
    }

    extractNotice = deriveExtractionProgress({
      runId: currentRunId,
      status: extractStatus,
      processedChunks: runProcessedChunks,
      failedChunks: runFailedChunks,
      activeWorkers: runActiveWorkers,
      totalChunks: runTotalChunks,
      candidatesCount: candidates.length,
      stopRequestPending,
      lastError: runLastError,
      frozenProgress: frozenExtractionProgress
    }).statusText;
  }

  function ensureProgressStream(bookId: string) {
    if (!browser || !bookId) return;
    if (!currentRunId || !['RUNNING', 'QUEUED'].includes(extractStatus)) {
      closeProgressStream();
      return;
    }

    if (progressStreamBookId && progressStreamBookId !== bookId) {
      closeProgressStream();
    }

    if (progressStream) return;

    progressStream = new EventSource(`/api/extract?bookId=${encodeURIComponent(bookId)}&stream=1`);
    progressStreamBookId = bookId;
    progressStream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        syncFromExtractionPayload(payload);

        if (!['RUNNING', 'QUEUED'].includes(extractStatus)) {
          closeProgressStream();
        }
      } catch (error) {
        console.error('Failed to parse extraction stream payload.', error);
      }
    };
    progressStream.onerror = async () => {
      closeProgressStream();
      if (bookId) {
        await refreshExtraction(bookId);
      }
    };
  }

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

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
      notifySuccess(`已完成 ${mapped.length} 本 txt 文件的读取与解析`);
      if (currentBookId) {
        await refreshExtraction(currentBookId);
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'TXT 解析失败。');
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
        topP: Number(config.topP),
        topK: Number(config.topK),
        maxTokens: Number(config.maxTokens),
        promptTemplate: config.prompt
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || '配置保存失败。');
    }
  }

  function clearApiKey() {
    clearTextField('apiKey');
  }

  function clearTextField(field: 'apiUrl' | 'model' | 'apiKey') {
    config = {
      ...config,
      [field]: ''
    };
  }

  function updateProviderName(name: string) {
    providerState = {
      ...providerState,
      providers: providerState.providers.map((provider) =>
        provider.id === activeProviderId ? { ...provider, name: name.trim() || provider.name } : provider
      )
    };
  }

  function switchProvider(providerId: string) {
    const target = getProviderById(providerState, providerId);
    if (!target) return;

    providerState = {
      ...providerState,
      activeProviderId: providerId,
      providers: providerState.providers.map((provider) =>
        provider.id === activeProviderId ? { ...provider, config: normalizeConfig(config) } : provider
      )
    };
    hydrateConfigFromProvider(providerId);
  }

  async function copyValue(label: string, value: string) {
    if (!browser) return;

    const text = value || '';
    if (!text) {
      notifyError(`${label} 为空，无法复制。`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      extractNotice = `${label} 已复制到剪贴板`;
      notifySuccess(`${label} 已复制到剪贴板`);
    } catch {
      notifyError(`复制 ${label} 失败，请检查浏览器权限。`);
    }
  }

  function mapCandidate(item: any): Candidate {
    return {
      id: item.id,
      text: item.text,
      author: item.author || '未知作者',
      work: item.work || item.sourceBook || '未知作品',
      year: item.year,
      genre: item.genre || '未标注',
      moods: item.moods || [],
      themes: item.themes || [],
      status: 'pending',
      dot: '#b59067'
    };
  }

  function mapLibraryQuote(item: any): LibraryQuote {
    return {
      id: item.id,
      text: item.text,
      author: item.author || '未知作者',
      work: item.work || '未知作品',
      year: item.year ?? null,
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
    syncFromExtractionPayload(payload);
    ensureProgressStream(bookId);
  }

  async function clearCurrentBookResults() {
    const book = getCurrentBook();
    if (!book?.id) {
      notifyError('请先选择一本书。');
      return;
    }

    if (extractStatus === 'RUNNING') {
      notifyError('提取进行中，暂时不能清空结果。');
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
      notifyError(payload.error || '清空提取结果失败。');
      return;
    }

    currentRunId = '';
    currentRunLabel = '--';
    runProcessedChunks = 0;
    runTotalChunks = 0;
    runFailedChunks = 0;
    runActiveWorkers = 0;
    runLastError = null;
    stopRequestPending = false;
    frozenExtractionProgress = null;
    candidates = [];
    extractStatus = 'IDLE';
    closeProgressStream();
    extractNotice = `已清空《${book.title || book.name}》的提取结果`;
    notifySuccess(`已清空《${book.title || book.name}》的提取结果`);
  }

  async function deleteBook(bookId: string) {
    const book = selectedFiles.find((item) => item.id === bookId) ?? null;
    if (!book?.id) {
      notifyError('未找到要删除的书。');
      return;
    }

    if (extractStatus === 'RUNNING' && currentBookId === book.id) {
      notifyError('提取进行中，暂时不能删除书籍。');
      return;
    }

    const response = await fetch(`/api/books?bookId=${encodeURIComponent(book.id)}`, {
      method: 'DELETE'
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      notifyError(payload.error || '删除书籍失败。');
      return;
    }

    selectedFiles = selectedFiles.filter((item) => item.id !== book.id);
    if (currentBookId === book.id) {
      const nextBook = selectedFiles[0] ?? null;
      currentBookId = nextBook?.id || '';
      currentRunId = '';
      currentRunLabel = '--';
      runProcessedChunks = 0;
      runTotalChunks = 0;
      runFailedChunks = 0;
      runActiveWorkers = 0;
      runLastError = null;
      stopRequestPending = false;
      frozenExtractionProgress = null;
      candidates = [];
      extractStatus = 'IDLE';
      closeProgressStream();

      if (nextBook?.id) {
        extractNotice = `已删除《${book.title || book.name}》，切换到《${nextBook.title || nextBook.name}》`;
        notifySuccess(`已删除《${book.title || book.name}》，切换到《${nextBook.title || nextBook.name}》`);
        await refreshExtraction(nextBook.id);
        return;
      }

      extractNotice = `已删除《${book.title || book.name}》`;
      notifySuccess(`已删除《${book.title || book.name}》`);
      return;
    }

    extractNotice = `已删除《${book.title || book.name}》`;
    notifySuccess(`已删除《${book.title || book.name}》`);
  }

  async function refreshLibrary() {
    const response = await fetch('/api/library');
    const payload = await response.json().catch(() => ({}));

    libraryQuotes = (payload.quotes || []).map(mapLibraryQuote);
    libraryStats = payload.stats || libraryStats;

    if (!response.ok) {
      notifyError(payload.error || '读取语料管理库失败。');
      return;
    }
  }

  async function refreshAlmanac() {
    const response = await fetch('/api/almanac');
    const payload = await response.json().catch(() => ({}));

    almanacToday = payload.today ? mapAlmanacToday(payload.today) : null;
    almanacHistory = (payload.history || []).map(mapAlmanacEntry);

    if (!response.ok) {
      notifyError(payload.error || '读取宜忌失败。');
    }
  }

  async function startExtraction() {
    const book = getCurrentBook();
    if (!book?.id) {
      notifyError('请先读取 txt。');
      return;
    }

    try {
      await saveConfig();
      stopRequestPending = false;
      frozenExtractionProgress = null;
      extractStatus = 'RUNNING';
      extractNotice = '正在提取，请稍候…';
      closeProgressStream();

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

      syncFromExtractionPayload(payload);
      ensureProgressStream(book.id);
    } catch (error) {
      console.error('Extraction failed with raw error.', error);
      stopRequestPending = false;
      frozenExtractionProgress = null;
      extractStatus = 'ERROR';
      notifyError(error instanceof Error ? error.message : '提取失败。');
    }
  }

  async function stopExtraction() {
    const book = getCurrentBook();
    if (!book?.id) {
      notifyError('当前没有可停止的提取任务。');
      return;
    }

    try {
      stopRequestPending = true;
      frozenExtractionProgress = {
        runId: currentRunId,
        processedChunks: runProcessedChunks,
        failedChunks: runFailedChunks,
        activeWorkers: runActiveWorkers,
        totalChunks: runTotalChunks
      };
      const response = await fetch('/api/extract', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookId: book.id,
          runId: currentRunId || undefined
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || '停止提取失败。');
      }

      closeProgressStream();
      applyRunState(payload.run);
      extractNotice = deriveExtractionProgress({
        runId: currentRunId,
        status: extractStatus,
        processedChunks: runProcessedChunks,
        failedChunks: runFailedChunks,
        activeWorkers: runActiveWorkers,
        totalChunks: runTotalChunks,
        candidatesCount: candidates.length,
        stopRequestPending,
        lastError: runLastError,
        frozenProgress: frozenExtractionProgress
      }).statusText;
      notifySuccess(extractNotice);
      await refreshExtraction(book.id);
    } catch (error) {
      stopRequestPending = false;
      frozenExtractionProgress = null;
      notifyError(error instanceof Error ? error.message : '停止提取失败。');
    }
  }

  async function setCandidateStatus(id: string, status: CandidateStatus) {
    const removedIndex = candidates.findIndex((candidate) => candidate.id === id);
    const removedCandidate = removedIndex >= 0 ? candidates[removedIndex] : null;
    if (!removedCandidate) return;

    candidates = candidates.filter((candidate) => candidate.id !== id);
    extractNotice = '';

    try {
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
        candidates = [
          ...candidates.slice(0, removedIndex),
          removedCandidate,
          ...candidates.slice(removedIndex)
        ];
        notifyError(payload.error || '审核更新失败。');
        return;
      }

      extractNotice = status === 'approved' ? '已收录到 Supabase' : '已丢弃当前候选';
      notifySuccess(extractNotice);

      if (status === 'approved') {
        await refreshLibrary();
      }
    } catch (error) {
      candidates = [
        ...candidates.slice(0, removedIndex),
        removedCandidate,
        ...candidates.slice(removedIndex)
      ];
      notifyError(error instanceof Error ? error.message : '审核更新失败。');
    }
  }

  async function deleteLibraryQuote(id: string) {
    const target = libraryQuotes.find((quote) => quote.id === id);
    if (!target || deletingLibraryQuoteIds.has(id)) {
      return;
    }

    deletingLibraryQuoteIds = new Set([...deletingLibraryQuoteIds, id]);
    libraryQuotes = libraryQuotes.filter((quote) => quote.id !== id);
    libraryStats = {
      ...libraryStats,
      totalCommitted: Math.max(0, Number(libraryStats.totalCommitted || 0) - 1)
    };
    notifySuccess('已从语料管理库删除这条名句');

    const response = await fetch('/api/library', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quoteId: id })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      libraryQuotes = [target, ...libraryQuotes];
      libraryStats = {
        ...libraryStats,
        totalCommitted: Number(libraryStats.totalCommitted || 0) + 1
      };
      notifyError(payload.error || '删除名句失败。');
      deletingLibraryQuoteIds = new Set([...deletingLibraryQuoteIds].filter((quoteId) => quoteId !== id));
      return;
    }

    deletingLibraryQuoteIds = new Set([...deletingLibraryQuoteIds].filter((quoteId) => quoteId !== id));
  }

  function reviewFilterCount(filter: ReviewFilter) {
    if (filter === 'all') return candidates.length;
    return candidates.length;
  }

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

  function selectLibraryAuthor(value: string) {
    selectedLibraryAuthor = value;
  }

  function selectLibraryMood(value: string) {
    selectedLibraryMood = value;
  }

  function selectLibraryTheme(value: string) {
    selectedLibraryTheme = value;
  }

  $: filteredCandidates =
    activeReviewFilter === 'all'
      ? candidates
      : candidates.filter((candidate) => candidate.status === activeReviewFilter);
  $: pendingCount = candidates.filter((candidate) => candidate.status === 'pending').length;
  $: libraryAuthorOptions = buildLibraryOptions(
    libraryQuotes.map((quote) => quote.author).filter(Boolean),
    '全部作者'
  );
  $: libraryMoodOptions = buildLibraryOptions(
    libraryQuotes.flatMap((quote) => quote.moods).filter(Boolean),
    '全部心情'
  );
  $: libraryThemeOptions = buildLibraryOptions(
    libraryQuotes.flatMap((quote) => quote.themes).filter(Boolean),
    '全部主题'
  );
  $: if (selectedLibraryAuthor !== 'all' && !libraryAuthorOptions.some((option) => option.value === selectedLibraryAuthor)) {
    selectedLibraryAuthor = 'all';
  }
  $: if (selectedLibraryMood !== 'all' && !libraryMoodOptions.some((option) => option.value === selectedLibraryMood)) {
    selectedLibraryMood = 'all';
  }
  $: if (selectedLibraryTheme !== 'all' && !libraryThemeOptions.some((option) => option.value === selectedLibraryTheme)) {
    selectedLibraryTheme = 'all';
  }
  $: filteredLibraryQuotes = applyLibraryFilters(
    libraryQuotes,
    selectedLibraryAuthor,
    selectedLibraryMood,
    selectedLibraryTheme
  );
  $: extractionProgress = deriveExtractionProgress({
    runId: currentRunId,
    status: extractStatus,
    processedChunks: runProcessedChunks,
    failedChunks: runFailedChunks,
    activeWorkers: runActiveWorkers,
    totalChunks: runTotalChunks,
    candidatesCount: candidates.length,
    stopRequestPending,
    lastError: runLastError,
    frozenProgress: frozenExtractionProgress
  });
  $: activeProvider = getProviderById(providerState, activeProviderId);
  $: if (configReady) {
    const nextState: ProviderConfigState = {
      ...providerState,
      activeProviderId,
      providers: providerState.providers.map((provider) =>
        provider.id === activeProviderId ? { ...provider, config: normalizeConfig(config) } : provider
      )
    };
    persistLocalProviderState(nextState);
  }

  onMount(() => {
    void (async () => {
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
            topP: nextConfig.topP ?? config.topP,
            topK: nextConfig.topK ?? config.topK,
            maxTokens: nextConfig.maxTokens ?? config.maxTokens,
            prompt: nextConfig.promptTemplate || config.prompt
          });
          providerState = loadLocalProviderState(serverConfigFallback) ?? createDefaultProviderState(serverConfigFallback);
        } else {
          providerState = loadLocalProviderState(createDefaultConfig()) ?? createDefaultProviderState(createDefaultConfig());
        }
        activeProviderId = providerState.activeProviderId;
        hydrateConfigFromProvider(activeProviderId);
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
        notifyError('初始化本地工作台失败。');
      }
    })();

    return () => {
      closeProgressStream();
    };
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
              </header>

              <div class="space-y-4 p-4 sm:p-5">
                <div class="grid gap-3 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <label class="block">
                    <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">模型提供商</span>
                    <select
                      class="field w-full px-4 py-2.5 text-sm"
                      value={activeProviderId}
                      on:change={(event) => switchProvider((event.currentTarget as HTMLSelectElement).value)}
                    >
                      {#each providerState.providers as provider}
                        <option value={provider.id}>{provider.name}</option>
                      {/each}
                    </select>
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">提供商名称</span>
                    <input
                      class="field px-4 py-2.5 text-sm"
                      value={activeProvider?.name || ''}
                      on:input={(event) => updateProviderName((event.currentTarget as HTMLInputElement).value)}
                    />
                  </label>
                </div>

                <div class="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
                  <label class="block">
                    <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API URL</span>
                    <div class="field flex items-center gap-2 px-4 py-2.5">
                      <input class="min-w-0 flex-1 bg-transparent text-sm outline-none" bind:value={config.apiUrl} />
                      <button
                        class="rounded-full px-2 py-0.5 text-[11px] text-[#7f6a55] transition hover:bg-[#efe5d8] hover:text-[#5f5244]"
                        type="button"
                        on:click={() => copyValue('API URL', config.apiUrl)}
                      >
                        复制
                      </button>
                      {#if config.apiUrl}
                        <button
                          class="rounded-full px-2 py-0.5 text-[11px] text-[#7f6a55] transition hover:bg-[#efe5d8] hover:text-[#5f5244]"
                          type="button"
                          on:click={() => clearTextField('apiUrl')}
                        >
                          清空
                        </button>
                      {/if}
                    </div>
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">模型</span>
                    <div class="field flex items-center gap-2 px-4 py-2.5">
                      <input class="min-w-0 flex-1 bg-transparent text-sm outline-none" bind:value={config.model} />
                      <button
                        class="rounded-full px-2 py-0.5 text-[11px] text-[#7f6a55] transition hover:bg-[#efe5d8] hover:text-[#5f5244]"
                        type="button"
                        on:click={() => copyValue('模型', config.model)}
                      >
                        复制
                      </button>
                      {#if config.model}
                        <button
                          class="rounded-full px-2 py-0.5 text-[11px] text-[#7f6a55] transition hover:bg-[#efe5d8] hover:text-[#5f5244]"
                          type="button"
                          on:click={() => clearTextField('model')}
                        >
                          清空
                        </button>
                      {/if}
                    </div>
                  </label>
                </div>

                <label class="block">
                  <span class="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API KEY</span>
                  <div class="field flex items-center gap-2 px-4 py-2.5">
                    <input class="min-w-0 flex-1 bg-transparent text-sm outline-none" bind:value={config.apiKey} />
                    <button
                      class="rounded-full px-2 py-0.5 text-[11px] text-[#7f6a55] transition hover:bg-[#efe5d8] hover:text-[#5f5244]"
                      type="button"
                      on:click={() => copyValue('API Key', config.apiKey)}
                    >
                      复制
                    </button>
                    {#if config.apiKey}
                      <button
                        class="rounded-full px-2 py-0.5 text-[11px] text-[#7f6a55] transition hover:bg-[#efe5d8] hover:text-[#5f5244]"
                        type="button"
                        aria-label="清空 API Key"
                        on:click={clearApiKey}
                      >
                        清空
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

                <div class="grid gap-4 md:grid-cols-3">
                  <label class="block">
                    <div class="mb-1.5 flex items-center justify-between text-[12px] text-[#6f604f]">
                      <span>Top P</span>
                      <span>{config.topP.toFixed(2)}</span>
                    </div>
                    <input
                      class="w-full accent-[#b59067]"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      bind:value={config.topP}
                    />
                  </label>

                  <label class="block">
                    <div class="mb-1.5 flex items-center justify-between text-[12px] text-[#6f604f]">
                      <span>Top K</span>
                      <span>{config.topK}</span>
                    </div>
                    <input
                      class="field w-full px-3 py-2 text-sm"
                      type="number"
                      min="1"
                      step="1"
                      bind:value={config.topK}
                    />
                  </label>

                  <label class="block">
                    <div class="mb-1.5 flex items-center justify-between text-[12px] text-[#6f604f]">
                      <span>Max Tokens</span>
                      <span>{config.maxTokens}</span>
                    </div>
                    <input
                      class="field w-full px-3 py-2 text-sm"
                      type="number"
                      min="1"
                      step="1"
                      bind:value={config.maxTokens}
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
                  <div class="rounded-[18px] border border-dashed border-[#d4c7b8] bg-[#fffdf8] px-4 py-6 text-center">
                    <p class="text-sm text-[#7a6a58]">拖入或点击选择</p>
                    <p class="mt-1.5 text-xs text-[#8b7a67]">仅在当前设备解析，不上传到服务器</p>
                    <span class="btn-secondary mt-3 inline-flex cursor-pointer px-5 py-2 text-base font-medium">
                      选择 txt 文件
                      <input class="hidden" type="file" multiple accept=".txt,text/plain" on:change={handleFileChange} />
                    </span>
                  </div>
                </label>

                <div class="space-y-2">
                  {#each selectedFiles as file}
                    <div class="group relative">
                      <button
                        class={`flex w-full items-center justify-between rounded-[14px] px-3 py-2 pr-11 text-left text-sm ${currentBookId === file.id ? 'bg-[#eadfce]' : 'bg-[#f6f2eb]'}`}
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
                            {#if file.year}
                              · {file.year}
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
                      <button
                        class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#dbcbb9] bg-[#fffaf2] text-sm text-[#9c5a55] opacity-100 shadow-sm transition sm:opacity-0 sm:group-hover:opacity-100"
                        type="button"
                        aria-label={`删除《${file.title || file.name}》`}
                        on:click|stopPropagation={() => deleteBook(file.id || '')}
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>

                <div class="space-y-3 rounded-[18px] bg-[#fbf7f0] px-4 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="chip border-[#d9c7b1] bg-[#fffaf2] text-[#7a6a58]">{extractStatus}</span>
                        <span class="text-sm text-[#7b6b59]">{extractNotice}</span>
                      </div>
                      <p class="text-xs text-[#8b7a67]">当前批次：{currentRunLabel}</p>
                    </div>
                    <div class="shrink-0 text-right text-xs leading-5 text-[#7b7a67]">
                      <p>进行到 {extractionProgress.chunkLabel}</p>
                      <p>失败 {extractionProgress.failedChunks} 段 · 并发 {extractionProgress.activeWorkers}</p>
                    </div>
                  </div>
                  <div class="h-2 rounded-full bg-[#ece4da]">
                    <div
                      class="h-2 rounded-full bg-[#d7c2a2] transition-all duration-300"
                      style={`width:${extractionProgress.progressPercent}%`}
                    ></div>
                  </div>
                  <div class="flex items-center justify-between gap-3 text-[12px] text-[#7a6a58]">
                    <span>{extractionProgress.summaryLabel}</span>
                    <span>{extractionProgress.progressPercent}%</span>
                  </div>
                </div>
                {#if extractionProgress.isRunning}
                  <button
                    class="btn-secondary w-full py-3 text-base font-medium text-[#9c5a55] disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={stopRequestPending}
                    on:click={stopExtraction}
                  >
                    {extractionProgress.actionLabel}
                  </button>
                {:else}
                  <button class="btn-primary w-full py-3 text-base font-medium" type="button" on:click={startExtraction}>
                    {extractionProgress.actionLabel}
                  </button>
                {/if}
              </div>
            </article>
          </section>

          <section class="soft-panel overflow-hidden">
            <header class="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div>
                <h2 class="text-[0.98rem] font-medium text-ink">待审清单</h2>
                {#if currentBook}
                  <p class="mt-1 text-sm text-[#7b6b59]">当前书籍：{currentBook.title || currentBook.name}</p>
                {/if}
              </div>
              <div class="flex items-center gap-3">
                <span class="chip border-[#b5cca8] bg-[#f2f9ed] text-[#648150]">已提取 {candidates.length} 条</span>
                <button class="btn-secondary px-3.5 py-2 text-sm font-medium" type="button" on:click={clearCurrentBookResults}>
                  清空当前书结果
                </button>
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
              <div class="text-sm text-[#6f604f]">待处理 {pendingCount} 条</div>
            </div>

            <div>
              {#if filteredCandidates.length}
                {#each filteredCandidates as candidate}
                  <QuoteCard
                    text={candidate.text}
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
                        onClick: () => setCandidateStatus(candidate.id, 'approved')
                      },
                      {
                        label: '弃',
                        onClick: () => setCandidateStatus(candidate.id, 'rejected')
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

            <footer class="flex flex-wrap gap-x-6 gap-y-2 bg-[#f5f1ea] px-4 py-3 text-[0.82rem] text-[#6f604f] sm:px-5">
              <span>本批 {candidates.length} 条</span>
              <span>待审 {pendingCount} 条</span>
              <span>收/弃后即从当前清单移除</span>
            </footer>
          </section>
        </div>
      {:else if activeTab === 'library'}
        <div class="px-4 py-4 sm:px-6 sm:py-5">
          <section class="soft-panel overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div class="min-w-0 flex-1 space-y-3">
                <div class="flex items-start gap-3 text-sm text-[#6f604f]">
                  <span class="w-12 shrink-0 pt-1">作者</span>
                  <div class="min-w-0 flex-1 flex items-start gap-2">
                    <div class="flex flex-wrap gap-2">
                      {#each visibleLibraryOptions(libraryAuthorOptions, authorFiltersExpanded) as option}
                        <button
                          type="button"
                          class:chip={true}
                          class:is-active={selectedLibraryAuthor === option.value}
                          aria-pressed={selectedLibraryAuthor === option.value}
                          on:click={() => selectLibraryAuthor(option.value)}
                        >
                          {option.label} {option.count}
                        </button>
                      {/each}
                    </div>
                    {#if libraryAuthorOptions.length > 8}
                      <button
                        type="button"
                        class="chip shrink-0"
                        aria-expanded={authorFiltersExpanded}
                        on:click={() => (authorFiltersExpanded = !authorFiltersExpanded)}
                      >
                        {authorFiltersExpanded ? '▲' : '▼'}
                      </button>
                    {/if}
                  </div>
                </div>
                <div class="flex items-start gap-3 text-sm text-[#6f604f]">
                  <span class="w-12 shrink-0 pt-1">心情</span>
                  <div class="min-w-0 flex-1 flex items-start gap-2">
                    <div class="flex flex-wrap gap-2">
                      {#each visibleLibraryOptions(libraryMoodOptions, moodFiltersExpanded) as option}
                        <button
                          type="button"
                          class:chip={true}
                          class:is-active={selectedLibraryMood === option.value}
                          aria-pressed={selectedLibraryMood === option.value}
                          on:click={() => selectLibraryMood(option.value)}
                        >
                          {option.label} {option.count}
                        </button>
                      {/each}
                    </div>
                    {#if libraryMoodOptions.length > 8}
                      <button
                        type="button"
                        class="chip shrink-0"
                        aria-expanded={moodFiltersExpanded}
                        on:click={() => (moodFiltersExpanded = !moodFiltersExpanded)}
                      >
                        {moodFiltersExpanded ? '▲' : '▼'}
                      </button>
                    {/if}
                  </div>
                </div>
                <div class="flex items-start gap-3 text-sm text-[#6f604f]">
                  <span class="w-12 shrink-0 pt-1">主题</span>
                  <div class="min-w-0 flex-1 flex items-start gap-2">
                    <div class="flex flex-wrap gap-2">
                      {#each visibleLibraryOptions(libraryThemeOptions, themeFiltersExpanded) as option}
                        <button
                          type="button"
                          class:chip={true}
                          class:is-active={selectedLibraryTheme === option.value}
                          aria-pressed={selectedLibraryTheme === option.value}
                          on:click={() => selectLibraryTheme(option.value)}
                        >
                          {option.label} {option.count}
                        </button>
                      {/each}
                    </div>
                    {#if libraryThemeOptions.length > 8}
                      <button
                        type="button"
                        class="chip shrink-0"
                        aria-expanded={themeFiltersExpanded}
                        on:click={() => (themeFiltersExpanded = !themeFiltersExpanded)}
                      >
                        {themeFiltersExpanded ? '▲' : '▼'}
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
              <div class="text-sm text-[#6f604f]">筛选结果 {filteredLibraryQuotes.length} 条</div>
            </div>

            <div>
              {#if filteredLibraryQuotes.length}
                {#each filteredLibraryQuotes as quote}
                  <QuoteCard
                    text={quote.text}
                    author={quote.author}
                    work={quote.work}
                    year={quote.year ?? null}
                    genre={quote.genre}
                    moods={quote.moods}
                    themes={quote.themes}
                    dot={quote.dot}
                    actions={[
                      {
                        label: '删除',
                        onClick: () => deleteLibraryQuote(quote.id),
                        tone: 'danger',
                        disabled: deletingLibraryQuoteIds.has(quote.id)
                      }
                    ]}
                  />
                {/each}
              {:else}
                <div class="px-4 py-12 text-center text-sm text-[#7b6b59] sm:px-5">
                  还没有已入库名句。
                </div>
              {/if}
            </div>
          </section>
        </div>
      {:else}
        <div class="px-4 py-4 sm:px-6 sm:py-5">
          <section class="soft-panel overflow-hidden">
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
                  还没有宜忌记录。
                </div>
              {/if}
            </div>
          </section>
        </div>
      {/if}
    </section>
  </div>
</div>
