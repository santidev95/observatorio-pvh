import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeContract } from "../src/features/contratos/normalize";
import {
  mergeContracts,
  failedContractSnapshot,
  safeContractPageUrl,
} from "../src/features/contratos/sync-core";
import { contractSnapshotSchema } from "../src/features/contratos/schema";
import {
  defaultContractFilters,
  filterContracts,
  readContractFilters,
  contractFilterQuery,
} from "../src/features/contratos/filters";
const at = "2026-10-11T10:00:00Z";
const raw = {
  id: 1,
  numero: "Contrato 001/2026",
  contrato_ano: 2026,
  modelo: "Contratos",
  objeto: "Construção de escola",
  valor: { value: 1234.56 },
  aditivo: false,
  contratante: { sigla: "SEMED", nome: "Educação" },
  fornecedor: {
    nome: "Empresa A",
    documento: "12.345.678/0001-99",
    email: "private@example.com",
  },
};
test("contratos: valores ausentes e zero são distintos, documentos externos e contatos não são exportados", () => {
  const contract = normalizeContract(
    {
      ...raw,
      valor_executado: { value: 0 },
      arquivos: [
        { nome: "PDF", arquivo: "javascript:alert(1)" },
        {
          nome: "Aditivo",
          arquivo: "https://anexos.portovelho.ro.gov.br/a.pdf",
          valor: "10,00",
        },
      ],
    },
    at,
  );
  assert.equal(contract.valueCents, 123456);
  assert.equal(contract.executedCents, 0);
  assert.equal(normalizeContract({ ...raw, valor: null }, at).valueCents, null);
  assert.equal(contract.documents.length, 1);
  assert.equal(contract.documents[0].valueCents, 1000);
  assert.ok(contract.issues.length);
  assert.ok(!JSON.stringify(contract).includes("private@example"));
  const person = normalizeContract(
    { ...raw, fornecedor: { nome: "Pessoa", documento: "123.456.789-01" } },
    at,
  );
  assert.equal(person.suppliers[0].document, "123.***.***-**");
  assert.throws(() => normalizeContract({ ...raw, modelo: "Convenios" }, at));
  const large = normalizeContract(
    { ...raw, valor: { value: 10411293000000 } },
    at,
  );
  assert.equal(large.valueCents, 1041129300000000);
  assert.ok(large.issues.some((issue) => issue.includes("R$ 1 bilhão")));
});
test("contratos: valor ausente no envelope da API não é formato inválido e avisos não se repetem", () => {
  const absent = { value: null, formatted: "0", brl: "R$ 0" };
  const file = (valor: unknown) => ({
    nome: "Aditivo",
    arquivo: "https://anexos.portovelho.ro.gov.br/a.pdf",
    valor,
  });
  const contract = normalizeContract(
    {
      ...raw,
      valor_executado: absent,
      arquivos: [file(absent), file({ value: 0 })],
    },
    at,
  );
  assert.equal(contract.executedCents, null);
  assert.equal(contract.documents[0].valueCents, null);
  assert.equal(contract.documents[1].valueCents, 0);
  assert.deepEqual(contract.issues, []);
  const invalid = normalizeContract(
    {
      ...raw,
      valor_executado: { value: "abc" },
      arquivos: [file("x"), file("y"), file("z")],
    },
    at,
  );
  assert.equal(invalid.executedCents, null);
  assert.deepEqual(invalid.issues, [
    "Valor do documento: formato monetário inválido; valor indisponível.",
    "Executado informado: formato monetário inválido; valor indisponível.",
  ]);
});
test("contratos: hashes ignoram datas de coleta, mudanças e ausências preservam histórico", () => {
  const first = normalizeContract(raw, at);
  const unchanged = normalizeContract(raw, "2026-10-12T10:00:00Z", first);
  assert.equal(unchanged.contentHash, first.contentHash);
  assert.equal(unchanged.firstSeenAt, at);
  assert.equal(unchanged.lastChangedAt, at);
  const changed = normalizeContract(
    { ...raw, valor: "20,00" },
    "2026-10-13T10:00:00Z",
    unchanged,
  );
  assert.equal(changed.lastChangedAt, "2026-10-13T10:00:00Z");
  assert.equal(mergeContracts([first], [changed]).changeSummary.updated, 1);
  const missing = mergeContracts([first], []);
  assert.equal(missing.contracts[0].inLatestSnapshot, false);
  assert.throws(() => mergeContracts([], [first, first]), /duplicados/);
  const snapshot = contractSnapshotSchema.parse({
    schemaVersion: 1,
    generatedAt: at,
    lastAttemptAt: at,
    syncStatus: "ok",
    syncError: null,
    sourceTotal: 1,
    contracts: [first],
    sources: [],
    changeSummary: { added: 1, updated: 0, unchanged: 0, notSeen: 0 },
  });
  const failed = failedContractSnapshot(
    snapshot,
    "rede",
    "2026-10-14T10:00:00Z",
  );
  assert.deepEqual(failed.contracts, snapshot.contracts);
  assert.equal(failed.generatedAt, at);
});
test("contratos: paginação preserva o modelo mesmo quando a API omite o filtro", () => {
  const url = new URL(
    safeContractPageUrl(
      "http://api.portovelho.ro.gov.br/api/v1/contratos?page=2",
    ),
  );
  assert.equal(url.protocol, "https:");
  assert.equal(url.searchParams.get("modelo"), "Contratos");
  assert.equal(url.searchParams.get("page"), "2");
  assert.throws(() =>
    safeContractPageUrl("https://other.example/api/v1/contratos"),
  );
  assert.throws(() =>
    safeContractPageUrl("https://api.portovelho.ro.gov.br/api/v1/obras"),
  );
});
test("contratos: busca sem acentos, combinação de filtros, URL e ordenação de valores desconhecidos", () => {
  const one = normalizeContract(raw, at);
  const two = normalizeContract(
    {
      ...raw,
      id: 2,
      contrato_ano: 2025,
      valor: null,
      contratante: { sigla: "SEMOB" },
    },
    at,
  );
  const filters = {
    ...defaultContractFilters,
    q: "construcao escola",
    year: "2026",
    org: "SEMED",
  };
  assert.deepEqual(
    filterContracts([one, two], filters).map((item) => item.sourceId),
    [1],
  );
  assert.deepEqual(readContractFilters(contractFilterQuery(filters)), filters);
  assert.equal(
    filterContracts([two, one], { ...defaultContractFilters, sort: "value" })[0]
      .sourceId,
    1,
  );
  assert.equal(readContractFilters("ordem=unknown").sort, "updated");
});
