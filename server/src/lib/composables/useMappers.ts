/**
 * 数据映射工具 - 将 API 响应映射为组件状态
 */

export type BookFile = {
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

export type Candidate = {
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

export type LibraryQuote = {
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

export type AlmanacEntry = {
  id?: string;
  date: string;
  week: string;
  weather: string;
  temp: string;
  yi: string;
  ji: string;
};

export type AlmanacTodayCard = {
  dateLabel: string;
  archivedAt: string;
  signals: string[];
  yi: string;
  ji: string;
};

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function mapBookSummary(book: any): BookFile {
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

export function mapCandidate(item: any): Candidate {
  return {
    id: item.id,
    text: item.text,
    textCn: item.textCn ?? item.text_cn ?? null,
    why: item.why ?? null,
    location: item.location ?? null,
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

export function mapLibraryQuote(item: any): LibraryQuote {
  return {
    id: item.id,
    text: item.text,
    author: item.author || '未知作者',
    work: item.work || '未知作品',
    year: item.year ?? null,
    genre: item.genre || '未标注',
    moods: item.moods || [],
    themes: item.themes || [],
    dot: '#7d8f70'
  };
}

export function mapAlmanacEntry(item: any): AlmanacEntry {
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

export function mapAlmanacToday(item: any): AlmanacTodayCard {
  const signals = item.signals && typeof item.signals === 'object'
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
