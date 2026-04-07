import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/books/[id] - 获取单本书籍详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = db.getBookById(id);

    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      book: {
        id: book.id,
        file_name: book.file_name,
        title: book.title,
        author: book.author,
        year: book.year,
        language: book.language,
        genre: book.genre,
        body_length: book.body.length,
        created_at: book.created_at
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取书籍详情失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/books/[id] - 删除书籍
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = db.getBookById(id);

    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 删除书籍（级联删除相关数据）
    db.deleteBook(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除书籍失败' },
      { status: 500 }
    );
  }
}
