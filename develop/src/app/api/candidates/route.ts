import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/candidates?runId=xxx - 获取候选列表
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

    const candidates = db.getCandidatesByRunId(runId);
    return NextResponse.json({ candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取候选列表失败' },
      { status: 500 }
    );
  }
}
