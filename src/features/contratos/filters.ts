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
) {
  const words = searchKey(filters.q.trim()).split(/\s+/).filter(Boolean);
  // CNPJ e processo costumam ser copiados com ou sem pontuacao.
  const digits = (value: string | null) => value?.replace(/\D/g, "") ?? "";
  const documentWord = (word: string) =>
    /^[\d./-]+$/.test(word) && digits(word).length >= 5 ? digits(word) : null;
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
      const documents = [
        contract.number,
        contract.process,
        ...contract.suppliers.map((supplier) => supplier.document),
      ].map(digits);
      return words.every((word) => {
        const number = documentWord(word);
        return (
          haystack.includes(word) ||
          (number !== null && documents.some((item) => item.includes(number)))
        );
      });
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
      const dateA = filters.sort === "signed" ? a.signedAt : a.sourceUpdatedAt;
      const dateB = filters.sort === "signed" ? b.signedAt : b.sourceUpdatedAt;
      return (
        (dateB ?? "").localeCompare(dateA ?? "") || b.sourceId - a.sourceId
      );
    });
}
