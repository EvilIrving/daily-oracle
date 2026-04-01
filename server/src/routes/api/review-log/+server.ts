import { json } from '@sveltejs/kit';
import { createDb, listReviewLogBooks, getReviewLogByBookId } from '$lib/server/db';

export function GET({ url }) {
  const db = createDb();
  const bookId = url.searchParams.get('bookId');

  if (bookId) {
    const rows = getReviewLogByBookId(db, bookId);
    const entries = rows.map((r) => ({
      candidateId: r.candidate_id,
      bookId: r.book_id,
      bookTitle: r.book_title,
      text: r.text,
      lang: r.lang,
      author: r.author,
      work: r.work,
      year: r.year,
      genre: r.genre,
      moods: r.moods_json ? JSON.parse(r.moods_json) : [],
      themes: r.themes_json ? JSON.parse(r.themes_json) : [],
      chunkIndex: r.chunk_index,
      decision: r.decision,
      decidedAt: r.decided_at,
      candidateCreatedAt: r.created_at
    }));

    return new Response(JSON.stringify(entries, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="review-log-${bookId}.json"`
      }
    });
  }

  const books = listReviewLogBooks(db);
  return json(
    books.map((b) => ({
      bookId: b.book_id,
      bookTitle: b.book_title,
      total: b.total,
      accepted: b.accepted,
      rejected: b.rejected,
      lastDecidedAt: b.last_decided_at
    }))
  );
}
