import { z } from "zod";
import { sourceSchema } from "../../lib/schema";

const date = z.string().nullable();
const money = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const contractSchema = z.object({
  id: z.string(),
  sourceId: z.number().int().positive(),
  number: z.string().min(1),
  year: z.number().int().nullable(),
  object: z.string().nullable(),
  organization: z.string().nullable(),
  organizationName: z.string().nullable(),
  status: z.string(),
  category: z.string().nullable(),
  valueCents: money,
  executedCents: money,
  // Linhas gravadas antes destes campos continuam validas ate a proxima coleta.
  publication: z.string().nullable().default(null),
  publishedAt: date.default(null),
  signedAt: date,
  startsAt: date,
  endsAt: date,
  process: z.string().nullable(),
  addendumReported: z.boolean().nullable(),
  observation: z.string().nullable(),
  suppliers: z.array(
    z.object({ name: z.string(), document: z.string().nullable() }),
  ),
  procurement: z
    .object({ id: z.number().int(), title: z.string(), url: z.string().url() })
    .nullable(),
  documents: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      status: z.string().nullable(),
      publication: z.string().nullable().default(null),
      publishedAt: date,
      signedAt: date,
      startsAt: date,
      endsAt: date,
      valueCents: money,
    }),
  ),
  sourceUrl: z.string().url(),
  sourceUpdatedAt: date,
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastChangedAt: z.string(),
  inLatestSnapshot: z.boolean(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  issues: z.array(z.string()),
});
export const contractSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: date,
  lastAttemptAt: date,
  syncStatus: z.enum(["never", "ok", "error"]),
  syncError: date,
  sourceTotal: z.number().int().nonnegative().nullable(),
  contracts: z.array(contractSchema),
  sources: z.array(sourceSchema),
  changeSummary: z.object({
    added: z.number(),
    updated: z.number(),
    unchanged: z.number(),
    notSeen: z.number(),
  }),
});
export type Contract = z.infer<typeof contractSchema>;
export type ContractSnapshot = z.infer<typeof contractSnapshotSchema>;
export type ContractSummary = Pick<
  Contract,
  | "id"
  | "sourceId"
  | "number"
  | "year"
  | "object"
  | "organization"
  | "organizationName"
  | "status"
  | "category"
  | "valueCents"
  | "signedAt"
  | "startsAt"
  | "endsAt"
  | "suppliers"
  | "sourceUpdatedAt"
  | "process"
>;
