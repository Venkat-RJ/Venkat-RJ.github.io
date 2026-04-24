import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const timeline = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/timeline' }),
  schema: z.object({
    sortKey: z.number(),
    year: z.string(),
    label: z.string(),
    title: z.string(),
    location: z.string().optional(),
    summary: z.string(),
    interactive: z.enum(['code', 'chart', 'heatmap', 'live', 'input', 'image', 'text', 'none']).default('text'),
    artifacts: z.array(z.string()).optional(),
  }),
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    name: z.string(),
    year: z.string(),
    category: z.enum(['research', 'ventures', 'trading', 'tools', 'experiments']),
    status: z.enum(['live', 'shipped', 'archived', 'ongoing']),
    tagline: z.string(),
    github: z.string().optional(),
    demo: z.string().optional(),
    paper: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    published: z.string(),
    summary: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { timeline, work, writing };
