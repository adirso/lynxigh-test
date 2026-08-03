import { z } from 'zod';
import { CONDITIONS, LISTING_OPTIONS } from './items.constants.js';

export const createItemBodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    price: z.coerce.number().positive(),
    condition: z.enum(CONDITIONS),
    isNegotiable: z.preprocess((val) => {
      if (typeof val === 'string') return val === 'true';
      return val;
    }, z.boolean()),
    minPrice: z.coerce.number().positive().optional(),
    categoryId: z.string().uuid(),
    options: z.array(z.enum(LISTING_OPTIONS)).default([]),
  })
  .refine((data) => !data.isNegotiable || data.minPrice !== undefined, {
    message: 'minPrice is required when isNegotiable is true',
    path: ['minPrice'],
  });

export type CreateItemInput = z.infer<typeof createItemBodySchema>;

export const updateItemBodySchema = createItemBodySchema;
export type UpdateItemInput = z.infer<typeof updateItemBodySchema>;
