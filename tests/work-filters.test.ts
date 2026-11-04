import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWork } from "../src/lib/normalize";
import {
  defaultFilters,
  filterQuery,
  filterWorks,
  readFilters,
} from "../src/lib/work-filters";

const fixture = () =>
  normalizeWork(
    { id: 1, nome: "PAVIMENTAÇÃO DA RUA", situacao: "Em Andamento" },
    null,
    "2026-10-11T12:00:00Z",
  );

test("search and filters survive URL serialization with accents and ampersands", () => {
  const filters = {
    q: "Pavimentação & drenagem",
    status: "Em Andamento",
    org: "SEMOB",
    neighborhood: "São João",
    sort: "value",
  };
  assert.deepEqual(readFilters(filterQuery(filters)), filters);
  assert.equal(filterQuery(defaultFilters), "");
  assert.equal(readFilters("?sort=invalid").sort, "updated");
});

test("search finds accented titles, suppliers, locations and responsible organizations", () => {
  const work = {
    ...fixture(),
    supplier: "Empresa Madeira",
    organization: "SEMOB",
    organizationName: "Secretaria de Obras",
    locations: ["São João"],
  };
  for (const q of [
    "pavimentacao",
    "madeira",
    "sao joao",
    "semob",
    "secretaria de obras",
  ])
    assert.equal(filterWorks([work], { ...defaultFilters, q }).length, 1);
});

test("search finds CNPJ, process and contract numbers with or without punctuation", () => {
  const work = {
    ...fixture(),
    supplierDocument: "12.345.678/0001-99",
    process: "11.00022/2022",
    contractNumber: "CONTRATO Nº 048/PGM/2022",
  };
  const other = { ...work, id: "pvh-2", supplierDocument: "98765432000110" };
  const search = (q: string) =>
    filterWorks([work, other], { ...defaultFilters, q }).map((item) => item.id);
  for (const q of ["12.345.678/0001-99", "12345678000199"])
    assert.deepEqual(search(q), [work.id]);
  assert.deepEqual(search("98.765.432/0001-10"), ["pvh-2"]);
  for (const q of ["11.00022/2022", "11000222022"])
    assert.equal(search(q).length, 2);
  assert.equal(search("0482022").length, 2);
  assert.deepEqual(search("00000000000000"), []);
  assert.deepEqual(search("123"), []);
});

test("filters combine exactly and never infer a neighborhood from free text", () => {
  const work = {
    ...fixture(),
    organization: "SEMOB",
    locations: ["Bairro São João"],
    neighborhood: null,
  };
  assert.equal(
    filterWorks([work], {
      ...defaultFilters,
      q: "sao joao",
      org: "SEMOB",
      status: work.status,
    }).length,
    1,
  );
  assert.equal(
    filterWorks([work], { ...defaultFilters, org: "SEMED" }).length,
    0,
  );
  assert.equal(
    filterWorks([work], { ...defaultFilters, neighborhood: "São João" }).length,
    0,
  );
});

test("value order keeps unknown values after published zero and preserves records", () => {
  const unknown = { ...fixture(), id: "unknown", contractedCents: null };
  const zero = { ...fixture(), id: "zero", contractedCents: 0 };
  const paid = { ...fixture(), id: "paid", contractedCents: 10000 };
  const works = [unknown, zero, paid];
  assert.deepEqual(
    filterWorks(works, { ...defaultFilters, sort: "value" }).map(
      (work) => work.id,
    ),
    ["paid", "zero", "unknown"],
  );
  assert.equal(unknown.contractedCents, null);
  assert.equal(zero.contractedCents, 0);
  assert.deepEqual(
    works.map((work) => work.id),
    ["unknown", "zero", "paid"],
  );
});

test("default order uses source update and source id consistently", () => {
  const works = [
    { ...fixture(), sourceId: 1, sourceUpdatedAt: null },
    { ...fixture(), sourceId: 2, sourceUpdatedAt: "2026-10-01T00:00:00Z" },
    { ...fixture(), sourceId: 3, sourceUpdatedAt: "2026-10-01T00:00:00Z" },
  ];
  assert.deepEqual(
    filterWorks(works, defaultFilters).map((work) => work.sourceId),
    [3, 2, 1],
  );
});
