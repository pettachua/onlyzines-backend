// src/lib/spreads.ts
import { prisma } from './prisma';

export async function regenerateSpreads(issueId: string): Promise<void> {
  // Note: readingDirection stored on Issue but handled by reader at render time.
  // Spread generation uses logical page order regardless of reading direction.

  const pages = await prisma.page.findMany({
    where: { issueId },
    orderBy: { pageNumber: 'asc' },
    select: { id: true, pageNumber: true },
  });

  // Delete existing spreads
  await prisma.spread.deleteMany({ where: { issueId } });

  if (pages.length === 0) {
    await prisma.issue.update({
      where: { id: issueId },
      data: { pageCount: 0, spreadCount: 0 },
    });
    return;
  }

  // Generate spreads: first page alone (cover), then pairs
  const spreads: { spreadNumber: number; leftPageId: string | null; rightPageId: string | null }[] = [];

  // Cover spread (first page on the right)
  spreads.push({
    spreadNumber: 1,
    leftPageId: null,
    rightPageId: pages[0]?.id || null,
  });

  // Interior spreads (pairs)
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push({
      spreadNumber: spreads.length + 1,
      leftPageId: pages[i]?.id || null,
      rightPageId: pages[i + 1]?.id || null,
    });
  }

  // Create spreads
  if (spreads.length > 0) {
    await prisma.spread.createMany({
      data: spreads.map((s) => ({
        issueId,
        ...s,
      })),
    });
  }

  // Update counts
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      pageCount: pages.length,
      spreadCount: spreads.length,
    },
  });
}
