import { Router, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/errors';

import {
  extractAuth,
  requireAuth,
  AuthenticatedRequest,
  getAuthUser,
} from '../lib/auth/middleware';

import { regenerateSpreads } from '../lib/spreads';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const router = Router();

router.use(extractAuth);
router.use(requireAuth);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreatePublisherSchema = z.object({
  handle: z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/i, 'Handle must be URL-safe'),
  displayName: z.string().min(1).max(100),
});

const CreateZineSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i, 'Slug must be URL-safe').optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PASSWORD']).default('UNLISTED'),
  password: z.string().min(4).optional(),
});

const CreateIssueSchema = z.object({
  title: z.string().min(1).max(200),
  issueNumber: z.number().int().positive().optional(),
});

const BuilderPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  section: z.string().optional(),
  paper: z.string().optional(),
  deckled: z.boolean().optional(),
  elements: z.array(z.unknown()),
});

const BuilderStateSchema = z.object({
  version: z.string(),
  project: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  pages: z.array(BuilderPageSchema),
  roles: z.record(z.unknown()).optional(),
});

const SaveIssueSchema = z.object({
  builderState: BuilderStateSchema,
});

// ============================================================================
// HELPERS
// ============================================================================

async function getPublisher(userId: string) {
  return prisma.publisher.findUnique({ where: { userId } });
}

async function requirePublisher(req: AuthenticatedRequest) {
  const user = getAuthUser(req);
  if (!user) throw Errors.Unauthorized();

  const publisher = await getPublisher(user.userId);
  if (!publisher) {
    throw Errors.Forbidden('You need to create a publisher account first');
  }

  return publisher;
}

async function requireZineOwnership(publisherId: string, zineId: string) {
  const zine = await prisma.zine.findUnique({
    where: { id: zineId },
    select: { id: true, publisherId: true },
  });

  if (!zine) throw Errors.NotFound('Zine');
  if (zine.publisherId !== publisherId) {
    throw Errors.Forbidden('You do not own this zine');
  }

  return zine;
}

async function requireIssueOwnership(publisherId: string, issueId: string) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { zine: { select: { publisherId: true } } },
  });

  if (!issue) throw Errors.NotFound('Issue');
  if (issue.zine.publisherId !== publisherId) {
    throw Errors.Forbidden('You do not own this issue');
  }

  return issue;
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100) || 'untitled';
}

const PAPER_COLORS: Record<string, string> = {
  cotton: '#fdfbf7',
  cream: '#f8f4e8',
  bright: '#ffffff',
  kraft: '#d4c4a8',
  newsprint: '#f0ebe0',
  blush: '#fdf2f0',
  sage: '#e8ede5',
  sky: '#e8f1f8',
};

const COLOR_TO_PAPER: Record<string, string> = Object.fromEntries(
  Object.entries(PAPER_COLORS).map(([k, v]) => [v, k])
);

// ============================================================================
// PUBLISHER ACCOUNT
// ============================================================================

router.get('/account', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = getAuthUser(req);
    if (!user) throw Errors.Unauthorized();

    const publisher = await prisma.publisher.findUnique({
      where: { userId: user.userId },
      include: {
        zines: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            slug: true,
            title: true,
            coverImageUrl: true,
            visibility: true,
            issueCount: true,
            updatedAt: true,
          },
        },
      },
    });

    res.json({ publisher });
  } catch (error) {
    next(error);
  }
});

router.post('/account', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = getAuthUser(req);
    if (!user) throw Errors.Unauthorized();

    const existing = await prisma.publisher.findUnique({ where: { userId: user.userId } });

    if (existing) {
      return res.status(409).json({
        error: { code: 'ALREADY_EXISTS', message: 'You already have a publisher account' },
        publisher: existing,
      });
    }

    const data = CreatePublisherSchema.parse(req.body);

    const handleTaken = await prisma.publisher.findUnique({
      where: { handle: data.handle.toLowerCase() },
    });

    if (handleTaken) {
      return res.status(409).json({
        error: { code: 'HANDLE_TAKEN', message: 'This handle is already taken' },
      });
    }

    const publisher = await prisma.publisher.create({
      data: {
        userId: user.userId,
        handle: data.handle.toLowerCase(),
        displayName: data.displayName,
      },
    });

    res.status(201).json({ publisher });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// ZINES
// ============================================================================

router.get('/zines', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);

    const zines = await prisma.zine.findMany({
      where: { publisherId: publisher.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        issues: {
          orderBy: { issueNumber: 'desc' },
          select: {
            id: true,
            title: true,
            issueNumber: true,
            publishedAt: true,
            pageCount: true,
            updatedAt: true,
          },
        },
      },
    });

    res.json({ zines });
  } catch (error) {
    next(error);
  }
});

router.post('/zines', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);
    const data = CreateZineSchema.parse(req.body);

    const slug = (data.slug || generateSlug(data.title)).toLowerCase();

    const slugExists = await prisma.zine.findFirst({
      where: { publisherId: publisher.id, slug },
    });

    if (slugExists) {
      return res.status(409).json({
        error: { code: 'SLUG_TAKEN', message: 'You already have a zine with this slug' },
      });
    }

    let passwordHash: string | null = null;
    if (data.visibility === 'PASSWORD' && data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    const zine = await prisma.zine.create({
      data: {
        publisherId: publisher.id,
        title: data.title,
        slug,
        description: data.description,
        visibility: data.visibility,
        accessType: data.visibility === 'PASSWORD' ? 'PASSWORD' : 'OPEN',
        passwordHash,
      },
    });

    res.status(201).json({ zine });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// DRAFTS
// ============================================================================

router.get('/drafts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);

    const drafts = await prisma.issue.findMany({
      where: {
        zine: { publisherId: publisher.id },
        publishedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        zine: { select: { id: true, slug: true, title: true } },
      },
    });

    res.json({ drafts });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// ISSUES
// ============================================================================

router.post('/zines/:zineId/issues', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);
    const { zineId } = req.params;

    await requireZineOwnership(publisher.id, zineId);

    const data = CreateIssueSchema.parse(req.body);

    let issueNumber = data.issueNumber;
    if (!issueNumber) {
      const lastIssue = await prisma.issue.findFirst({
        where: { zineId },
        orderBy: { issueNumber: 'desc' },
        select: { issueNumber: true },
      });
      issueNumber = (lastIssue?.issueNumber ?? 0) + 1;
    }

    try {
      const issue = await prisma.issue.create({
        data: { zineId, title: data.title, issueNumber },
      });

      res.status(201).json({ issue });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({
          error: { code: 'ISSUE_NUMBER_EXISTS', message: `Issue #${issueNumber} already exists` },
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.get('/issues/:issueId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);
    const { issueId } = req.params;

    await requireIssueOwnership(publisher.id, issueId);

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        zine: { select: { id: true, slug: true, title: true } },
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: { blocks: { orderBy: { zIndex: 'asc' } } },
        },
      },
    });

    if (!issue) throw Errors.NotFound('Issue');

    // Transform DB → builderState
    const builderPages = issue.pages.map((page, index) => {
      const metadata = (page.metadata || {}) as {
        name?: string;
        section?: string;
        paper?: string;
        deckled?: boolean;
      };

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

    const defaultPage = {
      id: 'p1',
      name: 'Cover',
      section: 'cover',
      paper: 'cotton',
      deckled: false,
      elements: [],
    };

    const builderState = {
      version: '13.1',
      project: { name: issue.title, description: '' },
      pages: builderPages.length > 0 ? builderPages : [defaultPage],
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
        id: issue.id,
        title: issue.title,
        issueNumber: issue.issueNumber,
        publishedAt: issue.publishedAt,
        pageCount: issue.pageCount,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      },
      zine: issue.zine,
      builderState,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/issues/:issueId/save', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);
    const { issueId } = req.params;

    await requireIssueOwnership(publisher.id, issueId);

    const { builderState } = SaveIssueSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: { title: builderState.project.name },
      });

      await tx.page.deleteMany({ where: { issueId } });

      for (let i = 0; i < builderState.pages.length; i++) {
        const builderPage = builderState.pages[i];
        const pageNumber = i + 1;

        const page = await tx.page.create({
          data: {
            issueId,
            pageNumber,
            canvasWidth: 900,
            canvasHeight: 1200,
            backgroundColor: PAPER_COLORS[builderPage.paper || 'cotton'] || '#ffffff',
            metadata: {
              name: builderPage.name,
              section: builderPage.section,
              paper: builderPage.paper,
              deckled: builderPage.deckled,
            },
          },
        });

        const elements = builderPage.elements as Array<{
          id?: string;
          type: string;
          x: number;
          y: number;
          w: number;
          h: number;
          rotation?: number;
          z?: number;
          [key: string]: unknown;
        }>;

        if (elements.length > 0) {
          const blocksData = elements.map((el, index) => ({
            pageId: page.id,
            blockType: el.type || 'unknown',
            positionX: (el.x / 900) * 100,
            positionY: (el.y / 1200) * 100,
            width: (el.w / 900) * 100,
            height: (el.h / 1200) * 100,
            rotation: el.rotation || 0,
            zIndex: el.z ?? index,
            data: el,
          }));

await tx.block.createMany({ data: blocksData as 
Prisma.BlockCreateManyInput[] });
        }
      }
    });

    await regenerateSpreads(issueId);

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, title: true, pageCount: true, spreadCount: true, updatedAt: true },
    });

    res.json({ issue });
  } catch (error) {
    next(error);
  }
});

router.delete('/issues/:issueId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);
    const { issueId } = req.params;

    const issue = await requireIssueOwnership(publisher.id, issueId);

    if (issue.publishedAt) {
      return res.status(400).json({
        error: { code: 'ALREADY_PUBLISHED', message: 'Cannot delete a published issue' },
      });
    }

    await prisma.issue.delete({ where: { id: issueId } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/issues/:issueId/publish', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);
    const { issueId } = req.params;

    const issue = await requireIssueOwnership(publisher.id, issueId);

    if (issue.publishedAt) {
      return res.status(400).json({
        error: { code: 'ALREADY_PUBLISHED', message: 'This issue is already published' },
      });
    }

    const pageCount = await prisma.page.count({ where: { issueId } });

    if (pageCount === 0) {
      return res.status(400).json({
        error: { code: 'NO_PAGES', message: 'Cannot publish an issue with no pages' },
      });
    }

    await regenerateSpreads(issueId);

    const published = await prisma.$transaction(async (tx) => {
      const publishedIssue = await tx.issue.update({
        where: { id: issueId },
        data: { publishedAt: new Date() },
        include: {
          zine: {
            include: { publisher: { select: { handle: true } } },
          },
        },
      });

      const publishedCount = await tx.issue.count({
        where: { zineId: publishedIssue.zineId, publishedAt: { not: null } },
      });

      await tx.zine.update({
        where: { id: publishedIssue.zineId },
        data: { issueCount: publishedCount },
      });

      return publishedIssue;
    });

    const url = `/${published.zine.publisher.handle}/${published.zine.slug}/${published.issueNumber}`;

    res.json({
      issue: {
        id: published.id,
        title: published.title,
        issueNumber: published.issueNumber,
        publishedAt: published.publishedAt,
        pageCount: published.pageCount,
        spreadCount: published.spreadCount,
      },
      url,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/issues/:issueId/unpublish', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const publisher = await requirePublisher(req);
    const { issueId } = req.params;

    const issue = await requireIssueOwnership(publisher.id, issueId);

    if (!issue.publishedAt) {
      return res.status(400).json({
        error: { code: 'NOT_PUBLISHED', message: 'This issue is not published' },
      });
    }

    const unpublished = await prisma.$transaction(async (tx) => {
      const unpublishedIssue = await tx.issue.update({
        where: { id: issueId },
        data: { publishedAt: null },
      });

      const publishedCount = await tx.issue.count({
        where: { zineId: unpublishedIssue.zineId, publishedAt: { not: null } },
      });

      await tx.zine.update({
        where: { id: unpublishedIssue.zineId },
        data: { issueCount: publishedCount },
      });

      return unpublishedIssue;
    });

    res.json({ issue: unpublished, message: 'Issue unpublished' });
  } catch (error) {
    next(error);
  }
});

export default router;
