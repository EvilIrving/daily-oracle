import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// PATCH /api/candidates/[id] - 人工审核
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json(
        { error: '无效的 status，必须是 approved 或 rejected' },
        { status: 400 }
      );
    }

    // 获取对应的 ai_reviewed 记录
    const aiReviewed = db.getAiReviewedByCandidateId(id);
    if (!aiReviewed) {
      return NextResponse.json(
        { error: '该候选尚未经过 AI 精筛' },
        { status: 400 }
      );
    }

    // 提交人工审核结果
    const { submitHumanReview } = await import('@/lib/reviewer');
    submitHumanReview({
      aiReviewedId: aiReviewed.id,
      finalStatus: status
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交审核失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/candidates/[id] - 删除候选
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    db.deleteCandidate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除候选失败' },
      { status: 500 }
    );
  }
}
