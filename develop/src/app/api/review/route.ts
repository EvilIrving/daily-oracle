import { NextRequest, NextResponse } from 'next/server';
import { startReview, getReviewProgress } from '@/lib/reviewer';
import type { ReviewProcessConfig } from '@/lib/types';

// POST /api/review - 启动精筛
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { extractionRunId, config } = body;

    if (!extractionRunId) {
      return NextResponse.json(
        { error: '缺少必要参数：extractionRunId' },
        { status: 400 }
      );
    }

    if (!config) {
      return NextResponse.json(
        { error: '缺少必要参数：config' },
        { status: 400 }
      );
    }

    // 启动精筛（后台运行）
    startReview({
      extractionRunId,
      config: config as ReviewProcessConfig
    }).catch((error) => {
      console.error('Review failed:', error);
    });

    // 立即返回，让前端通过轮询获取进度
    return NextResponse.json({
      status: 'started',
      extractionRunId,
      message: '精筛已启动，请轮询进度接口'
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动精筛失败' },
      { status: 500 }
    );
  }
}

// GET /api/review?runId=xxx - 获取精筛进度
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        { error: '缺少参数：runId' },
        { status: 400 }
      );
    }

    const progress = getReviewProgress(runId);
    return NextResponse.json({
      run: progress.run,
      pending: progress.pending,
      reviewed: progress.reviewed
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取精筛进度失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/review - 停止精筛
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

    const { stopReview, getReviewProgress } = await import('@/lib/reviewer');
    stopReview(runId);

    const progress = getReviewProgress(runId);
    return NextResponse.json({
      success: true,
      run: progress.run
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '停止精筛失败' },
      { status: 500 }
    );
  }
}
