import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const PAPER_COLORS: Record<string, string> = {
  cotton: '#fdfbf7', cream: '#f8f4e8', bright: '#ffffff', kraft: '#d4c4a8',
  newsprint: '#f0ebe0', blush: '#fdf2f0', sage: '#e8ede5', sky: '#e8f1f8',
};

const COLOR_TO_PAPER: Record<string, string> = Object.fromEntries(
  Object.entries(PAPER_COLORS).map(([k, v]) => [v, k])
);

router.get('/:handle/:slug/:issueNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { handle, slug, issueNumber } = req.params;
    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum)) {
      return res.status(400).json({ error: { code: 'INVALID_ISSUE_NUMBER', message: 'Issue number must be a number' } });
    }
    const publisher = await prisma.publisher.findUnique({
      where: { handle },
      select: { id: true, handle: true, displayName: true },
    });
    if (!publisher) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Publisher not found' } });
    }
    const zine = await prisma.zine.findFirst({
      where: { publisherId: publisher.id, slug },
      select: { id: true, title: true, slug: true },
    });
    if (!zine) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Zine not found' } });
    }
    const issue = await prisma.issue.findFirst({
      where: { zineId: zine.id, issueNumber: issueNum, publishedAt: { not: null } },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: { blocks: { orderBy: { zIndex: 'asc' } } },
        },
      },
    });
    if (!issue) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Published issue not found' } });
    }
    const builderPages = issue.pages.map((page, index) => {
      const metadata = (page.metadata || {}) as { name?: string; section?: string; paper?: string; deckled?: boolean };
      return {
        id: `p${index + 1}`,
        name: metadata.name || (index === 0 ? 'Cover' : `Page ${index + 1}`),
        section: metadata.section || (index === 0 ? 'cover' : 'editorial'),
        paper: metadata.paper || COLOR_TO_PAPER[page.backgroundColor || '#ffffff'] || 'cotton',
        deckled: metadata.deckled || false,
        elements: page.blocks.map((block) => {
          const data = block.data as Record<string, unknown>;
          return {
            ...data,
            id: data.id || block.id,
            type: block.blockType,
            x: (block.positionX / 100) * 900,
            y: (block.positionY / 100) * 1200,
            w: (block.width / 100) * 900,
            h: (block.height / 100) * 1200,
            rotation: block.rotation,
            z: block.zIndex,
          };
        }),
      };
    });
    const builderState = {
      version: '13.1',
      project: { name: issue.title, description: '' },
      pages: builderPages.length > 0 ? builderPages : [],
      roles: {
        display: { f: 'Bebas Neue', s: 72 },
        header: { f: 'Playfair Display', s: 36 },
        subhead: { f: 'Work Sans', s: 18 },
        copy: { f: 'EB Garamond', s: 14 },
        caption: { f: 'Inter', s: 10 },
        scrawl: { f: 'Homemade Apple', s: 16 },
      },
    };
    res.json({
      issue: {
        id: issue.id, title: issue.title, issueNumber: issue.issueNumber,
        publishedAt: issue.publishedAt, pageCount: issue.pageCount, spreadCount: issue.spreadCount,
      },
      zine: { title: zine.title, slug: zine.slug },
      publisher: { handle: publisher.handle, displayName: publisher.displayName },
      builderState,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
