
import { z } from "zod";

/**
 * Esquema para una Acción individual (UI o Red)
 */
export const ActionSchema = z.object({
  id: z.string(),
  type: z.enum(['click', 'input', 'submit', 'network', 'navigation']),
  timestamp: z.number().int().positive(),
  data: z.record(z.any()).default({}),
  screenshotId: z.string().nullable().optional(),
  elementId: z.string().nullable().optional(),
});

/**
 * Esquema para una Sesión Completa
 */
export const SessionSchema = z.object({
  id: z.string().startsWith('session_'),
  title: z.string().min(1).default("Nueva Grabación"),
  url: z.string().url().nullable().or(z.literal("")),
  createdDate: z.string().datetime(),
  status: z.enum(['active', 'completed']).default('active'),
  actions: z.array(ActionSchema).default([]),
});

/**
 * Esquema para el estado de grabación global
 */
export const RecordingStatusSchema = z.object({
  isRecording: z.boolean().default(false),
  isPaused: z.boolean().default(false),
  sessionId: z.string().nullable().default(null),
  startTime: z.number().nullable().default(null),
});

/**
 * Esquema para la configuración de la App
 */
export const AppConfigSchema = z.object({
  quality: z.enum(['low', 'medium', 'high']).default('medium'),
  autoOpen: z.boolean().default(true),
});

/**
 * Inputs para la creación de sesiones (Frontera UI -> Dominio)
 */
export const CreateSessionInputSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
});

// Tipos Inferidos para TS (si se usara un compilador)
/** @typedef {z.infer<typeof ActionSchema>} Action */
/** @typedef {z.infer<typeof SessionSchema>} Session */
/** @typedef {z.infer<typeof RecordingStatusSchema>} RecordingStatus */
