import type { Work } from "./schema";
export const contractLabel = (value: string | null) =>
  value
    ? /^contrato\b/i.test(value.trim())
      ? value
      : `Contrato nº ${value}`
    : "Contrato não informado";
export const currency = (cents: number | null, compact = false) =>
  cents === null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        ...(compact
          ? { notation: "compact", maximumFractionDigits: 1 }
          : { minimumFractionDigits: 2 }),
      }).format(cents / 100);
export function dateLabel(value: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Porto_Velho",
      }).format(date)
    : "Não informada";
}
export const percentLabel = (v: number | null) =>
  v === null
    ? "Não informado"
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v)}%`;
export const searchKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
// CNPJ e processo costumam ser copiados com ou sem pontuacao.
export const documentDigits = (value: string | null) =>
  value?.replace(/\D/g, "") ?? "";
export const documentSearchTerm = (word: string) =>
  /^[\d./-]+$/.test(word) && documentDigits(word).length >= 5
    ? documentDigits(word)
    : null;
export function freshness(w: Work, asOf: string) {
  if (!w.sourceUpdatedAt) return "Data não informada";
  return (Date.parse(asOf) - Date.parse(w.sourceUpdatedAt)) / 86400000 > 180
    ? "Registro com mais de 180 dias"
    : "Atualização informada";
}
export function sumKnown(
  works: Work[],
  field: "contractedCents" | "paidCents",
) {
  const known = works.filter((w) => w[field] !== null);
  return {
    cents: known.length ? known.reduce((sum, w) => sum + w[field]!, 0) : null,
    count: known.length,
  };
}
