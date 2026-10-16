"use client";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";
import { currency, dateLabel } from "@/lib/display";
import { sentenceCase } from "@/lib/work-presentation";
import type { ContractCatalogView } from "./catalog-view";
import { useCatalogNavigation } from "@/lib/use-catalog-navigation";
import { contractFilterQuery, defaultContractFilters } from "./filters";

export function ContractCatalog({ view }: { view: ContractCatalogView }) {
  const { filters, page, pages, options, rows: shown, count } = view;
  const { draft, pending, update, changePage } = useCatalogNavigation(
    "/contratos/",
    filters,
    view.query,
    contractFilterQuery,
  );
  const active = contractFilterQuery(filters) !== "";
  return (
    <section
      className="work-list catalog-works contract-catalog"
      aria-label="Consulta de contratos"
      aria-busy={pending}
    >
      <div className="search-panel">
        <label className="search-field">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">
            Buscar por contrato, objeto, empresa, documento ou processo
          </span>
          <input
            type="search"
            placeholder="Buscar por contrato, objeto, empresa, CNPJ ou processo..."
            value={draft.q}
            maxLength={300}
            onChange={(event) => update({ q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape") update({ q: "" });
            }}
          />
          <kbd>ESC</kbd>
        </label>
        <div className="filter-row">
          <div className="filter-selects">
            <label className="select-wrap">
              <span className="sr-only">Ano do contrato</span>
              <select
                value={filters.year}
                disabled={pending}
                onChange={(event) => update({ year: event.target.value })}
              >
                <option value="">Ano: Todos</option>
                {options.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-wrap">
              <span className="sr-only">Órgão contratante</span>
              <select
                value={filters.org}
                disabled={pending}
                onChange={(event) => update({ org: event.target.value })}
              >
                <option value="">Órgão: Todos</option>
                {options.orgs.map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-wrap">
              <span className="sr-only">Situação do contrato</span>
              <select
                value={filters.status}
                disabled={pending}
                onChange={(event) => update({ status: event.target.value })}
              >
                <option value="">Situação: Todas</option>
                {options.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {active && (
              <button
                className="clear-button"
                onClick={() => update(defaultContractFilters)}
              >
                <X size={13} />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
        <div className="results-bar">
          <span role="status" aria-live="polite">
            <span className="gold-dot" />
            Exibindo <strong>{count.toLocaleString("pt-BR")}</strong> contratos
          </span>
          <label className="sort-select">
            Ordenar:
            <select
              value={filters.sort}
              disabled={pending}
              onChange={(event) => update({ sort: event.target.value })}
            >
              <option value="updated">Atualização da fonte</option>
              <option value="signed">Assinatura mais recente</option>
              <option value="value">Maior valor</option>
            </select>
          </label>
        </div>
      </div>
      {pending && (
        <p className="sr-only" role="status">
          Atualizando contratos...
        </p>
      )}
      {shown.length ? (
        <div className="table-wrap">
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tabela de contratos; role horizontalmente em telas pequenas"
          >
            <table className="works-table contracts-table">
              <caption className="sr-only">
                Contratos municipais que correspondem aos filtros
              </caption>
              <thead>
                <tr>
                  <th scope="col">Contrato e objeto</th>
                  <th scope="col">Empresa e órgão</th>
                  <th scope="col" className="numeric">
                    Valor informado
                  </th>
                  <th scope="col">Vigência</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="action-column">
                    <span className="sr-only">Detalhes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((contract) => (
                  <tr key={contract.id}>
                    <th scope="row">
                      <Link
                        className="contract-number"
                        href={`/contratos/${contract.id}/`}
                        prefetch={false}
                      >
                        {contract.number}
                      </Link>
                      <p className="contract-object">
                        {contract.object
                          ? sentenceCase(contract.object)
                          : "Objeto não informado"}
                      </p>
                      <small className="contract-meta">
                        {contract.process
                          ? `Processo ${contract.process}`
                          : "Processo não informado"}
                      </small>
                    </th>
                    <td>
                      <span className="contract-supplier">
                        {contract.suppliers
                          .map((supplier) => supplier.name)
                          .join(" · ") || "Empresa não informada"}
                      </span>
                      <small className="contract-meta">
                        {contract.organization ??
                          contract.organizationName ??
                          "Órgão não informado"}
                      </small>
                    </td>
                    <td className="numeric">
                      <strong className="money">
                        {currency(contract.valueCents)}
                      </strong>
                    </td>
                    <td>
                      <span className="contract-date">
                        {dateLabel(contract.startsAt)}
                      </span>
                      <small className="contract-meta">
                        até {dateLabel(contract.endsAt)}
                      </small>
                    </td>
                    <td>
                      <span className="contract-status">{contract.status}</span>
                    </td>
                    <td className="action-column">
                      <Link
                        className="row-button"
                        href={`/contratos/${contract.id}/`}
                        aria-label={`Ver detalhes de ${contract.number}`}
                        title="Ver detalhes do contrato"
                        prefetch={false}
                      >
                        <ChevronRight size={20} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-footer">
            <span>
              Mostrando {(page - 1) * 12 + 1} a {Math.min(page * 12, count)} de{" "}
              {count.toLocaleString("pt-BR")} contratos
            </span>
            <div className="pagination-buttons">
              <button
                onClick={() => changePage(page - 1)}
                disabled={pending || page === 1}
                aria-label="Página anterior"
              >
                Anterior
              </button>
              <span>
                Página {page} de {pages}
              </span>
              <button
                onClick={() => changePage(page + 1)}
                disabled={pending || page === pages}
                aria-label="Próxima página"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <h2>Nenhum contrato encontrado</h2>
          <p>Tente outro termo ou limpe os filtros.</p>
          <button
            className="button button-secondary"
            onClick={() => update(defaultContractFilters)}
          >
            Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}
