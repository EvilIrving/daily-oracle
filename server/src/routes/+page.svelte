<script lang="ts">
  import { browser } from '$app/environment';
  import QuoteCard from '$lib/components/QuoteCard.svelte';
  import { notifyError, notifySuccess } from '$lib/notifications';
  import { deriveExtractionProgress, type ExtractionProgressSnapshot } from '$lib/extraction-progress';

  type MainTab = 'extract' | 'library' | 'almanac' | 'review-log';
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
  const DEFAULT_PROMPT = `你是一个文学语料库编辑，任务是从以下书籍文本中提取适合「每日名句」产品使用的候选句子。

## 产品背景

这些句子会出现在一个极简 iOS 小组件上，用户每天看一句，可以按心情筛选。目标是让用户读完之后产生「这说的是我」的感受。

## 入选标准

只保留同时满足以下所有条件的句子：

1. 长度：中文 15–60 字，英文 10–40 词
2. 脱离上下文仍然成立：非情节描写、场景或景物描写，不依赖上下文，具备独立完整性
3. 经验可代入：描述普遍但难以言说的处境或感受，不是奇异经历，不是历史事实，不是知识性陈述
4. 语言有密度：不能是口水话，需要具备文学性或哲思性
5. 开放性：给出张力但不完全解释张力；如果是结论句，必须是「读者没有语言表达过但一旦看到就认同」的那种

## 排除标准

以下一律排除：

- 情节推进句、对话接续句（离开上下文无意义）
- 纯知识性/历史性陈述
- 励志空话、鸡汤结论（「坚持就是胜利」类）
- 过于私人的专有名词导致无法代入

## 标签定义

moods（可选，可多选，按强度排序）：

- calm：静，不一定是好的静
- sad：失落、离别、错过
- anxious：悬而未决，等待，不安
- happy：轻盈，意外的好
- resilient：撑过去了，但有代价
- romantic：不一定是爱情，是某种柔软
- philosophical：看穿了什么，或者什么都没看穿
- angry：压着的，不是爆发

themes（可选，可多个，3-6 个语义主题词）：

- 该句涉及的核心主题，如：离别、雨、父子、时间、孤独、自然、爱情、故乡、成长、死亡、回忆
- 如适合特定季节，也包含季节词：春、夏、秋、冬
- 如与特定天气意境相关，也包含天气词：雨、雪、风、晴
- 不要填写抽象空泛的词如"人生"、"情感"，选择具体可触及的词

## 输出格式（必须严格遵守）

- 只输出一个合法的 JSON 数组，作为回复的全部内容；不要输出数组以外的任何字符（不要 Markdown、不要代码围栏、不要解释）。
- 数组元素为对象，字段：text（string）、moods（string[]）、themes（string[]），含义见上文「标签定义」。
- 本段没有合格句子时，输出：[]
- 示例（仅结构示意）：
[{"text":"……","moods":["sad"],"themes":["离别","秋"]},{"text":"……","moods":["calm"],"themes":["雨","等待"]}]`;
  const mainTabs: { id: MainTab; label: string }[] = [
    { id: 'extract', label: '提取' },
    { id: 'library', label: '名句库' },
    { id: 'almanac', label: '宜忌' },
    { id: 'review-log', label: '审核日志' }
  ];


  // Reactive state with $state runes
  let activeTab = $state<MainTab>('extract');
  let activeReviewFilter = $state<ReviewFilter>('all');
  let currentBookId = $state('');
  let currentRunId = $state('');
  let currentRunLabel = $state('--');
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
  let fileInput = $state.raw<HTMLInputElement | null>(null);
  let isUploadDragging = $state(false);
  let selectedFiles = $state<{
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
  }[]>([]);

  let config = $state(createEmptyConfig());
  let providerState = $state(createEmptyProviderState());
  let activeProviderId = $state(providerState.activeProviderId); 
  let configReady = $state(false);
  let promptExpanded = $state(false);

  let candidates = $state<Candidate[]>([]);
  let candidatesTotal = $state(0);
  let libraryQuotes = $state<LibraryQuote[]>([]);
     let selectedLibraryAuthor = $state('all');
  let selectedLibraryMood = $state('all');
  let selectedLibraryTheme = $state('all');
  let authorFiltersExpanded = $state(false);
  let moodFiltersExpanded = $state(false);
  let themeFiltersExpanded = $state(false); 
  let deletingLibraryQuoteIds = $state(new Set<string>());
  let almanacToday: AlmanacTodayCard | null = $state(createInitialAlmanacToday());
  let libraryStats = $state({
    totalCommitted: 0,
    pending: 0
  });

  let extractNotice = $state('等待导入 txt 文件');

  let almanacHistory = $state<AlmanacEntry[]>([]);

  type ReviewLogBook = {
    bookId: string;
    bookTitle: string | null;
    total: number;
    accepted: number;
    rejected: number;
    lastDecidedAt: string;
  };
  let reviewLogBooks = $state<ReviewLogBook[]>([]);
  let reviewLogLoading = $state(false);

  async function refreshReviewLog() {
    reviewLogLoading = true;
    try {
      const res = await fetch('/api/review-log');
      if (res.ok) reviewLogBooks = await res.json();
    } finally {
      reviewLogLoading = false;
    }
  }

  function exportReviewLog(bookId: string) {
    window.open(`/api/review-log?bookId=${encodeURIComponent(bookId)}`, '_blank');
  }

  let editDialogProvider: ProviderProfile | null = $state(null);
  let editDialogName = $state('');
  let editDialogConfig = $state(createEmptyConfig());

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
      bodyLength,
      status: book.status || 'idle'
    };
  }

  function getStatusDotColor(status: string): string {
    switch (status) {
      case 'idle':
        return '#a89880';
      case 'queued':
        return '#c4b090';
      case 'running':
        return '#d4a86a';
      case 'partial':
        return '#d4a040';
      case 'done':
        return '#a8c4a0';
      case 'error':
        return '#c09090';
      case 'stopped':
        return '#989080';
      default:
        return '#a89880';
    }
  }

  function upsertSelectedFile(file: ReturnType<typeof mapBookSummary>) {
    selectedFiles = [file, ...selectedFiles.filter((item) => item.id !== file.id)];
  }

  function createInitialAlmanacToday(): AlmanacTodayCard | null {
    return null;
  }

  function createEmptyConfig(): ExtractConfig {
    return {
      apiUrl: '',
      model: '',
      apiKey: '',
      chunkSize: 3000,
      concurrency: 1,
      temperature: 0.2,
      topP: 0.9,
      prompt: DEFAULT_PROMPT
    };
  }

  function createProviderState(baseConfig: ExtractConfig): ProviderConfigState {
    const newId = `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      activeProviderId: newId,
      providers: [{
        id: newId,
        name: `提供商 1`,
        config: normalizeConfig(baseConfig)
      }]
    };
  }

  function createEmptyProviderState(): ProviderConfigState {
    return {
      activeProviderId: '',
      providers: []
    };
  }

  function normalizeConfig(input: Partial<ExtractConfig> | null | undefined): ExtractConfig {
    const fallback = createEmptyConfig();
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
      prompt: String(next.prompt ?? fallback.prompt)
    };
  }

  function stripPromptFromConfig(input: Partial<ExtractConfig> | null | undefined): Partial<ExtractConfig> {
    if (!input) return {};
    const { prompt: _prompt, ...rest } = input;
    return rest;
  }

  function normalizeProviderState(
    input: Partial<ProviderConfigState> | null | undefined,
    baseConfig: ExtractConfig
  ): ProviderConfigState {
    const fallback = createProviderState(baseConfig);
    const rawProviders = Array.isArray(input?.providers) ? input?.providers : [];
    const providerMap = new Map<string, ProviderProfile>();

    for (const raw of rawProviders) {
      if (!raw || typeof raw !== 'object') continue;
      const id = String(raw.id || '').trim();
      if (!id) continue;
      providerMap.set(id, {
        id,
        name: String(raw.name || id),
        config: normalizeConfig(stripPromptFromConfig(raw.config))
      });
    }

    let providers: ProviderProfile[];
    if (providerMap.size > 0) {
      providers = Array.from(providerMap.values());
    } else {
      const newId = `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      providers = [{
        id: newId,
        name: `提供商 1`,
        config: normalizeConfig(stripPromptFromConfig(baseConfig))
      }];
    }

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

      const legacyConfig = normalizeConfig(stripPromptFromConfig(JSON.parse(legacyRaw)));
      return createProviderState(legacyConfig);
    } catch {
      return null;
    }
  }

  function persistLocalProviderState(nextState = providerState) {
    if (!browser) return;
    const persistedState: ProviderConfigState = {
      activeProviderId: nextState.activeProviderId,
      providers: nextState.providers.map((provider) => ({
        ...provider,
        config: normalizeConfig(stripPromptFromConfig(provider.config))
      }))
    };
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(persistedState));
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

  let currentBookDerived = $derived(getCurrentBook());

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
    candidatesTotal = candidates.length;

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
    await importBooks(files);
    input.value = '';
  }

  async function importBooks(files: File[]) {
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
    }
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

    await importBooks(files);
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

  function addProvider() {
    const newId = `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newProvider: ProviderProfile = {
      id: newId,
      name: `提供商 ${providerState.providers.length + 1}`,
      config: normalizeConfig(config)
    };
    providerState = {
      ...providerState,
      providers: [...providerState.providers, newProvider],
      activeProviderId: newId
    };
    activeProviderId = newId;
    hydrateConfigFromProvider(newId);
  }

  function removeProvider(providerId: string) {
    const remaining = providerState.providers.filter((p) => p.id !== providerId);
    if (remaining.length === 0) return;
    const newActive = providerId === activeProviderId ? remaining[0].id : activeProviderId;
    providerState = {
      providers: remaining,
      activeProviderId: newActive
    };
    activeProviderId = newActive;
    hydrateConfigFromProvider(newActive);
  }

  function openEditDialog(provider: ProviderProfile) {
    editDialogProvider = provider;
    editDialogName = provider.name;
    editDialogConfig = { ...provider.config };
  }

  function confirmEdit() {
    if (!editDialogProvider) return;
    const newConfig = normalizeConfig(editDialogConfig);
    providerState = {
      ...providerState,
      providers: providerState.providers.map((p) =>
        p.id === editDialogProvider!.id
          ? { ...p, name: editDialogName.trim() || p.name, config: newConfig }
          : p
      )
    };
    if (editDialogProvider.id === activeProviderId) {
      config = { ...newConfig, prompt: config.prompt };
    }
    editDialogProvider = null;
  }

  function cancelEdit() {
    editDialogProvider = null;
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
    candidatesTotal = 0;
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
    if (!config.apiUrl.trim() || !config.model.trim() || !config.apiKey.trim()) {
      notifyError('当前浏览器没有可用的提供商配置。');
      return;
    }

    try {
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
        body: JSON.stringify({
          bookId: book.id,
          config: {
            apiBaseUrl: config.apiUrl,
            apiKey: config.apiKey,
            model: config.model,
            chunkSize: Number(config.chunkSize),
            concurrency: Number(config.concurrency),
            temperature: Number(config.temperature),
            topP: Number(config.topP),
            promptTemplate: config.prompt
          }
        })
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

  let filteredCandidates = $derived(
    activeReviewFilter === 'all'
      ? candidates
      : candidates.filter((candidate) => candidate.status === activeReviewFilter)
  );
  let pendingCount = $derived(candidates.filter((candidate) => candidate.status === 'pending').length);
  let approvedCount = $derived(candidates.filter((c) => c.status === 'approved').length);
  let rejectedCount = $derived(candidates.filter((c) => c.status === 'rejected').length);
  let acceptanceRate = $derived(
    approvedCount + rejectedCount > 0
      ? Math.round((approvedCount / (approvedCount + rejectedCount)) * 100)
      : null
  );
  let extractionDensity = $derived(
    currentBookDerived?.bodyLength && currentBookDerived.bodyLength > 0 && candidatesTotal > 0
      ? (candidatesTotal / (currentBookDerived.bodyLength / 10000)).toFixed(1)
      : null
  );
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

  $effect(() => {
    if (selectedLibraryAuthor !== 'all' && !libraryAuthorOptionsDerived.some((option) => option.value === selectedLibraryAuthor)) {
      selectedLibraryAuthor = 'all';
    }
  });

  $effect(() => {
    if (selectedLibraryMood !== 'all' && !libraryMoodOptionsDerived.some((option) => option.value === selectedLibraryMood)) {
      selectedLibraryMood = 'all';
    }
  });

  $effect(() => {
    if (selectedLibraryTheme !== 'all' && !libraryThemeOptionsDerived.some((option) => option.value === selectedLibraryTheme)) {
      selectedLibraryTheme = 'all';
    }
  });

  let filteredLibraryQuotesDerived = $derived(
    applyLibraryFilters(
      libraryQuotes,
      selectedLibraryAuthor,
      selectedLibraryMood,
      selectedLibraryTheme
    )
  );

  let extractionProgress = $derived(
    deriveExtractionProgress({
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
    })
  );

  let activeProviderDerived = $derived(getProviderById(providerState, activeProviderId));

  $effect(() => {
    if (configReady) {
      const nextState: ProviderConfigState = {
        ...providerState,
        activeProviderId,
        providers: providerState.providers.map((provider) =>
          provider.id === activeProviderId ? { ...provider, config: normalizeConfig(config) } : provider
        )
      };
      persistLocalProviderState(nextState);
    }
  });

  $effect(() => {
    let cancelled = false;

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
            extractNotice = `已恢复 ${selectedFiles.length} 本本地解析记录`;
            if (currentBookId) {
              await refreshExtraction(currentBookId);
            }
          }
        }

        await Promise.all([refreshLibrary(), refreshAlmanac(), refreshReviewLog()]);
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
            <button class:tab-trigger={true} class:is-active={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>
              {tab.label}
            </button>
          {/each}
        </nav>
      </header>

      {#if activeTab === 'extract'}
        <div class="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          <section>
            <article class="soft-panel overflow-hidden">
              <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded4c7] px-4 py-3.5 sm:px-5">
                <h2 class="text-[0.98rem] font-medium text-ink">提取</h2>
                <div class="flex flex-wrap items-center gap-2">
                  {#each providerState.providers as provider}
                    <div class="group relative">
                      <button
                        class="chip cursor-pointer transition-all"
                        class:is-active={provider.id === activeProviderId}
                        onclick={() => switchProvider(provider.id)}
                        ondblclick={() => openEditDialog(provider)}
                        type="button"
                      >
                        {provider.name}
                      </button>
                      <button
                        class="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#c4b0a0] text-[9px] text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-[#a08070]"
                        class:hidden={providerState.providers.length <= 1}
                        onclick={() => removeProvider(provider.id)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                  <button
                    class="chip cursor-pointer border-dashed transition-all hover:border-[#c4b0a0] hover:bg-[#faf5ee]"
                    onclick={addProvider}
                    type="button"
                  >
                    + 新增
                  </button>
                </div>
              </header>

              {#if editDialogProvider}
                <div
                  class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
                  onclick={(event) => {
                    if (event.target === event.currentTarget) cancelEdit();
                  }}
                  onkeydown={(e) => e.key === 'Escape' && cancelEdit()}
                  role="dialog"
                  aria-modal="true"
                  tabindex="-1"
                >
                  <div class="soft-panel w-[420px] max-h-[90vh] overflow-y-auto p-5" onclick={(event) => event.stopPropagation()}>
                    <p class="mb-4 text-sm font-medium text-ink">编辑提供商</p>
                    <div class="space-y-3">
                      <label class="block">
                        <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">名称</span>
                        <input class="field w-full px-3 py-2 text-sm" bind:value={editDialogName} onkeydown={(e) => { if (e.key === 'Escape') cancelEdit(); }} />
                      </label>
                      <label class="block">
                        <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API URL</span>
                        <input class="field w-full px-3 py-2 text-sm" bind:value={editDialogConfig.apiUrl} />
                      </label>
                      <div class="grid grid-cols-2 gap-3">
                        <label class="block">
                          <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">模型</span>
                          <input class="field w-full px-3 py-2 text-sm" bind:value={editDialogConfig.model} />
                        </label>
                        <label class="block">
                          <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">并发数</span>
                          <input class="field w-full px-3 py-2 text-sm" type="number" min="1" max="10" step="1" bind:value={editDialogConfig.concurrency} />
                        </label>
                      </div>
                      <label class="block">
                        <span class="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[#85715d]">API KEY</span>
                        <input class="field w-full px-3 py-2 text-sm font-mono" type="password" bind:value={editDialogConfig.apiKey} />
                      </label>
                      <div class="grid grid-cols-2 gap-3">
                        <label class="block">
                          <div class="mb-1 flex items-center justify-between text-[11px] text-[#6f604f]">
                            <span class="uppercase tracking-[0.12em]">Temperature</span>
                            <span>{Number(editDialogConfig.temperature).toFixed(1)}</span>
                          </div>
                          <input class="w-full accent-[#b59067]" type="range" min="0" max="1" step="0.1" bind:value={editDialogConfig.temperature} />
                        </label>
                        <label class="block">
                          <div class="mb-1 flex items-center justify-between text-[11px] text-[#6f604f]">
                            <span class="uppercase tracking-[0.12em]">Top P</span>
                            <span>{Number(editDialogConfig.topP).toFixed(2)}</span>
                          </div>
                          <input class="w-full accent-[#b59067]" type="range" min="0" max="1" step="0.01" bind:value={editDialogConfig.topP} />
                        </label>
                      </div>
                      <label class="block">
                        <div class="mb-1 flex items-center justify-between text-[11px] text-[#6f604f]">
                          <span class="uppercase tracking-[0.12em]">切片</span>
                          <span>{editDialogConfig.chunkSize}</span>
                        </div>
                        <input class="w-full accent-[#b59067]" type="range" min="1000" max="6000" step="500" bind:value={editDialogConfig.chunkSize} />
                      </label>
                    </div>
                    <div class="mt-5 flex justify-end gap-2">
                      <button class="btn-secondary px-4 py-2 text-sm" onclick={cancelEdit} type="button">取消</button>
                      <button class="btn-primary px-4 py-2 text-sm" onclick={confirmEdit} type="button">保存</button>
                    </div>
                  </div>
                </div>
              {/if}

              <div class="space-y-4 p-4 sm:p-5">
                <div>
                  <button
                    class="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[#85715d] transition hover:text-[#5f4e3b]"
                    type="button"
                    onclick={() => (promptExpanded = !promptExpanded)}
                  >
                    <span class="inline-block transition-transform duration-150" class:rotate-90={promptExpanded}>▶</span>
                    Prompt
                  </button>
                  {#if promptExpanded}
                    <textarea
                      class="field mt-2 min-h-[200px] w-full resize-none overflow-y-auto px-4 py-3 text-sm leading-7 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      bind:value={config.prompt}
                    ></textarea>
                  {/if}
                </div>

                <div
                  class={`rounded-[18px] border border-dashed transition ${
                    isUploadDragging ? 'border-[#b59067] bg-[#fff7eb]' : 'border-[#d4c7b8] bg-[#fffdf8]'
                  }`}
                  role="group"
                  aria-label="TXT 文件上传区"
                  ondragenter={handleUploadDragEnter}
                  ondragover={handleUploadDragOver}
                  ondragleave={handleUploadDragLeave}
                  ondrop={handleUploadDrop}
                >
                  <input
                    bind:this={fileInput}
                    class="hidden"
                    type="file"
                    multiple
                    accept=".txt,text/plain"
                    onchange={handleFileChange}
                  />
                  <button
                    class="w-full px-4 py-6 text-center"
                    type="button"
                    onclick={openFileInput}
                  >
                    <p class="text-sm text-[#7a6a58]">拖入或点击选择</p>
                    <p class="mt-1.5 text-xs text-[#8b7a67]">仅在当前设备解析，不上传到服务器</p>
                    <span class="btn-secondary mt-3 inline-flex cursor-pointer px-5 py-2 text-base font-medium">
                      选择 txt 文件
                    </span>
                  </button>
                </div>

                {#if selectedFiles.length > 0}
                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {#each selectedFiles as file}
                      <div class="group relative">
                        <button
                          class={`flex w-full items-center justify-between rounded-[14px] px-3 py-2 pr-10 text-left text-sm ${currentBookId === file.id ? 'bg-[#eadfce]' : 'bg-[#f6f2eb]'}`}
                          type="button"
                          onclick={async () => {
                            currentBookId = file.id || '';
                            if (currentBookId) {
                              await refreshExtraction(currentBookId);
                            }
                          }}
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
                          onclick={() => deleteBook(file.id || '')}
                        >
                          ×
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}

                <div class="space-y-3 rounded-[18px] bg-[#fbf7f0] px-4 py-3">
                  <div class="flex items-center justify-between gap-3">
                    {#if extractStatus === 'DONE'}
                      <span class="chip border-[#a8c4a0] bg-[#eaf3e5] text-[#5a7a4a]">{extractStatus}</span>
                    {:else if extractStatus === 'RUNNING' || extractStatus === 'QUEUED'}
                      <span class="chip border-[#d4b896] bg-[#faf3e8] text-[#9c6a38]">{extractStatus}</span>
                    {:else if extractStatus === 'ERROR'}
                      <span class="chip border-[#c4a0a0] bg-[#f5eaea] text-[#8a4a4a]">{extractStatus}</span>
                    {:else if extractStatus === 'STOPPED' || extractStatus === 'PARTIAL'}
                      <span class="chip border-[#d4c4a0] bg-[#f5f0e0] text-[#8a7a3a]">{extractStatus}</span>
                    {:else}
                      <span class="chip border-[#d9c7b1] bg-[#fffaf2] text-[#7a6a58]">{extractStatus}</span>
                    {/if}
                    <span class="text-sm font-medium text-[#6a5a48]">
                      {extractionProgress.processedChunks}<span class="font-normal text-[#a09080]">/{extractionProgress.totalChunks}</span>
                    </span>
                    {#if extractionProgress.failedChunks > 0}
                      <span class="text-sm text-[#a05050]">{extractionProgress.failedChunks} 失败</span>
                    {/if}
                  </div>
                  <div class="h-2 rounded-full bg-[#ece4da]">
                    {#if extractStatus === 'DONE'}
                      <div class="h-2 rounded-full bg-[#a8c4a0] transition-all duration-500" style={`width:${extractionProgress.progressPercent}%`}></div>
                    {:else if extractStatus === 'ERROR'}
                      <div class="h-2 rounded-full bg-[#c09090] transition-all duration-300" style={`width:${extractionProgress.progressPercent}%`}></div>
                    {:else if extractStatus === 'RUNNING' || extractStatus === 'QUEUED'}
                      <div class="h-2 rounded-full bg-[#d4a86a] transition-all duration-300" style={`width:${extractionProgress.progressPercent}%`}></div>
                    {:else}
                      <div class="h-2 rounded-full bg-[#c4b090] transition-all duration-300" style={`width:${extractionProgress.progressPercent}%`}></div>
                    {/if}
                  </div>
                </div>
                {#if extractionProgress.isRunning}
                  <button
                    class="btn-secondary w-full py-3 text-base font-medium text-[#9c5a55] disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={stopRequestPending}
                    onclick={stopExtraction}
                  >
                    {extractionProgress.actionLabel}
                  </button>
                {:else}
                  <button class="btn-primary w-full py-3 text-base font-medium" type="button" onclick={startExtraction}>
                    {extractionProgress.actionLabel}
                  </button>
                {/if}
              </div>
            </article>
          </section>

          <section class="soft-panel overflow-hidden">
            <header class="border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 class="text-[0.98rem] font-medium text-ink">待审清单</h2>
                  {#if currentBookDerived}
                    <p class="mt-1 text-sm text-[#7b6b59]">
                      <span>当前书籍：{currentBookDerived?.title || currentBookDerived?.name}</span>
                      <span class="text-[#6f604f]"> · 待处理 {pendingCount} / {candidatesTotal}</span>
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
                    <span class="text-sm text-[#6f604f]">待处理 {pendingCount} / {candidatesTotal}</span>
                  {/if}
                  <button class="btn-secondary px-3.5 py-2 text-sm font-medium" type="button" onclick={clearCurrentBookResults}>
                    清空当前书结果
                  </button>
                </div>
              </div>
            </header>

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
          </section>
        </div>
      {:else if activeTab === 'library'}
        <div class="px-4 py-4 sm:px-6 sm:py-5">
          <section class="soft-panel overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded4c7] px-4 py-4 sm:px-5">
              <div class="min-w-0 flex-1 space-y-3">
                <div class="flex items-start gap-3 text-sm text-[#6f604f]">
                  <span class="w-12 shrink-0 pt-1">作者</span>
                  <div class="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                    {#each visibleLibraryOptions(libraryAuthorOptionsDerived, authorFiltersExpanded) as option}
                      <button
                        type="button"
                        class:chip={true}
                        class:is-active={selectedLibraryAuthor === option.value}
                        aria-pressed={selectedLibraryAuthor === option.value}
                        onclick={() => selectLibraryAuthor(option.value)}
                      >
                        {option.label} {option.count}
                      </button>
                    {/each}
                    {#if libraryAuthorOptionsDerived.length > 8}
                      <button
                        type="button"
                        class="chip"
                        aria-expanded={authorFiltersExpanded}
                        onclick={() => (authorFiltersExpanded = !authorFiltersExpanded)}
                      >
                        {authorFiltersExpanded ? '收起' : `... ${libraryAuthorOptionsDerived.length - 8}`}
                      </button>
                    {/if}
                  </div>
                </div>
                <div class="flex items-start gap-3 text-sm text-[#6f604f]">
                  <span class="w-12 shrink-0 pt-1">心情</span>
                  <div class="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                    {#each visibleLibraryOptions(libraryMoodOptionsDerived, moodFiltersExpanded) as option}
                      <button
                        type="button"
                        class:chip={true}
                        class:is-active={selectedLibraryMood === option.value}
                        aria-pressed={selectedLibraryMood === option.value}
                        onclick={() => selectLibraryMood(option.value)}
                      >
                        {option.label} {option.count}
                      </button>
                    {/each}
                    {#if libraryMoodOptionsDerived.length > 8}
                      <button
                        type="button"
                        class="chip"
                        aria-expanded={moodFiltersExpanded}
                        onclick={() => (moodFiltersExpanded = !moodFiltersExpanded)}
                      >
                        {moodFiltersExpanded ? '收起' : `... ${libraryMoodOptionsDerived.length - 8}`}
                      </button>
                    {/if}
                  </div>
                </div>
                <div class="flex items-start gap-3 text-sm text-[#6f604f]">
                  <span class="w-12 shrink-0 pt-1">主题</span>
                  <div class="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                    {#each visibleLibraryOptions(libraryThemeOptionsDerived, themeFiltersExpanded) as option}
                      <button
                        type="button"
                        class:chip={true}
                        class:is-active={selectedLibraryTheme === option.value}
                        aria-pressed={selectedLibraryTheme === option.value}
                        onclick={() => selectLibraryTheme(option.value)}
                      >
                        {option.label} {option.count}
                      </button>
                    {/each}
                    {#if libraryThemeOptionsDerived.length > 8}
                      <button
                        type="button"
                        class="chip"
                        aria-expanded={themeFiltersExpanded}
                        onclick={() => (themeFiltersExpanded = !themeFiltersExpanded)}
                      >
                        {themeFiltersExpanded ? '收起' : `... ${libraryThemeOptionsDerived.length - 8}`}
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
              <div class="text-sm text-[#6f604f]">筛选结果 {filteredLibraryQuotesDerived.length} 条</div>
            </div>

            <div>
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
      {:else if activeTab === 'almanac'}
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
      {:else if activeTab === 'review-log'}
        <div class="px-4 py-4 sm:px-6 sm:py-5">
          <section class="soft-panel overflow-hidden">
            <header class="flex items-center justify-between border-b border-[#ded4c7] px-4 py-3.5 sm:px-5">
              <h2 class="text-[0.98rem] font-medium text-ink">审核日志</h2>
              <button class="btn btn-ghost text-xs" onclick={() => refreshReviewLog()}>
                刷新
              </button>
            </header>
            <div>
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
                    <button class="btn btn-outline text-xs" onclick={() => exportReviewLog(book.bookId)}>
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
      {/if}
    </section>
  </div>
</div>
