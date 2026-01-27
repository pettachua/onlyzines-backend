"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateSpreads = regenerateSpreads;
// src/lib/spreads.ts
const prisma_1 = require("./prisma");
async function regenerateSpreads(issueId) {
    // Note: readingDirection stored on Issue but handled by reader at render time.
    // Spread generation uses logical page order regardless of reading direction.
    const pages = await prisma_1.prisma.page.findMany({
        where: { issueId },
        orderBy: { pageNumber: 'asc' },
        select: { id: true, pageNumber: true },
    });
    // Delete existing spreads
    await prisma_1.prisma.spread.deleteMany({ where: { issueId } });
    if (pages.length === 0) {
        await prisma_1.prisma.issue.update({
            where: { id: issueId },
            data: { pageCount: 0, spreadCount: 0 },
        });
        return;
    }
    // Generate spreads: first page alone (cover), then pairs
    const spreads = [];
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
        await prisma_1.prisma.spread.createMany({
            data: spreads.map((s) => ({
                issueId,
                ...s,
            })),
        });
    }
    // Update counts
    await prisma_1.prisma.issue.update({
        where: { id: issueId },
        data: {
            pageCount: pages.length,
            spreadCount: spreads.length,
        },
    });
}
//# sourceMappingURL=spreads.js.map