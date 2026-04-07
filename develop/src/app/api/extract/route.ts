import { NextRequest, NextResponse } from 'next/server';
import { startExtraction, getExtractionProgress } from '@/lib/extractor';
import type { ExtractProcessConfig } from '@/lib/types';

// POST /api/extract - 启动粗筛
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookId, config } = body;

    if (!bookId) {
      return NextResponse.json(
        { error: '缺少必要参数：bookId' },
        { status: 400 }
      );
    }

    if (!config) {
      return NextResponse.json(
        { error: '缺少必要参数：config' },
        { status: 400 }
      );
    }

    // 启动提取（后台运行）
    startExtraction({
      bookId,
      config: config as ExtractProcessConfig
    }).catch((error) => {
      console.error('Extraction failed:', error);
    });

    // 立即返回，让前端通过轮询获取进度
    return NextResponse.json({
      status: 'started',
      bookId,
      message: '提取已启动，请轮询进度接口'
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动提取失败' },
      { status: 500 }
    );
  }
}

// GET /api/extract?bookId=xxx&runId=xxx - 获取提取进度
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');
    const runId = searchParams.get('runId');

    if (runId) {
      // 根据 runId 获取进度
      const progress = getExtractionProgress(runId);
      return NextResponse.json({
        run: progress.run,
        candidates: progress.candidates
      });
    }

    if (bookId) {
      // 根据 bookId 获取最新的提取批次
      const runs = require('@/lib/db').getExtractionRunsByBookId(bookId);
      const latestRun = runs[0];

      if (!latestRun) {
        return NextResponse.json({
          run: null,
          candidates: []
        });
      }

      const progress = getExtractionProgress(latestRun.id);
      return NextResponse.json({
        run: progress.run,
        candidates: progress.candidates
      });
    }

    return NextResponse.json(
      { error: '缺少参数：bookId 或 runId' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取提取进度失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/extract - 停止提取
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json(
        { error: '缺少必要参数：runId' },
        { status: 400 }
      );
    }

    const { stopExtraction, getExtractionProgress } = await import('@/lib/extractor');
    stopExtraction(runId);

    const progress = getExtractionProgress(runId);
    return NextResponse.json({
      success: true,
      run: progress.run
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '停止提取失败' },
      { status: 500 }
    );
  }
}
