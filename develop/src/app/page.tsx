'use client';

import { useState, useEffect, useCallback } from 'react';

interface ModelConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai';
  apiBaseUrl?: string;
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  concurrency: number;
}

interface Book {
  id: string;
  file_name: string;
  title: string | null;
  author: string | null;
  year: number | null;
  language: string | null;
  genre: string | null;
  body_length: number;
}

interface ExtractionRun {
  id: string;
  book_id: string;
  status: string;
  total_chunks: number;
  processed_chunks: number;
  failed_chunks: number;
}

interface Candidate {
  id: string;
  text: string;
  source_chunk_index: number;
}

interface ReviewRun {
  id: string;
  extraction_run_id: string;
  mode: string;
  status: string;
  total_items: number;
  processed_items: number;
}

interface AiReviewedItem {
  id: string;
  candidate_id: string;
  text: string;
  ai_status: string;
  book_id: string;
  book_title: string | null;
}

type TabType = 'extract' | 'review' | 'manual' | 'models';

const MODELS_STORAGE_KEY = 'daily_oracle_models';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('extract');

  // 共享状态
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [currentRun, setCurrentRun] = useState<ExtractionRun | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // 模型配置列表
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);

  // 粗筛配置
  const [extractModelId, setExtractModelId] = useState<string>('');
  const [chunkSize, setChunkSize] = useState(4000);

  // 精筛相关
  const [reviewRun, setReviewRun] = useState<ReviewRun | null>(null);
  const [reviewMode, setReviewMode] = useState<'one-by-one' | 'chunk-by-chunk'>('one-by-one');
  const [reviewBatchSize, setReviewBatchSize] = useState(10);
  const [reviewModelId, setReviewModelId] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [pendingReview, setPendingReview] = useState<AiReviewedItem[]>([]);
  const [reviewedItems, setReviewedItems] = useState<AiReviewedItem[]>([]);

  // 编辑模型配置的状态
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);

  // 拖拽上传
  const [isDragging, setIsDragging] = useState(false);

  // 加载模型配置列表
  useEffect(() => {
    const stored = localStorage.getItem(MODELS_STORAGE_KEY);
    if (stored) {
      try {
        const configs: ModelConfig[] = JSON.parse(stored);
        setModelConfigs(configs);
        if (configs.length > 0) {
          setExtractModelId(configs[0].id);
          setReviewModelId(configs[0].id);
        }
      } catch (e) {
        console.error('Failed to load model configs:', e);
      }
    }
  }, []);

  // 保存模型配置列表
  const saveModelConfigs = (configs: ModelConfig[]) => {
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(configs));
    setModelConfigs(configs);
  };

  // 加载书籍列表
  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    const res = await fetch('/api/books');
    const data = await res.json();
    setBooks(data.books || []);
  };

  // 获取选中的模型配置
  const getModelConfig = (modelId: string): ModelConfig | undefined => {
    return modelConfigs.find(m => m.id === modelId);
  };

  // 监听选中的书籍
  useEffect(() => {
    if (!selectedBookId) {
      setCurrentRun(null);
      setCandidates([]);
      setReviewRun(null);
      setPendingReview([]);
      setReviewedItems([]);
      return;
    }

    if (activeTab === 'extract' || activeTab === 'review') {
      fetchExtractionProgress();
    }

    const interval = setInterval(() => {
      if (activeTab === 'extract') {
        fetchExtractionProgress();
      } else if (activeTab === 'review' && reviewRun?.status === 'running') {
        fetchReviewProgress();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedBookId, activeTab, reviewRun?.status]);

  const fetchExtractionProgress = useCallback(async () => {
    if (!selectedBookId) return;
    const res = await fetch(`/api/extract?bookId=${selectedBookId}`);
    const data = await res.json();
    setCurrentRun(data.run);
    setCandidates(data.candidates || []);
  }, [selectedBookId]);

  const fetchReviewProgress = useCallback(async () => {
    if (!reviewRun) return;
    const res = await fetch(`/api/review?runId=${reviewRun.id}`);
    const data = await res.json();
    setReviewRun(data.run);
    setPendingReview(data.pending || []);
    setReviewedItems(data.reviewed || []);
    setIsReviewing(data.run?.status === 'running');
  }, [reviewRun]);

  // 上传书籍（支持多文件）
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(f => f.name.endsWith('.txt'));
    if (validFiles.length === 0) {
      alert('请上传 .txt 文件');
      return;
    }

    if (validFiles.length !== files.length) {
      alert('部分文件被跳过（仅支持 .txt 文件）');
    }

    let uploadedCount = 0;
    let lastBookId = '';

    for (const file of validFiles) {
      const text = await file.text();
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, rawText: text })
      });

      if (res.ok) {
        uploadedCount++;
        const data = await res.json();
        lastBookId = data.book.id;
      } else {
        const data = await res.json();
        console.error(`上传 ${file.name} 失败:`, data.error);
      }
    }

    await fetchBooks();
    if (uploadedCount > 0) {
      alert(`成功上传 ${uploadedCount} 本书籍`);
      if (lastBookId) {
        setSelectedBookId(lastBookId);
      }
    }
  };

  // 拖拽上传
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // 启动粗筛
  const startExtraction = async () => {
    if (!selectedBookId) {
      alert('请先选择书籍');
      return;
    }

    const modelConfig = getModelConfig(extractModelId);
    if (!modelConfig) {
      alert('请选择模型配置');
      return;
    }

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: selectedBookId,
        config: {
          modelConfig,
          chunkSize,
          prompt: ''
        }
      })
    });

    if (res.ok) {
      fetchExtractionProgress();
    } else {
      const data = await res.json();
      alert(data.error || '启动提取失败');
    }
  };

  // 停止粗筛
  const stopExtraction = async () => {
    if (!currentRun) return;

    await fetch('/api/extract', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: currentRun.id })
    });

    fetchExtractionProgress();
  };

  // 启动精筛
  const startReview = async () => {
    if (!currentRun || currentRun.status !== 'completed') {
      alert('请先完成粗筛');
      return;
    }

    const modelConfig = getModelConfig(reviewModelId);
    if (!modelConfig) {
      alert('请选择模型配置');
      return;
    }

    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractionRunId: currentRun.id,
        config: {
          modelConfig,
          mode: reviewMode,
          batchSize: reviewBatchSize,
          prompt: ''
        }
      })
    });

    if (res.ok) {
      setIsReviewing(true);
      fetchReviewProgress();
    } else {
      const data = await res.json();
      alert(data.error || '启动精筛失败');
    }
  };

  // 停止精筛
  const stopReview = async () => {
    if (!reviewRun) return;

    await fetch('/api/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: reviewRun.id })
    });

    fetchReviewProgress();
  };

  // 人工审核
  const handleManualReview = async (aiReviewedId: string, status: 'approved' | 'rejected') => {
    const item = pendingReview.find(i => i.id === aiReviewedId);
    if (!item) return;

    const res = await fetch(`/api/candidates/${item.candidate_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (res.ok) {
      setPendingReview(prev => prev.filter(i => i.id !== aiReviewedId));
      setReviewedItems(prev => [...prev, { ...item, ai_status: status }]);
    } else {
      const data = await res.json();
      alert(data.error || '审核失败');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">每日一句工作台</h1>

        <div className="flex gap-2 mb-6">
          {(['extract', 'review', 'manual', 'models'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab === 'extract' ? '粗筛' : tab === 'review' ? 'AI 精筛' : tab === 'manual' ? '人工审核' : '模型配置'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：书籍和配置 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 书籍上传 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">书籍上传</h2>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <p className="text-sm text-gray-600 mb-2">拖拽文件到此处上传</p>
                <p className="text-xs text-gray-400 mb-4">支持多个 .txt 文件</p>
                <input
                  type="file"
                  accept=".txt"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            {/* 书籍列表 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">书籍列表 ({books.length})</h2>
              {books.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无书籍</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {books.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => setSelectedBookId(book.id)}
                      className={`w-full text-left p-3 rounded border transition-colors ${
                        selectedBookId === book.id
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium text-sm">{book.title || book.file_name}</div>
                      <div className="text-xs text-gray-500">
                        {book.author || '未知作者'} · {book.year || '未知年份'} · {book.body_length.toLocaleString()} 字
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 粗筛/精筛配置 */}
            {(activeTab === 'extract' || activeTab === 'review') && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {activeTab === 'extract' ? '粗筛配置' : '精筛配置'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">选择模型</label>
                    <select
                      value={activeTab === 'extract' ? extractModelId : reviewModelId}
                      onChange={(e) => activeTab === 'extract' ? setExtractModelId(e.target.value) : setReviewModelId(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="">请选择模型配置</option>
                      {modelConfigs.map((config) => (
                        <option key={config.id} value={config.id}>
                          {config.name} ({config.provider})
                        </option>
                      ))}
                    </select>
                    {modelConfigs.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        请先在「模型配置」标签页添加模型
                      </p>
                    )}
                  </div>
                  {activeTab === 'extract' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">分块大小</label>
                      <input
                        type="number"
                        min="500"
                        max="10000"
                        step="500"
                        value={chunkSize}
                        onChange={(e) => setChunkSize(parseInt(e.target.value))}
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  {activeTab === 'review' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">精筛模式</label>
                        <div className="flex gap-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              value="one-by-one"
                              checked={reviewMode === 'one-by-one'}
                              onChange={(e) => setReviewMode(e.target.value as 'one-by-one' | 'chunk-by-chunk')}
                              className="mr-2"
                            />
                            <span className="text-sm">逐条评审</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              value="chunk-by-chunk"
                              checked={reviewMode === 'chunk-by-chunk'}
                              onChange={(e) => setReviewMode(e.target.value as 'one-by-one' | 'chunk-by-chunk')}
                              className="mr-2"
                            />
                            <span className="text-sm">批量评审</span>
                          </label>
                        </div>
                      </div>
                      {reviewMode === 'chunk-by-chunk' && (
                        <div>
                          <label className="block text-sm font-medium mb-1">批量大小</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={reviewBatchSize}
                            onChange={(e) => setReviewBatchSize(parseInt(e.target.value))}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：功能区 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 粗筛 Tab */}
            {activeTab === 'extract' && (
              <>
                {/* 提取进度 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">粗筛进度</h2>
                  {!currentRun ? (
                    <p className="text-gray-500 text-sm">请先选择书籍并启动提取</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">状态</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          currentRun.status === 'completed' ? 'bg-green-100 text-green-800' :
                          currentRun.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          currentRun.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {currentRun.status === 'completed' ? '已完成' :
                           currentRun.status === 'running' ? '运行中' :
                           currentRun.status === 'error' ? '错误' :
                           currentRun.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">进度</span>
                        <span className="text-sm font-medium">
                          {currentRun.processed_chunks} / {currentRun.total_chunks} 块
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${currentRun.total_chunks > 0 ? (currentRun.processed_chunks / currentRun.total_chunks) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex gap-2">
                        {currentRun.status === 'running' ? (
                          <button
                            onClick={stopExtraction}
                            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          >
                            停止
                          </button>
                        ) : (
                          <button
                            onClick={startExtraction}
                            disabled={!selectedBookId || !extractModelId}
                            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            开始提取
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 候选列表 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    粗筛候选 ({candidates.length})
                  </h2>
                  {candidates.length === 0 ? (
                    <p className="text-gray-500 text-sm">暂无候选句子</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {candidates.map((candidate) => (
                        <div key={candidate.id} className="p-4 bg-gray-50 rounded border">
                          <p className="text-sm">{candidate.text}</p>
                          <p className="text-xs text-gray-500 mt-2">来源块: {candidate.source_chunk_index}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* AI 精筛 Tab */}
            {activeTab === 'review' && (
              <>
                {/* 精筛配置按钮 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <button
                    onClick={startReview}
                    disabled={!currentRun || currentRun.status !== 'completed' || !reviewModelId || isReviewing}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isReviewing ? '精筛运行中...' : '启动 AI 精筛'}
                  </button>
                </div>

                {/* 精筛进度 */}
                {reviewRun && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">精筛进度</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">状态</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          reviewRun.status === 'completed' ? 'bg-green-100 text-green-800' :
                          reviewRun.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {reviewRun.status === 'completed' ? '已完成' :
                           reviewRun.status === 'running' ? '运行中' :
                           reviewRun.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">进度</span>
                        <span className="text-sm font-medium">
                          {reviewRun.processed_items} / {reviewRun.total_items} 条
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${reviewRun.total_items > 0 ? (reviewRun.processed_items / reviewRun.total_items) * 100 : 0}%` }}
                        />
                      </div>
                      {reviewRun.status === 'running' && (
                        <button
                          onClick={stopReview}
                          className="w-full px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          停止精筛
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 精筛结果 */}
                {pendingReview.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">
                      AI 精筛结果 ({pendingReview.length})
                    </h2>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {pendingReview.map((item) => (
                        <div key={item.id} className="p-4 bg-gray-50 rounded border">
                          <p className="text-sm mb-2">{item.text}</p>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.ai_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              AI: {item.ai_status === 'approved' ? '收录' : '拒绝'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 人工审核 Tab */}
            {activeTab === 'manual' && (
              <>
                {/* 待审核列表 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    待审核 ({pendingReview.length})
                  </h2>
                  {pendingReview.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      {!reviewRun || reviewRun.status !== 'completed' ? '请先完成 AI 精筛' : '没有待审核的句子'}
                    </p>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                      {pendingReview.map((item) => (
                        <div key={item.id} className="p-4 bg-gray-50 rounded border">
                          <p className="text-sm mb-3">{item.text}</p>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.ai_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              AI: {item.ai_status === 'approved' ? '收录' : '拒绝'}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleManualReview(item.id, 'approved')}
                                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                              >
                                收录
                              </button>
                              <button
                                onClick={() => handleManualReview(item.id, 'rejected')}
                                className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                              >
                                拒绝
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 已审核列表 */}
                {reviewedItems.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">
                      已审核 ({reviewedItems.length})
                    </h2>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {reviewedItems.map((item) => (
                        <div key={item.id} className="p-4 bg-gray-50 rounded border">
                          <p className="text-sm mb-2">{item.text}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.ai_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                AI: {item.ai_status === 'approved' ? '收录' : '拒绝'}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.ai_status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                人工: {item.ai_status === 'approved' ? '收录' : '拒绝'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 模型配置 Tab */}
            {activeTab === 'models' && (
              <>
                {/* 添加/编辑模型 */}
                {editingModel ? (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">
                      {modelConfigs.find(m => m.id === editingModel.id) ? '编辑模型配置' : '添加模型配置'}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">配置名称</label>
                        <input
                          type="text"
                          value={editingModel.name}
                          onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="例如：Claude Sonnet 4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Provider</label>
                        <select
                          value={editingModel.provider}
                          onChange={(e) => setEditingModel({ ...editingModel, provider: e.target.value as 'anthropic' | 'openai' })}
                          className="w-full border rounded px-3 py-2 text-sm"
                        >
                          <option value="anthropic">Anthropic</option>
                          <option value="openai">OpenAI</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">API Key</label>
                        <input
                          type="password"
                          value={editingModel.apiKey}
                          onChange={(e) => setEditingModel({ ...editingModel, apiKey: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="输入 API Key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">API Base URL (可选)</label>
                        <input
                          type="text"
                          value={editingModel.apiBaseUrl || ''}
                          onChange={(e) => setEditingModel({ ...editingModel, apiBaseUrl: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="留空使用默认"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Model</label>
                        <input
                          type="text"
                          value={editingModel.model}
                          onChange={(e) => setEditingModel({ ...editingModel, model: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="claude-sonnet-4-20250514"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Temperature</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={editingModel.temperature}
                            onChange={(e) => setEditingModel({ ...editingModel, temperature: parseFloat(e.target.value) })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Top P</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={editingModel.topP}
                            onChange={(e) => setEditingModel({ ...editingModel, topP: parseFloat(e.target.value) })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">并发数</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={editingModel.concurrency}
                            onChange={(e) => setEditingModel({ ...editingModel, concurrency: parseInt(e.target.value) })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Max Tokens</label>
                          <input
                            type="number"
                            min="1"
                            value={editingModel.maxTokens}
                            onChange={(e) => setEditingModel({ ...editingModel, maxTokens: parseInt(e.target.value) })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!editingModel.name || !editingModel.apiKey || !editingModel.model) {
                              alert('请填写完整信息');
                              return;
                            }
                            const newConfig: ModelConfig = {
                              ...editingModel,
                              id: editingModel.id || `model-${Date.now()}`,
                            };
                            const existingIndex = modelConfigs.findIndex(m => m.id === newConfig.id);
                            const newConfigs = existingIndex >= 0
                              ? modelConfigs.map((m, i) => i === existingIndex ? newConfig : m)
                              : [...modelConfigs, newConfig];
                            saveModelConfigs(newConfigs);
                            setEditingModel(null);
                            if (!extractModelId && newConfigs.length > 0) {
                              setExtractModelId(newConfigs[0].id);
                              setReviewModelId(newConfigs[0].id);
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          {editingModel.id && modelConfigs.find(m => m.id === editingModel.id) ? '更新' : '添加'}
                        </button>
                        <button
                          onClick={() => setEditingModel(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow p-6">
                    <button
                      onClick={() => setEditingModel({
                        id: '',
                        name: '',
                        provider: 'anthropic',
                        apiKey: '',
                        model: 'claude-sonnet-4-20250514',
                        temperature: 0.3,
                        topP: 0.9,
                        maxTokens: 4096,
                        concurrency: 3
                      })}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <span>+ 添加新模型配置</span>
                    </button>
                  </div>
                )}

                {/* 已保存的模型配置列表 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">已保存的模型配置 ({modelConfigs.length})</h2>
                  {modelConfigs.length === 0 ? (
                    <p className="text-gray-500 text-sm">暂无模型配置</p>
                  ) : (
                    <div className="space-y-3">
                      {modelConfigs.map((config) => (
                        <div key={config.id} className="p-4 bg-gray-50 rounded border flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">{config.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {config.provider} · {config.model} · 并发 {config.concurrency}
                            </div>
                            {config.apiBaseUrl && (
                              <div className="text-xs text-gray-400">
                                Base URL: {config.apiBaseUrl}
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              Temp: {config.temperature} · Top P: {config.topP}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingModel({ ...config })}
                              className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`确定删除「${config.name}」吗？`)) {
                                  const newConfigs = modelConfigs.filter(m => m.id !== config.id);
                                  saveModelConfigs(newConfigs);
                                  if (extractModelId === config.id) {
                                    setExtractModelId(newConfigs[0]?.id || '');
                                  }
                                  if (reviewModelId === config.id) {
                                    setReviewModelId(newConfigs[0]?.id || '');
                                  }
                                }
                              }}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
