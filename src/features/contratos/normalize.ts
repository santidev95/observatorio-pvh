import { z } from "zod";
import {
  moneyToCents,
  officialUrl,
  parseDate,
  stableHash,
  text,
} from "../../lib/normalize";
import { contractSchema, type Contract } from "./schema";

export const rawContractSchema = z
  .object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    numero: z.string().min(1),
    modelo: z.literal("Contratos"),
  })
  .passthrough();
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const items = (value: unknown) =>
  Array.isArray(value) ? value.map(record) : [];
function supplierDocument(value: unknown) {
  const document = text(value);
  if (!document) return null;
  const digits = document.replace(/\D/g, "");
  // Preserve CNPJ; avoid exporting unmasked personal CPF or contact details.
  return digits.length === 11 ? `${digits.slice(0, 3)}.***.***-**` : document;
}
// Publicacao e texto livre na fonte; sem letra nem digito nao informa nada.
function publicationText(value: unknown) {
  const published = text(value);
  return published && /[\p{L}\d]/u.test(published) ? published : null;
}
function publicationDate(published: string | null) {
  if (!published) return null;
  const compact = published.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) return parseDate(`${compact[1]}/${compact[2]}/${compact[3]}`);
  // Mais de uma data no texto e ambiguo: preserva o texto, sem escolher.
  const dates = new Set(published.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? []);
  return (
    parseDate(published) ?? (dates.size === 1 ? parseDate([...dates][0]) : null)
  );
}
export function normalizeContract(
  input: unknown,
  collectedAt: string,
  previous?: Contract,
): Contract {
  const raw = rawContractSchema.parse(input);
  const agency = record(raw.contratante);
  const issues: string[] = [];
  const amount = (value: unknown, label: string) => {
    const cents = moneyToCents(value);
    if (value !== null && value !== undefined && value !== "" && cents === null)
      issues.push(`${label}: formato monetário inválido; valor indisponível.`);
    return cents;
  };
  const suppliers = [
    record(raw.fornecedor),
    ...items(raw.fornecedores).map((item) => record(item.fornecedor)),
  ]
    .map((item) => ({
      name: text(item.razao_social) ?? text(item.nome),
      document: supplierDocument(item.documento),
    }))
    .filter(
      (item): item is { name: string; document: string | null } => !!item.name,
    );
  const uniqueSuppliers = [
    ...new Map(
      suppliers.map((item) => [item.document ?? item.name, item]),
    ).values(),
  ];
  const documents = items(raw.arquivos).flatMap((file) => {
    const url = officialUrl(file.arquivo);
    if (!url) {
      issues.push(
        "Documento com endereço ausente ou fora da origem oficial; link não exibido.",
      );
      return [];
    }
    const publication = publicationText(file.publicacao);
    return [
      {
        title: text(file.nome) ?? "Documento do contrato",
        url,
        status: text(file.situacao),
        publication,
        publishedAt: publicationDate(publication),
        signedAt: parseDate(file.data_contrato),
        startsAt: parseDate(file.data_vigencia_inicio),
        endsAt: parseDate(file.data_vigencia_fim),
        valueCents: amount(file.valor, "Valor do documento"),
      },
    ];
  });
  const procurement = record(raw.licitacao);
  const sourceId = raw.id;
  const publication = publicationText(raw.publicacao);
  const core = {
    id: `pvh-contrato-${sourceId}`,
    sourceId,
    number: text(raw.numero)!,
    year:
      typeof raw.contrato_ano === "number" && Number.isInteger(raw.contrato_ano)
        ? raw.contrato_ano
        : null,
    object: text(raw.objeto),
    organization: text(agency.sigla),
    organizationName: text(agency.nome),
    status: text(raw.situacao) ?? "Não informada",
    category: text(raw.categoria),
    valueCents: amount(raw.valor, "Valor do contrato"),
    executedCents: amount(raw.valor_executado, "Executado informado"),
    publication,
    publishedAt: publicationDate(publication),
    signedAt: parseDate(raw.data_assinatura),
    startsAt: parseDate(raw.data_vigencia_inicio),
    endsAt: parseDate(raw.data_vigencia_fim),
    process: text(raw.numero_processo),
    observation: text(raw.observacao),
    addendumReported: typeof raw.aditivo === "boolean" ? raw.aditivo : null,
    suppliers: uniqueSuppliers,
    procurement:
      Number.isSafeInteger(procurement.id) && Number(procurement.id) > 0
        ? {
            id: Number(procurement.id),
            title:
              text(procurement.titulo) ??
              `Licitação ${procurement.numero ?? procurement.id}`,
            url: `https://api.portovelho.ro.gov.br/api/v1/licitacoes/${procurement.id}`,
          }
        : null,
    documents,
    sourceUrl: `https://api.portovelho.ro.gov.br/api/v1/contratos/${sourceId}`,
    sourceUpdatedAt: text(raw.updated_at),
    issues,
  };
  if (core.startsAt && core.endsAt && core.endsAt < core.startsAt)
    issues.push(
      "A fonte informa fim de vigência anterior ao início; datas preservadas.",
    );
  if (core.valueCents !== null && core.valueCents >= 100_000_000_000)
    issues.push(
      "Valor igual ou superior a R$ 1 bilhão informado na fonte; confira o documento original antes de comparações. O valor foi preservado.",
    );
  const contentHash = stableHash(core);
  return contractSchema.parse({
    ...core,
    contentHash,
    inLatestSnapshot: true,
    firstSeenAt: previous?.firstSeenAt ?? collectedAt,
    lastSeenAt: collectedAt,
    lastChangedAt:
      previous?.contentHash === contentHash
        ? previous.lastChangedAt
        : collectedAt,
  });
}
