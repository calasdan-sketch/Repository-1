import { z } from 'zod';

export type AgentStatus = 'spawning' | 'running' | 'done' | 'error';

export interface AgentState {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  action: string;
  history: string[];
  createdAt: number;
  updatedAt: number;
}

export const agentEventSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(['spawn', 'status', 'complete', 'error']),
    name: z.string().min(1).max(80).optional(),
    role: z.string().min(1).max(80).optional(),
    action: z.string().min(1).max(300).optional(),
  })
  .superRefine((event, ctx) => {
    if (event.type === 'spawn' && !event.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"name" is required for a spawn event',
        path: ['name'],
      });
    }
    if (event.type === 'status' && !event.action) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"action" is required for a status event',
        path: ['action'],
      });
    }
  });

export type AgentEventPayload = z.infer<typeof agentEventSchema>;
