"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileSearch, Search, X } from "lucide-react";
import type { Work } from "@/lib/schema";
import { currency, dateLabel, percentLabel } from "@/lib/display";
import { sentenceCase, workTitle } from "@/lib/work-presentation";
import {
  defaultFilters,
  filterWorks,
  readFilters,
  type Filters,
} from "@/lib/work-filters";
import {
  WORK_POSITION_KEY,
  WORK_RESTORE_KEY,
  readWorkPage,
  rememberWorkPosition,
  worksUrl,
} from "@/lib/work-navigation";
import { Status } from "./Status";

export function WorkList({
  works,
  home = false,
}: {
  works: Work[];
  home?: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const restore = useRef<{ url: string; y: number } | null>(null);
  const results = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => (home ? works : filterWorks(works, filters)),
    [works, filters, home],
  );
  const limit = home ? 5 : 12;
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const listUrl = worksUrl(filters, currentPage);
  const statuses = [...new Set(works.map((work) => work.status))].sort();
  const organizations = [
    ...new Map(
      works
        .filter((work) => work.organization)
        .map((work) => [
          work.organization!,
          work.organizationName ?? work.organization!,
        ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const neighborhoods = [
    ...new Set(
      works
        .map((work) => work.neighborhood)
        .filter((value): value is string => !!value),
    ),
  ].sort();
  const active = !!(
    filters.q ||
    filters.status ||
    filters.org ||
    filters.neighborhood ||
    filters.sort !== "updated"
  );

  useEffect(() => {
    if (home) {
      setReady(true);
      return;
    }
    const read = () => {
      setFilters(readFilters(window.location.search));
      setPage(readWorkPage(window.location.search));
      setReady(true);
    };
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(WORK_POSITION_KEY) ?? "null",
      );
      const target = sessionStorage.getItem(WORK_RESTORE_KEY);
      if (
        saved &&
        saved.url === target &&
        target === window.location.pathname + window.location.search &&
        Number.isFinite(saved.y) &&
        saved.y >= 0
      )
        restore.current = saved;
      sessionStorage.removeItem(WORK_RESTORE_KEY);
    } catch {
      /* Filters do not depend on browser storage. */
    }
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [home]);

  useEffect(() => {
    if (!ready || !restore.current || restore.current.url !== listUrl) return;
    const y = restore.current.y;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "instant" });
        restore.current = null;
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ready, listUrl]);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    window.history.replaceState(null, "", worksUrl(next));
  }
  function changePage(next: number) {
    setPage(next);
    window.history.replaceState(null, "", worksUrl(filters, next));
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  const detailHref = (work: Work) =>
    `/obras/${work.id}/?from=${encodeURIComponent(listUrl)}`;

  return (
    <section
      className={`work-list ${home ? "recent-works" : "catalog-works"}`}
      id="explorar"
      aria-label="Consulta de obras"
    >
      {!home && (
        <div className="search-panel work-search">
          <div className="search-field">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="work-search">
              Buscar obra, localização, empresa, CNPJ ou processo
            </label>
            <input
              id="work-search"
              type="search"
              value={filters.q}
              placeholder="Obra, empresa, CNPJ ou processo"
              enterKeyHint="search"
              aria-describedby="work-search-help"
              onChange={(event) => update({ q: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Escape") update({ q: "" });
              }}
            />
            {filters.q && (
              <button
                type="button"
                className="search-clear"
                aria-label="Limpar busca"
                onClick={() => {
                  update({ q: "" });
                  document.getElementById("work-search")?.focus();
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <p id="work-search-help" className="search-help">
            Também busca contratos e empresas. Ex.: Flamboyant ou União
            Bandeirantes.
          </p>
          <div className="work-filter-controls">
            <label className="work-filter">
              <span>Situação</span>
              <select
                value={filters.status}
                onChange={(event) => update({ status: event.target.value })}
              >
                <option value="">Todas as situações</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <details className="more-filters">
              <summary>
                Mais filtros
                {filters.org || filters.neighborhood ? " · ativos" : ""}
              </summary>
              <div className="more-filters-content">
                <label className="work-filter">
                  <span>Secretaria responsável</span>
                  <select
                    value={filters.org}
                    onChange={(event) => update({ org: event.target.value })}
                  >
                    <option value="">Todas as secretarias</option>
                    {organizations.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name === code
                          ? `${code} — nome não informado`
                          : `${name} (${code})`}
                      </option>
                    ))}
                  </select>
                </label>
                {neighborhoods.length > 0 && (
                  <label className="work-filter">
                    <span>Bairro</span>
                    <select
                      value={filters.neighborhood}
                      onChange={(event) =>
                        update({ neighborhood: event.target.value })
                      }
                    >
                      <option value="">Todos os bairros</option>
                      {neighborhoods.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {!neighborhoods.length && (
                  <p className="search-help">
                    A Prefeitura não publica bairros padronizados nesta base.
                    Busque bairros e distritos pelo nome.
                  </p>
                )}
              </div>
            </details>
            {active && (
              <button
                type="button"
                className="clear-button"
                onClick={() => update(defaultFilters)}
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        </div>
      )}
      <div
        ref={results}
        id="resultados-obras"
        tabIndex={-1}
        className="works-results"
      >
        {!home && (
          <div className="results-bar">
            <span role="status" aria-live="polite">
              {filtered.length}{" "}
              {filtered.length === 1 ? "obra encontrada" : "obras encontradas"}
            </span>
            <label className="work-sort">
              Ordenar
              <select
                aria-label="Ordenação"
                value={filters.sort}
                onChange={(event) => update({ sort: event.target.value })}
              >
                <option value="updated">Atualização da Prefeitura</option>
                <option value="value">Maior valor contratado</option>
                <option value="name">Nome da obra</option>
              </select>
            </label>
          </div>
        )}
        {shown.length ? (
          <>
            <div className="works-table-card desktop-works">
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tabela de obras"
              >
                <table className="works-table catalog-table">
                  <caption className="sr-only">
                    Obras da base municipal que correspondem à consulta
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Obra</th>
                      <th scope="col">Local e responsável</th>
                      <th scope="col" className="numeric">
                        Contratado / pago
                      </th>
                      <th scope="col">Situação</th>
                      <th scope="col">Percentual da fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((work) => (
                      <tr key={work.id}>
                        <th scope="row">
                          <Link
                            className="work-title"
                            href={detailHref(work)}
                            onClick={rememberWorkPosition}
                          >
                            {workTitle(work.title)}
                          </Link>
                          <small className="work-updated">
                            Atualizado pela Prefeitura:{" "}
                            {dateLabel(work.sourceUpdatedAt)}
                          </small>
                        </th>
                        <td>
                          <span className="location-text">
                            {work.locations[0]
                              ? sentenceCase(work.locations[0])
                              : "Localização não informada"}
                          </span>
                          <small className="work-organization">
                            {work.organizationName ??
                              work.organization ??
                              "Responsável não informado"}
                          </small>
                        </td>
                        <td className="numeric">
                          <span className="money">
                            {currency(work.contractedCents)}
                          </span>
                          <small className="paid-value">
                            Pago: {currency(work.paidCents)}
                          </small>
                        </td>
                        <td>
                          <Status value={work.status} />
                        </td>
                        <td>
                          <span>
                            {percentLabel(work.reportedExecutionPercent)}
                          </span>
                          {work.reportedExecutionPercent !== null && (
                            <span className="percent-track" aria-hidden="true">
                              <span
                                style={{
                                  width: `${Math.max(0, Math.min(100, work.reportedExecutionPercent))}%`,
                                }}
                              />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-footnote">
                Percentual da fonte: a Prefeitura não define se é avanço físico
                ou financeiro.
              </p>
            </div>
            <ul className="mobile-works">
              {shown.map((work) => (
                <li key={work.id}>
                  <article className="work-card">
                    <Status value={work.status} />
                    <h2>{workTitle(work.title)}</h2>
                    <p>
                      {work.locations[0]
                        ? sentenceCase(work.locations[0])
                        : "Localização não informada"}
                    </p>
                    <dl className="card-values">
                      <div>
                        <dt>Contratado</dt>
                        <dd>{currency(work.contractedCents)}</dd>
                      </div>
                      <div>
                        <dt>Pago</dt>
                        <dd>{currency(work.paidCents)}</dd>
                      </div>
                    </dl>
                    <small className="work-updated">
                      Atualizado pela Prefeitura:{" "}
                      {dateLabel(work.sourceUpdatedAt)}
                    </small>
                    <Link
                      className="button button-secondary"
                      href={detailHref(work)}
                      onClick={rememberWorkPosition}
                      aria-label={`Ver detalhes de ${workTitle(work.title)}`}
                    >
                      Ver detalhes →
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
            {!home && (
              <div className="pagination-footer">
                <span>
                  Mostrando {(currentPage - 1) * limit + 1} a{" "}
                  {Math.min(currentPage * limit, filtered.length)} de{" "}
                  {filtered.length}
                </span>
                {pages > 1 && (
                  <nav aria-label="Paginação" className="pagination">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => changePage(currentPage - 1)}
                    >
                      Anterior
                    </button>
                    {Array.from({ length: pages }, (_, index) => index + 1).map(
                      (number) => (
                        <button
                          key={number}
                          aria-current={
                            currentPage === number ? "page" : undefined
                          }
                          aria-label={`Página ${number}`}
                          onClick={() => changePage(number)}
                        >
                          {number}
                        </button>
                      ),
                    )}
                    <button
                      disabled={currentPage === pages}
                      onClick={() => changePage(currentPage + 1)}
                    >
                      Próxima
                    </button>
                  </nav>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <FileSearch size={32} aria-hidden="true" />
            <h2>
              {works.length
                ? "Nenhuma obra para esta consulta"
                : "A base de obras ainda não está disponível"}
            </h2>
            <p>
              {works.length
                ? "Tente outro termo ou remova um filtro. Você pode buscar uma localização, um contrato ou uma empresa."
                : "Confira as fontes e o estado da coleta."}
            </p>
            {works.length ? (
              <div className="empty-actions">
                {filters.q && (
                  <button className="button" onClick={() => update({ q: "" })}>
                    Limpar busca
                  </button>
                )}
                <button
                  className="button button-secondary"
                  onClick={() => update(defaultFilters)}
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <Link className="button" href="/metodologia/">
                Consultar fontes
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
