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
const maskedCpf = (digits: string) => `${digits.slice(0, 3)}.***.***-**`;
function supplierDocument(document: string | null) {
  if (!document) return null;
  const digits = document.replace(/\D/g, "");
  // Preserve CNPJ; avoid exporting unmasked personal CPF or contact details.
  // CPFs digitados com erro mantem o formato NNN.NNN.NNN, mas nao 11 digitos.
  return digits.length === 11 ||
    (digits.length !== 14 && /^\d{3}\.?\d{3}\.?\d{3}/.test(document))
    ? maskedCpf(digits)
    : document;
}
// A fonte publica dados de representantes em textos livres.
function personalText(value: unknown) {
  return (
    text(value)
      ?.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, (cpf) =>
        maskedCpf(cpf.replace(/\D/g, "")),
      )
      .replace(
        /(CPF[^\d*]{0,12})(\d[\d.\-\s]{8,14}\d)/gi,
        (_, label, cpf) => label + maskedCpf(cpf.replace(/\D/g, "")),
      )
      .replace(/(\bR\.?G\.?(?![A-Za-z])[^\d*]{0,12})\d[\d.\-]*/g, "$1***") ??
    null
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
    .map((item) => {
      const document = text(item.documento);
      return {
        name: text(item.razao_social) ?? text(item.nome),
        document: supplierDocument(document),
        // Chave pelos digitos originais: CPFs mascarados podem coincidir.
        key: document?.replace(/\D/g, "") || null,
      };
    })
    .filter(
      (
        item,
      ): item is {
        name: string;
        document: string | null;
        key: string | null;
      } => !!item.name,
    );
  const uniqueSuppliers = [
    ...new Map(
      suppliers.map(({ key, ...item }) => [key ?? item.name, item]),
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
    return [
      {
        title: text(file.nome) ?? "Documento do contrato",
        url,
        status: text(file.situacao),
        publishedAt: parseDate(file.publicacao),
        signedAt: parseDate(file.data_contrato),
        startsAt: parseDate(file.data_vigencia_inicio),
        endsAt: parseDate(file.data_vigencia_fim),
        valueCents: amount(file.valor, "Valor do documento"),
      },
    ];
  });
  const procurement = record(raw.licitacao);
  const sourceId = raw.id;
  const core = {
    id: `pvh-contrato-${sourceId}`,
    sourceId,
    number: text(raw.numero)!,
    year:
      typeof raw.contrato_ano === "number" && Number.isInteger(raw.contrato_ano)
        ? raw.contrato_ano
        : null,
    object: personalText(raw.objeto),
    organization: text(agency.sigla),
    organizationName: text(agency.nome),
    status: text(raw.situacao) ?? "Não informada",
    category: text(raw.categoria),
    valueCents: amount(raw.valor, "Valor do contrato"),
    executedCents: amount(raw.valor_executado, "Executado informado"),
    signedAt: parseDate(raw.data_assinatura),
    startsAt: parseDate(raw.data_vigencia_inicio),
    endsAt: parseDate(raw.data_vigencia_fim),
    process: text(raw.numero_processo),
    observation: personalText(raw.observacao),
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
