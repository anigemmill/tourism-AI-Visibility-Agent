import { z } from "zod";

export const businessCreateSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().min(1).max(500),
  destination: z.string().min(1).max(200),
  category: z.string().min(1).max(200),
  bookingUrl: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  targetMarkets: z.array(z.string().min(1)).default([]),
  targetSegments: z.array(z.string().min(1)).default([]),
  socialProfiles: z.record(z.string(), z.string()).optional().nullable(),
  competitors: z
    .array(
      z.object({
        name: z.string().min(1),
        website: z.string().optional().nullable(),
      })
    )
    .default([]),
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .default([]),
});

export type BusinessCreateInput = z.infer<typeof businessCreateSchema>;
