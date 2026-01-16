
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
 * Esquema para Metadatos de Sesión (Sin acciones, para el listado)
 */
export const SessionMetadataSchema = z.object({
  id: z.string().startsWith('session_'),
  title: z.string().min(1).default("Nueva Grabación"),
  url: z.string().url().nullable().or(z.literal("")),
  createdDate: z.string().datetime(),
  status: z.enum(['active', 'completed']).default('active'),
  actionCount: z.number().default(0),
});

/**
 * Esquema para una Sesión Completa (Metadata + Acciones)
 */
export const SessionSchema = SessionMetadataSchema.extend({
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
 * Inputs para la creación de sesiones
 */
export const CreateSessionInputSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
});
