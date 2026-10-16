import { searchKey } from "@/lib/display";
import type { ContractSummary } from "./schema";
export const defaultContractFilters = {
  q: "",
  year: "",
  org: "",
  status: "",
  sort: "updated",
};
export type ContractFilters = typeof defaultContractFilters;
// Datas fora deste intervalo sao preservadas e sinalizadas na ficha.
export const plausibleDates = { from: "1990-01-01", to: "2100-12-31" };
export function plausibleSignature(date: string | null, today: string) {
  return date && date >= plausibleDates.from && date <= today ? date : null;
}
export function readContractFilters(query: string): ContractFilters {
  const params = new URLSearchParams(query);
  return {
    q: (params.get("q") ?? "").slice(0, 300),
    year: params.get("ano") ?? "",
    org: params.get("orgao") ?? "",
    status: params.get("situacao") ?? "",
    sort: ["signed", "value"].includes(params.get("ordem") ?? "")
      ? params.get("ordem")!
      : "updated",
  };
}
export function contractFilterQuery(filters: ContractFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of [
    ["q", filters.q],
    ["ano", filters.year],
    ["orgao", filters.org],
    ["situacao", filters.status],
    ["ordem", filters.sort === "updated" ? "" : filters.sort],
  ])
    if (value) params.set(key, value);
  return params.toString();
}
export function filterContracts(
  contracts: ContractSummary[],
  filters: ContractFilters,
  today = new Date().toISOString().slice(0, 10),
) {
  const words = searchKey(filters.q.trim()).split(/\s+/).filter(Boolean);
  return contracts
    .filter((contract) => {
      if (
        (filters.year && String(contract.year) !== filters.year) ||
        (filters.org && contract.organization !== filters.org) ||
        (filters.status && contract.status !== filters.status)
      )
        return false;
      if (!words.length) return true;
      const haystack = searchKey(
        [
          contract.number,
          contract.object,
          contract.process,
          contract.organization,
          contract.organizationName,
          ...contract.suppliers.flatMap((supplier) => [
            supplier.name,
            supplier.document,
          ]),
        ].join(" "),
      );
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => {
      if (filters.sort === "value") {
        if (a.valueCents === null || b.valueCents === null)
          return a.valueCents === b.valueCents
            ? b.sourceId - a.sourceId
            : a.valueCents === null
              ? 1
              : -1;
        return b.valueCents - a.valueCents || b.sourceId - a.sourceId;
      }
      const dateA =
        filters.sort === "signed"
          ? plausibleSignature(a.signedAt, today)
          : a.sourceUpdatedAt;
      const dateB =
        filters.sort === "signed"
          ? plausibleSignature(b.signedAt, today)
          : b.sourceUpdatedAt;
      return (
        (dateB ?? "").localeCompare(dateA ?? "") || b.sourceId - a.sourceId
      );
    });
}
