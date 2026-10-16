# Contratos municipais

## Escopo

O catálogo `/contratos/` usa somente o modelo `Contratos` da API municipal,
em todos os anos disponíveis. Convênios, acordos, locações e outros modelos
não são incorporados por aproximação. Uma ficha consulta a base por ID,
em `/contratos/pvh-contrato-{id}/`.

Fonte: `https://api.portovelho.ro.gov.br/api/v1/contratos?modelo=Contratos&por-pagina=100`.
O filtro `modelo` recebe o **nome**, não o ID numérico da tabela de modelos.
Os links de paginação retornados pela API omitem esse filtro; o coletor o
reaplica em cada página e converte HTTP para HTTPS.

## Dados e limites

- Busca por número, objeto, processo, empresa e documento; filtros por ano,
  órgão e situação; ordenação e paginação. Busca e filtros permanecem na URL.
- Valores em centavos; ausência não equivale a zero. `valor_executado` é
  identificado como “Executado informado”, sem tratá-lo como total pago.
- Assinatura, vigência, documentos e indicação de aditivo vêm da API.
  Valores dos documentos não são somados ao valor do contrato.
- Datas anteriores a 1990 ou posteriores a 2100, e assinaturas posteriores à
  coleta, são preservadas e sinalizadas na ficha. A ordenação por assinatura
  trata essas assinaturas como desconhecidas, sem corrigir a data publicada.
- Situação é a publicada pela fonte, sem classificação automática pela vigência.
- A API possui valores históricos de trilhões de reais. Preservamos os valores,
  sinalizamos contratos com valor igual ou superior a R$ 1 bilhão para conferência
  documental e não exibimos soma financeira global no catálogo/indicadores.
  O sinal é uma limitação de comparação, não uma conclusão de erro ou irregularidade.
- Vínculos com obras usam igualdade do ID oficial de contrato. CNPJ, objeto e
  valores similares não são usados para inventar relações.
- Links de anexos são restritos às origens oficiais de Porto Velho. E-mails,
  telefones e endereços dos fornecedores não são exportados. CPF numérico
  completo é mascarado; CNPJ é preservado.

## Persistência e atualização

`npm run sync:contracts` percorre toda a paginação, rejeita envelopes inválidos,
totais inconsistentes, IDs duplicados ou uma coleta incompleta. Contratos que
deixam de aparecer são mantidos como históricos, fora dos totais atuais. Se a
origem falhar, a última base válida permanece intacta e a tentativa fica registrada.

Os coletores de obras e contratos espaçam as chamadas à API municipal em pelo
menos 1,5 segundo. Cada requisição tem timeout de 15 segundos e até quatro
tentativas para falhas de rede ou HTTP 429/502/503/504. Em HTTP 429, respeitam
`Retry-After` em segundos ou data HTTP; sem cabeçalho válido, aguardam 60, 120
e 240 segundos. Essa cadência é uma precaução do observatório, não um limite
oficial confirmado da API. Uma espera indicada superior a cinco minutos
interrompe a coleta, sem antecipar a próxima chamada nem substituir a base.
Os logs mostram o motivo, a espera e a próxima tentativa.

O módulo `contratos-pvh` usa as tabelas privadas `contract_catalog` e
`contract_versions`, além de `module_state`, `sources` e `ingestion_runs`.
As alterações são transacionais, versionadas por hash e protegidas por revisão.
Retries com o mesmo ID de execução são idempotentes. RLS e revogação de permissões
bloqueiam acesso público; a RPC é somente para `service_role`.

As tentativas guardam metadados e hash do payload, sem uma nova cópia integral
do catálogo por execução. O estado atual e as versões efetivamente alteradas
preservam os dados necessários ao histórico.

Os arquivos `data/contracts-snapshot.json` e `data/exports/contratos.json`
contêm a mesma base normalizada. `npm run data:export` é uma exportação local
opcional dos três módulos e exige coleta válida; não participa do deploy.

O workflow `sync-data.yml` coleta obras, contratos e receitas somente por
acionamento manual em **Actions → Atualizar base de dados → Run workflow**.
O deploy usa a base existente e não executa coleta nem exportação.

Uso local com as credenciais existentes em `.env.local`, ignorado pelo Git:

```sh
node --env-file=.env.local --import tsx scripts/sync-contracts.ts
node --env-file=.env.local --import tsx scripts/export-supabase.ts
```

## Validação em 11/10/2026, horário de Porto Velho

A coleta real percorreu 29 páginas e importou 2.846 contratos e 6.868 links de
documentos. São 46 obras da base com ID de contrato presente no catálogo.
Uma repetição sem alterações não criou novas versões. A normalização com os
avisos de valores elevados criou versões para 21 registros, sem alterar os
valores publicados pela origem.

As migrações foram aplicadas ao projeto `observatorio-pvh`. A consulta remota
confirmou estado de contratos `ok`, 2.846 registros e RPC indisponível para `anon`.
O advisor registrou apenas o aviso informativo de RLS sem políticas, intencional
no schema privado: [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Testes cobrem paginação com filtro omitido, valores, campos ausentes, retenção,
histórico, concorrência, idempotência, permissões e bloqueio de exportação em falhas.

Com 2.846 fichas, conferir a quantidade de arquivos exportados antes de ampliar
a base ou adicionar novos módulos: o limite Workers Free é de 20.000 arquivos
por versão. [Limites oficiais](https://developers.cloudflare.com/workers/platform/limits/).

O pacote validado tem 14.585 arquivos reais, com maior arquivo abaixo de 8 MiB.
O dry-run do Wrangler 4.149.0 passou. O log “Read 23289 files” inclui as 8.704
pastas retornadas pela listagem recursiva; elas são descartadas na criação do
manifesto de assets. Não confundir essa contagem de entradas com arquivos publicados.
