import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, FileText } from "lucide-react";
import { getWorksData } from "@/lib/data";
import { currency, dateLabel } from "@/lib/display";
import { getContractsData } from "@/features/contratos/data";
import { ShareButton } from "@/components/ShareButton";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { contractsById } = await getContractsData();
  return {
    title:
      contractsById.get((await params).id)?.number ?? "Contrato não encontrado",
  };
}
export default async function ContractDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ snapshot }, { contractsById, contractSnapshot }] = await Promise.all(
    [getWorksData(), getContractsData()],
  );
  const contract = contractsById.get((await params).id);
  if (!contract) notFound();
  const works = snapshot.works.filter(
    (work) => work.contractId === contract.sourceId,
  );
  return (
    <main id="conteudo" className="container page-main contract-detail">
      <Link href="/contratos/" className="text-link">
        ← Todos os contratos
      </Link>
      <div className="contract-detail-heading">
        <div>
          <div className="page-kicker">
            <span>CONTRATO MUNICIPAL</span>
            <small>
              {contract.organization ?? "Órgão não informado"} ·{" "}
              {contract.year ?? "Ano não informado"}
            </small>
          </div>
          <h1 className="page-title">{contract.number}</h1>
          <p className="page-intro">
            {contract.object ?? "Objeto não informado na fonte."}
          </p>
        </div>
        <div className="contract-detail-actions">
          <ShareButton title={contract.number} />
          <a
            className="button button-secondary"
            href={contract.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Registro oficial <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      {!contract.inLatestSnapshot && (
        <div className="notice" role="status">
          Este contrato não apareceu na última consulta completa. Preservamos o
          registro histórico; isso não confirma exclusão ou encerramento.
        </div>
      )}
      {contractSnapshot.syncStatus === "error" && (
        <div className="notice error" role="alert">
          A última coleta falhou. Os dados abaixo são da última base válida.
        </div>
      )}
      <div className="stats contract-metrics">
        <article className="stat">
          <div className="metric-label">VALOR DO CONTRATO</div>
          <strong>{currency(contract.valueCents)}</strong>
          <p>Valor informado no registro do contrato.</p>
        </article>
        <article className="stat">
          <div className="metric-label">EXECUTADO INFORMADO</div>
          <strong>{currency(contract.executedCents)}</strong>
          <p>
            A definição deste campo não foi confirmada; não o tratamos como
            total pago.
          </p>
        </article>
        <article className="stat">
          <div className="metric-label">SITUAÇÃO NA FONTE</div>
          <strong className="contract-status-value">{contract.status}</strong>
          <p>Não calculada a partir da vigência.</p>
        </article>
      </div>
      <section className="contract-section" aria-labelledby="contract-info">
        <h2 id="contract-info">Dados do contrato</h2>
        <dl className="contract-facts">
          {[
            [
              "Órgão contratante",
              contract.organizationName ??
                contract.organization ??
                "Não informado",
            ],
            ["Processo", contract.process ?? "Não informado"],
            [
              "Publicação",
              contract.publication ?? dateLabel(contract.publishedAt),
            ],
            ["Assinatura", dateLabel(contract.signedAt)],
            ["Início da vigência", dateLabel(contract.startsAt)],
            ["Fim da vigência", dateLabel(contract.endsAt)],
            ["Categoria", contract.category ?? "Não informada"],
            [
              "Aditivo informado pela fonte",
              contract.addendumReported === null
                ? "Não informado"
                : contract.addendumReported
                  ? "Sim"
                  : "Não",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section
        className="contract-section"
        aria-labelledby="contract-suppliers"
      >
        <h2 id="contract-suppliers">Empresas contratadas</h2>
        {contract.suppliers.length ? (
          <ul className="contract-supplier-list">
            {contract.suppliers.map((supplier, index) => (
              <li key={`${supplier.document}-${index}`}>
                <strong>{supplier.name}</strong>
                <span>{supplier.document ?? "Documento não informado"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Empresa não informada na fonte.</p>
        )}
      </section>
      <section className="contract-section" aria-labelledby="contract-docs">
        <h2 id="contract-docs">Documentos e aditivos</h2>
        <p className="overview-note">
          Anexos publicados pela fonte. Os valores dos documentos não são
          somados ao contrato; podem representar alterações ou informações já
          incluídas.
        </p>
        {contract.documents.length ? (
          <ul className="contract-documents">
            {contract.documents.map((document, index) => (
              <li key={`${document.url}-${index}`}>
                <FileText size={20} aria-hidden="true" />
                <div>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {document.title} <ArrowUpRight size={14} />
                  </a>
                  <p>
                    Publicação:{" "}
                    {document.publication ?? dateLabel(document.publishedAt)} ·
                    Valor informado: {currency(document.valueCents)}
                  </p>
                  <small>
                    Vigência: {dateLabel(document.startsAt)} a{" "}
                    {dateLabel(document.endsAt)}
                    {document.status ? ` · ${document.status}` : ""}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum documento com link oficial disponível nesta coleta.</p>
        )}
      </section>
      <section className="contract-section" aria-labelledby="contract-links">
        <h2 id="contract-links">Obras e licitação vinculadas</h2>
        {works.length ? (
          <ul className="contract-work-links">
            {works.map((work) => (
              <li key={work.id}>
                <Link href={`/obras/${work.id}/`}>{work.title}</Link>
                <span>
                  {work.status}
                  {!work.inLatestSnapshot ? " · Registro histórico" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Nenhuma obra da base consultada informa o ID deste contrato. Isso
            não comprova ausência de obras ou serviços.
          </p>
        )}
        {contract.procurement && (
          <p>
            <a
              className="text-link"
              href={contract.procurement.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {contract.procurement.title} <ArrowUpRight size={14} />
            </a>
          </p>
        )}
        <p className="overview-note">
          Vínculos publicados pela API, sem associação por semelhança de nomes
          ou valores.
        </p>
      </section>
      {contract.observation && (
        <section className="contract-section">
          <h2>Observações da fonte</h2>
          <p>{contract.observation}</p>
        </section>
      )}
      {contract.issues.length > 0 && (
        <div className="notice">
          <h2>Limitações deste registro</h2>
          <ul>
            {contract.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="collection-row">
        <span>
          Atualização na fonte: {dateLabel(contract.sourceUpdatedAt)} · Coleta:{" "}
          {dateLabel(contractSnapshot.generatedAt)}
        </span>
        <Link href="/metodologia/">FONTES E LIMITAÇÕES</Link>
      </div>
    </main>
  );
}
