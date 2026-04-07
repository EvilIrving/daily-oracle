import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import * as db from '@/lib/db';
import { parseTxtWithMeta, cleanText } from '@/lib/parser';

// GET /api/books - 获取书籍列表
export async function GET() {
  try {
    const books = db.getBooks();
    return NextResponse.json({ books });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取书籍列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/books - 上传书籍
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, rawText } = body;

    if (!fileName || !rawText) {
      return NextResponse.json(
        { error: '缺少必要参数：fileName 或 rawText' },
        { status: 400 }
      );
    }

    // 解析 txt 元数据
    const parsed = parseTxtWithMeta(rawText, fileName.replace(/\.txt$/i, ''));
    const cleanedBody = cleanText(parsed.body);

    // 创建书籍记录
    const bookId = randomUUID();
    const book: Omit<db.Book, 'created_at'> = {
      id: bookId,
      file_name: fileName,
      title: parsed.meta.title,
      author: parsed.meta.author,
      year: parsed.meta.year,
      language: parsed.meta.language,
      genre: parsed.meta.genre,
      body: cleanedBody
    };

    db.insertBook(book);

    return NextResponse.json({
      book: {
        id: book.id,
        file_name: book.file_name,
        title: book.title,
        author: book.author,
        year: book.year,
        language: book.language,
        genre: book.genre,
        body_length: cleanedBody.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传书籍失败' },
      { status: 500 }
    );
  }
}
