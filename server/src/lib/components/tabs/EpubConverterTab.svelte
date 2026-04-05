<script lang="ts">
  import { notifyError, notifySuccess } from '$lib/notifications';

  type ConversionTask = {
    id: string;
    file: File;
    fileName: string;
    status: 'pending' | 'parsing' | 'ready' | 'error';
    progress: number; // 0-100
    error?: string;
    // 解析结果
    title: string;
    author: string;
    year: string;
    language: string;
    genre: string;
    content: string;
    // 统计
    chapterCount: number;
    filteredCount: number;
    totalWordCount: number;
  };

  let tasks = $state<ConversionTask[]>([]);
  let isProcessing = $state(false);
  let overallProgress = $state({ completed: 0, total: 0 });
  let editingTaskId = $state<string | null>(null);
  let editForm = $state({ title: '', author: '', year: '', language: 'zh', genre: '' });

  // 需要过滤的章节标题关键词
  const SKIP_KEYWORDS = [
    'contents', 'table of contents', '目录', '目次',
    'introduction', 'intro', '引言', '前言', 'preface', '序', '序言', '自序', '导言', '导读',
    'foreword', '推荐序', '译序', '原序', '再版序', '修订版序',
    'acknowledgments', 'acknowledgements', '致谢', '鸣谢', '感谢',
    'appendix', 'appendices', '附录', '附', '附言',
    'notes', 'footnotes', 'endnotes', '注释', '注解', '参考文献', 'bibliography', 'references',
    'index', '索引', '词汇表', 'glossary',
    'copyright', '版权', 'colophon', '出版说明', '关于本书', '关于作者', '作者简介',
    'dedication', '献词', '题词', 'epigraph'
  ];

  // 版权页特征文本（用于内容检测）
  const COPYRIGHT_PATTERNS = [
    // 图书在版编目相关
    '图书在版编目', 'CIP 数据', '中国版本图书馆', 'CIP 数据核字',
    // 出版信息
    '出版发行', '出版人', '责任编辑', '封面设计', '责任印制',
    '出版社', '出版集团', '出版公司',
    // ISBN/版权
    'ISBN', '版权所有', '侵权必究', '版权信息', '版权声明',
    // 印刷装订
    '印装', '版次', '印次', '定价', '开本', '印张', '字数',
    // 联系方式
    '微博', '微信公众号', '联系我们', '问题反馈', '合作电话', '联系电话', '邮箱', '@', '.com',
    // 数字出版
    'Digital Lab', '数字业务', '电子书', '数字版', '电子版',
    // 角色信息
    '译者', '主编', '策划', '审校', '校对', '排版', '美编'
  ];

  function generateId() {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    processFiles(files);
    input.value = '';
  }

  async function parsePendingTasks() {
    const pending = tasks.filter(t => t.status === 'pending');
    if (pending.length === 0) return;

    isProcessing = true;
    overallProgress = { completed: 0, total: pending.length };

    for (const task of pending) {
      tasks = tasks.map(t =>
        t.id === task.id ? { ...t, status: 'parsing', progress: 10 } : t
      );

      try {
        // 加载 JSZip
        const JSZip = await loadJSZip();
        tasks = tasks.map(t =>
          t.id === task.id ? { ...t, progress: 20 } : t
        );

        const result = await parseEpub(task.file, JSZip, (p) => {
          tasks = tasks.map(t =>
            t.id === task.id ? { ...t, progress: 20 + Math.floor(p * 0.7) } : t
          );
        });

        tasks = tasks.map(t =>
          t.id === task.id
            ? {
                ...t,
                status: 'ready',
                progress: 100,
                title: result.title,
                author: result.author,
                year: result.year,
                language: result.language,
                genre: result.genre,
                content: result.content,
                chapterCount: result.chapterCount,
                filteredCount: result.filteredCount,
                totalWordCount: result.totalWordCount
              }
            : t
        );

        overallProgress = { ...overallProgress, completed: overallProgress.completed + 1 };
      } catch (error) {
        tasks = tasks.map(t =>
          t.id === task.id
            ? {
                ...t,
                status: 'error',
                error: error instanceof Error ? error.message : '解析失败'
              }
            : t
        );
      }
    }

    isProcessing = false;
  }

  function shouldSkipChapter(chapterTitle: string, chapterContent: string): boolean {
    // 1. 检查章节标题
    const normalized = chapterTitle.toLowerCase().trim();
    if (SKIP_KEYWORDS.includes(normalized)) return true;
    for (const kw of SKIP_KEYWORDS) {
      if (normalized === kw) return true;
      if (normalized.startsWith(kw + ' ') || normalized.endsWith(' ' + kw)) return true;
      if (normalized.includes(`(${kw})`) || normalized.includes(`（${kw}）`)) return true;
      if (normalized.includes(`[${kw}]`) || normalized.includes(`【${kw}】`)) return true;
    }

    // 2. 检查章节内容（针对无标题的版权页、出版页等）
    // 只检查内容前 500 个字符，避免扫描整个章节
    const contentPreview = chapterContent.slice(0, 500);
    const copyrightScore = COPYRIGHT_PATTERNS.filter(pattern =>
      contentPreview.includes(pattern)
    ).length;
    // 如果包含 3 个或以上版权特征文本，认为是版权页
    if (copyrightScore >= 3) return true;

    return false;
  }

  async function parseEpub(
    file: File,
    JSZip: any,
    onProgress: (p: number) => void
  ): Promise<{
    title: string;
    author: string;
    year: string;
    language: string;
    genre: string;
    content: string;
    chapterCount: number;
    filteredCount: number;
    totalWordCount: number;
  }> {
    onProgress(0.1);
    const zip = await JSZip.loadAsync(file);
    onProgress(0.3);

    // 1. 找到 container.xml
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) {
      throw new Error('无效的 EPUB 文件：找不到 META-INF/container.xml');
    }
    onProgress(0.4);

    // 2. 解析 container.xml 找到 OPF 路径
    const opfPathMatch = containerXml.match(/full-path=["']([^"']+)["']/);
    if (!opfPathMatch) {
      throw new Error('无效的 EPUB 文件：无法解析 container.xml');
    }
    const opfPath = opfPathMatch[1];
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    onProgress(0.5);

    // 3. 读取并解析 OPF
    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) {
      throw new Error('无效的 EPUB 文件：无法读取 OPF 文件');
    }
    onProgress(0.6);

    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfContent, 'application/xml');

    // 提取元数据
    const titleEl = opfDoc.querySelector('dc\\:title, title');
    const authorEl = opfDoc.querySelector('dc\\:creator, creator');
    const dateEl = opfDoc.querySelector('dc\\:date, date');
    const languageEl = opfDoc.querySelector('dc\\:language, language');

    let year = '';
    if (dateEl?.textContent) {
      const yearMatch = dateEl.textContent.match(/\d{4}/);
      if (yearMatch) year = yearMatch[0];
    }

    let language = 'zh';
    if (languageEl?.textContent) {
      const lang = languageEl.textContent.trim().toLowerCase();
      if (lang.startsWith('zh')) language = 'zh';
      else if (lang.startsWith('en')) language = 'en';
      else language = 'translated';
    }

    // 4. 获取章节列表
    const spine = opfDoc.querySelector('spine');
    const itemrefs = spine?.querySelectorAll('itemref');
    if (!itemrefs?.length) {
      throw new Error('无效的 EPUB 文件：找不到章节列表');
    }
    onProgress(0.7);

    // 5. 构建 manifest
    const manifest = opfDoc.querySelector('manifest');
    const items = manifest?.querySelectorAll('item');
    const idToHref = new Map<string, { href: string }>();
    items?.forEach(item => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href) {
        idToHref.set(id, { href: opfDir + href });
      }
    });

    // 6. 尝试从 toc.ncx 获取章节标题
    const chapterTitles = new Map<string, string>();
    const ncxItem = manifest?.querySelector('item[media-type="application/x-dtbncx+xml"]');
    if (ncxItem) {
      const ncxHref = ncxItem.getAttribute('href');
      if (ncxHref) {
        const ncxContent = await zip.file(opfDir + ncxHref)?.async('string');
        if (ncxContent) {
          const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
          const navPoints = ncxDoc.querySelectorAll('navPoint, navpoint');
          navPoints.forEach(np => {
            const content = np.querySelector('content');
            const text = np.querySelector('text');
            const src = content?.getAttribute('src');
            if (src && text?.textContent) {
              const cleanSrc = src.split('#')[0];
              chapterTitles.set(cleanSrc, text.textContent.trim());
            }
          });
        }
      }
    }

    // 7. 读取章节
    const chapters: string[] = [];
    let filteredCount = 0;
    let processedCount = 0;

    for (const itemref of itemrefs) {
      processedCount++;
      const progress = 0.7 + (processedCount / itemrefs.length) * 0.3;
      onProgress(progress);

      const idref = itemref.getAttribute('idref');
      if (!idref) continue;

      const itemInfo = idToHref.get(idref);
      if (!itemInfo) continue;

      const chapterFile = zip.file(itemInfo.href);
      if (!chapterFile) continue;

      const chapterHtml = await chapterFile.async('string');
      const chapterTitle = chapterTitles.get(itemInfo.href) || '';

      // 先提取文本
      const chapterText = htmlToText(chapterHtml);
      if (!chapterText.trim()) continue;

      // 过滤非正文章节
      if (shouldSkipChapter(chapterTitle, chapterText)) {
        filteredCount++;
        continue;
      }

      chapters.push(chapterText);
    }

    // 8. 合并
    const content = chapters.join('\n\n');

    return {
      title: titleEl?.textContent?.trim() || '',
      author: authorEl?.textContent?.trim() || '',
      year,
      language,
      genre: '',
      content,
      chapterCount: chapters.length,
      filteredCount,
      totalWordCount: content.length
    };
  }

  async function loadJSZip(): Promise<any> {
    if (typeof window !== 'undefined' && (window as any).JSZip) {
      return (window as any).JSZip;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.onload = () => resolve((window as any).JSZip);
      script.onerror = () => reject(new Error('无法加载 JSZip 库'));
      document.head.appendChild(script);
    });
  }

  function htmlToText(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 移除脚本和样式
    doc.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());

    // 处理标题和段落
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      const text = el.textContent?.trim();
      if (text) el.textContent = '\n' + text + '\n';
    });
    doc.querySelectorAll('p, div').forEach(el => {
      const text = el.textContent?.trim();
      if (text && !text.startsWith('\n')) el.textContent = text + '\n';
    });
    doc.querySelectorAll('br').forEach(el => el.textContent = '\n');

    let text = doc.body?.textContent || '';

    // 清理
    text = text
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text;
  }

  // 生成带元数据头的 TXT
  function generateTxtContent(task: ConversionTask): string {
    const lines: string[] = [];

    if (task.title) lines.push(`title: ${task.title}`);
    if (task.author) lines.push(`author: ${task.author}`);
    if (task.year) lines.push(`year: ${task.year}`);
    if (task.language) lines.push(`language: ${task.language}`);
    if (task.genre) lines.push(`genre: ${task.genre}`);

    lines.push('---');
    lines.push('');
    lines.push(task.content);

    return lines.join('\n');
  }

  function downloadTask(task: ConversionTask) {
    if (!task.content) return;

    const content = generateTxtContent(task);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = task.fileName.replace(/\.epub$/i, '.txt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notifySuccess(`已下载：${a.download}`);
  }

  function downloadAllReady() {
    const ready = tasks.filter(t => t.status === 'ready');
    if (ready.length === 0) {
      notifyError('没有可下载的文件');
      return;
    }

    ready.forEach((task, index) => {
      setTimeout(() => downloadTask(task), index * 300);
    });

    notifySuccess(`开始下载 ${ready.length} 个文件`);
  }

  function removeTask(id: string) {
    tasks = tasks.filter(t => t.id !== id);
    if (editingTaskId === id) editingTaskId = null;
  }

  function clearCompleted() {
    tasks = tasks.filter(t => t.status !== 'ready');
  }

  function clearAll() {
    tasks = [];
    editingTaskId = null;
  }

  // 拖拽上传
  let isDragging = $state(false);

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    processFiles(files);
  }

  function processFiles(files: FileList) {
    const newTasks: ConversionTask[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.epub')) {
        notifyError(`跳过非 EPUB 文件：${file.name}`);
        continue;
      }
      newTasks.push({
        id: generateId(),
        file,
        fileName: file.name,
        status: 'pending',
        progress: 0,
        title: '',
        author: '',
        year: '',
        language: 'zh',
        genre: '',
        content: '',
        chapterCount: 0,
        filteredCount: 0,
        totalWordCount: 0
      });
    }

    if (newTasks.length > 0) {
      tasks = [...tasks, ...newTasks];
      parsePendingTasks();
    }
  }

  function startEdit(task: ConversionTask) {
    editingTaskId = task.id;
    editForm = {
      title: task.title,
      author: task.author,
      year: task.year,
      language: task.language,
      genre: task.genre
    };
  }

  function cancelEdit() {
    editingTaskId = null;
  }

  function saveEdit(taskId: string) {
    tasks = tasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            title: editForm.title,
            author: editForm.author,
            year: editForm.year,
            language: editForm.language,
            genre: editForm.genre
          }
        : t
    );
    editingTaskId = null;
    notifySuccess('已更新元数据');
  }

  // 状态统计
  const pendingCount = $derived(tasks.filter(t => t.status === 'pending').length);
  const parsingCount = $derived(tasks.filter(t => t.status === 'parsing').length);
  const readyCount = $derived(tasks.filter(t => t.status === 'ready').length);
  const errorCount = $derived(tasks.filter(t => t.status === 'error').length);
</script>

<div class="flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
  <div class="grid grid-cols-[420px_1fr] gap-4 flex-1 min-h-0 overflow-hidden">

    <!-- 左栏：文件列表 -->
    <section class="min-w-0 min-h-0 flex flex-col">
      <article class="soft-panel flex flex-col h-full overflow-hidden">
        <header class="border-b border-line px-4 py-3.5 sm:px-5 flex items-center justify-between">
          <h2 class="text-[0.95rem] font-medium text-ink">EPUB 文件</h2>
          <span class="text-xs text-muted">{tasks.length} 个</span>
        </header>

        <div role="region" aria-label="拖拽上传区域" class="flex-1 overflow-y-auto p-3 space-y-3" ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop}>
          {#if tasks.length === 0}
            <div class="text-center py-10 border-2 border-dashed rounded-xl transition-colors {isDragging ? 'border-primary bg-primary/5' : 'border-line'}">
              <p class="text-sm text-muted mb-2">拖拽或点击添加 EPUB 文件</p>
              <p class="text-xs text-muted">支持批量转换，自动提取元数据</p>
            </div>
          {:else}
            {#each tasks as task}
              <div class="p-2 space-y-1.5 {task.status === 'ready' ? '' : task.status === 'error' ? 'opacity-60' : ''}">
                <!-- 第一行：书名 + 操作图标 -->
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    {#if task.status === 'ready' && task.title}
                      <p class="text-sm font-medium text-ink truncate">《{task.title}》</p>
                    {:else if task.status === 'ready'}
                      <p class="text-sm font-medium text-ink truncate">（未识别书名）</p>
                    {:else if task.status === 'parsing'}
                      <p class="text-sm text-muted truncate">解析中 {task.progress}%</p>
                    {:else if task.status === 'error'}
                      <p class="text-sm text-red-600 truncate">解析失败</p>
                    {:else}
                      <p class="text-sm text-muted truncate">等待解析</p>
                    {/if}
                  </div>
                  <div class="flex items-center gap-1">
                    {#if task.status === 'ready'}
                      <button
                        class="p-1.5 text-muted hover:text-ink rounded"
                        onclick={() => downloadTask(task)}
                        title="下载 TXT"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                      </button>
                    {/if}
                    <button
                      class="p-1.5 text-muted hover:text-red-600 rounded"
                      onclick={() => removeTask(task.id)}
                      disabled={task.status === 'parsing'}
                      title="删除"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- 第二行：作者、年份、字数、章节 -->
                <div class="text-xs text-muted flex items-center gap-2">
                  {#if task.status === 'ready'}
                    <span>{task.author || '未知作者'}</span>
                    {#if task.year}<span>· {task.year}</span>{/if}
                    <span>· {task.totalWordCount.toLocaleString()} 字</span>
                    {#if task.filteredCount > 0}
                      <span>· {task.filteredCount} 章已过滤</span>
                    {/if}
                  {:else if task.status === 'parsing'}
                    <div class="flex-1 h-1 bg-canvas rounded-full overflow-hidden">
                      <div class="h-full bg-amber-500 transition-all" style="width: {task.progress}%"></div>
                    </div>
                  {:else if task.status === 'error'}
                    <span class="text-red-500">{task.error}</span>
                  {/if}
                </div>

                <!-- 编辑模式 -->
                {#if task.status === 'ready' && editingTaskId === task.id}
                  <div class="space-y-2 pt-2 border-t border-line mt-2">
                    <div class="grid grid-cols-2 gap-2">
                      <label class="space-y-1">
                        <span class="text-xs text-muted">书名</span>
                        <input type="text" class="field w-full px-2 py-1 text-sm" bind:value={editForm.title} />
                      </label>
                      <label class="space-y-1">
                        <span class="text-xs text-muted">作者</span>
                        <input type="text" class="field w-full px-2 py-1 text-sm" bind:value={editForm.author} />
                      </label>
                      <label class="space-y-1">
                        <span class="text-xs text-muted">年份</span>
                        <input type="text" class="field w-full px-2 py-1 text-sm" bind:value={editForm.year} />
                      </label>
                      <label class="space-y-1">
                        <span class="text-xs text-muted">语言</span>
                        <select class="field w-full px-2 py-1 text-sm" bind:value={editForm.language}>
                          <option value="zh">zh</option>
                          <option value="en">en</option>
                          <option value="translated">translated</option>
                        </select>
                      </label>
                    </div>
                    <div class="flex gap-2">
                      <button class="btn-primary text-xs px-3 py-1" onclick={() => saveEdit(task.id)}>保存</button>
                      <button class="btn-secondary text-xs px-3 py-1" onclick={cancelEdit}>取消</button>
                    </div>
                  </div>
                {:else if task.status === 'ready'}
                  <button class="text-xs text-muted hover:text-ink" onclick={() => startEdit(task)}>
                    编辑元数据
                  </button>
                {/if}
              </div>
            {/each}
          {/if}
        </div>

        <!-- 底部按钮 -->
        <div class="border-t border-line p-3 space-y-2">
          <div class="flex gap-2">
            <label class="btn-primary text-sm px-4 py-2 flex-1 text-center cursor-pointer">
              <input type="file" accept=".epub" multiple class="hidden" onchange={handleFileSelect} />
              添加 EPUB
            </label>
            {#if tasks.length > 0}
              <button class="btn-secondary text-sm px-3 py-2" onclick={clearCompleted} disabled={readyCount === 0}>
                清除完成
              </button>
              <button class="btn-secondary text-sm px-3 py-2 text-red-600" onclick={clearAll}>
                清空
              </button>
            {/if}
          </div>

          {#if readyCount > 0}
            <button class="btn-primary text-sm px-4 py-2 w-full flex items-center justify-center gap-2" onclick={downloadAllReady}>
              <span>全部下载 ({readyCount})</span>
            </button>
          {/if}
        </div>
      </article>
    </section>

    <!-- 右栏：总进度 + 内容预览 -->
    <section class="min-w-0 min-h-0 flex flex-col gap-4">

      <!-- 总进度 -->
      {#if isProcessing || overallProgress.completed > 0}
        <article class="soft-panel" style="flex: 0 0 auto;">
          <div class="p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-ink">转换进度</span>
              <span class="text-sm text-muted">
                {#if isProcessing}
                  处理中 {overallProgress.completed}/{overallProgress.total}
                {:else}
                  完成 {overallProgress.completed}/{overallProgress.total}
                {/if}
              </span>
            </div>
            <div class="h-2 bg-canvas rounded-full overflow-hidden">
              <div class="h-full bg-primary transition-all duration-300"
                style="width: {overallProgress.total > 0 ? (overallProgress.completed / overallProgress.total) * 100 : 0}%"
              ></div>
            </div>
          </div>
        </article>
      {/if}

      <!-- 内容预览 -->
      <article class="soft-panel flex flex-col flex-1 min-h-0">
        <header class="border-b border-line px-4 py-3 sm:px-5 flex items-center justify-between">
          <h2 class="text-[0.95rem] font-medium text-ink">内容预览</h2>
          {#if readyCount > 0}
            <span class="text-xs text-muted">{readyCount} 个文件可预览</span>
          {/if}
        </header>

        <div class="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {#if tasks.filter(t => t.status === 'ready').length === 0}
            <div class="text-center py-10">
              <p class="text-sm text-muted">解析完成后可在此预览内容</p>
              <p class="text-xs text-muted mt-2">自动过滤：目录、引言、序言、致谢、注释、附录等</p>
            </div>
          {:else}
            <div class="space-y-3">
              {#each tasks.filter(t => t.status === 'ready') as task}
                <details class="group border border-line rounded-lg overflow-hidden">
                  <summary class="cursor-pointer px-4 py-3 bg-canvas/50 hover:bg-canvas flex items-center justify-between select-none">
                    <div class="flex items-center gap-3">
                      <span class="text-xs text-muted transition-transform group-open:rotate-90">▶</span>
                      <div>
                        <span class="text-sm font-medium">{task.fileName}</span>
                        {#if task.title}
                          <span class="text-xs text-muted ml-2">《{task.title}》</span>
                        {/if}
                      </div>
                    </div>
                    <span class="text-xs text-muted">{task.totalWordCount.toLocaleString()} 字</span>
                  </summary>
                  <div class="px-4 py-3 border-t border-line">
                    <div class="bg-canvas/50 rounded p-3 space-y-2 mb-3">
                      <p class="text-xs font-mono text-muted">生成格式预览：</p>
                      <pre class="text-xs font-mono text-ink/70 whitespace-pre-wrap">{generateTxtContent(task).slice(0, 800)}...</pre>
                    </div>
                  </div>
                </details>
              {/each}
            </div>
          {/if}
        </div>
      </article>

    </section>
  </div>
</div>
