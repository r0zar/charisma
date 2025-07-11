import { z } from 'zod';

export const NotificationStateSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['success', 'warning', 'error', 'info']),
  title: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
  read: z.boolean(),
  actionUrl: z.string().url().optional(),
  category: z.enum(['system', 'bot', 'market', 'security']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  metadata: z.record(z.any()).optional(),
  persistent: z.boolean().optional(),
});

// Infer TypeScript types from schemas
export type NotificationState = z.infer<typeof NotificationStateSchema>;

// StoredNotification extends NotificationState with additional storage fields
export interface StoredNotification extends NotificationState {
  createdAt: string;
  updatedAt: string;
}