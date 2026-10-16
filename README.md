# Observatório de Porto Velho

Quer ajudar a melhorar o observatório? Consulte o [guia de contribuição](CONTRIBUTING.md).

O módulo **Receitas e orçamento** está implementado em `/receitas/`, com previsão anual, arrecadação mensal, filtros e acesso a LOA, LDO e PPA. Consulte [o recorte, a coleta e os limites](docs/receitas.md).

O módulo **Contratos municipais** está implementado no código em `/contratos/`,
com catálogo, fichas dinâmicas, documentos e vínculos por ID com as obras.
Consulte [escopo, coleta e validação de contratos](docs/contratos.md).

MVP cívico independente para consultar obras municipais, contratos associados e documentos oficiais. Next.js 16.4.0, React 19.3.0 e TypeScript. Interface baseada no Figma: tema escuro `#131313`, superfÃ­cies `#201F1F`, amarelo-ouro `#F2C230` e fonte Geist. Consulte [a aplicaÃ§Ã£o do design](docs/design-figma.md).

Obras é o primeiro módulo disponível. A identidade do portal e a navegação são comuns; novos temas podem ser acrescentados com suas próprias fontes e rotas. Consulte [o recorte e a expansão do observatório](docs/observatorio.md). Site público: [pvh.dadosabertos.org](https://pvh.dadosabertos.org/).

## Executar

Requer Node.js 22 ou superior e npm. O site consulta o banco no servidor; nenhum segredo é enviado ao navegador. Para desenvolvimento, `npm run db:local` cria um PostgreSQL local no Docker com os snapshots versionados e gera o `.env.local` (veja [como contribuir](CONTRIBUTING.md#preparar-o-ambiente)). Para usar outra base de leitura, configure o ambiente conforme `.env.example` e [a operação da VPS](docs/postgres.md).

```sh
npm ci
npm run db:local
npm run dev
```

Abra o endereço local mostrado no terminal. A base persistida é consultada durante cada requisição. Os JSONs locais ficam disponíveis apenas para ingestão e auditoria.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` inicia o servidor Next.js em `http://127.0.0.1:3000` após o build. A produção usa Next.js no Cloudflare Workers com OpenNext.

## Atualizar dados

O coletor persiste no PostgreSQL, guardando o histórico das próximas coletas. A VPS foi iniciada com os snapshots locais, sem copiar o histórico exclusivo do Supabase. O site consulta essa base a cada acesso, sem exportação nem rebuild após a coleta. O workflow `.github/workflows/deploy.yml` publica o código após pushes em `main` ou acionamento manual, usando a base existente. A coleta é independente e acontece somente quando acionada em **Actions → Atualizar base de dados → Run workflow** (`.github/workflows/sync-data.yml`). Não há coleta agendada nem sync durante o deploy. Consulte [persistência e operação com PostgreSQL](docs/postgres.md).

```sh
node --env-file=.env.postgres-sync.local --import tsx scripts/sync.ts
node --env-file=.env.postgres-sync.local --import tsx scripts/sync-contracts.ts
node --env-file=.env.postgres-sync.local --import tsx scripts/sync-revenues.ts
```

Com `DATABASE_PROVIDER=postgres` e as credenciais de ingestão, o comando percorre toda a paginação de `/api/v1/obras`, valida o total retornado, consulta os contratos pelo ID explícito e persiste o resultado na VPS. Arquivos em `data/` e `data/exports/` são cópias locais de ingestão. A próxima requisição ao site recebe o estado do banco. A coleta manual depende da disponibilidade das fontes e não representa atualização em tempo real da Prefeitura.

O armazenamento é incremental por ID e hash de conteúdo: primeira coleta, última alteração e registros ausentes são preservados. A leitura da API continua sendo uma varredura completa porque `/obras` não documenta filtro por atualização. Não se presume suporte a ETag, webhook ou cursor temporal.

Falha da API principal, envelope inválido, paginação incompleta ou IDs duplicados impedem substituir a base válida. Falha em um contrato usa o cache anterior quando disponível, marca o registro e a coleta como parciais. Ausência da API de dados abertos não impede a coleta pela API municipal.

`PMPV_API_TOKEN` é opcional, apenas se o acesso municipal mudar futuramente. Não foi necessário na validação. Não coloque tokens em arquivos publicados. Um lock em `data/sync.lock` impede execuções simultâneas. Se o processo for interrompido externamente, remova o lock somente após confirmar que não há sincronização em execução.

## O que foi validado em 11/10/2026

- API municipal: acesso anônimo HTTP 200 para obras, contratos vinculados e uma amostra de despesas com obras; CSV de obras de 2026 respondeu HTTP 200.
- 48 obras e 47 contratos distintos coletados; 730 links oficiais de documentos na base normalizada. Links repetidos são deduplicados dentro de cada obra.
- Portal da Transparência: HTTP 200, consulta padrão com quatro obras no exercício de 2026; data global declarada `23/07/2026`, distinta das atualizações por registro.
- Catálogo `dados.portovelho.ro.gov.br`: HTTP 502. Seus datasets, licença e periodicidade não puderam ser confirmados.
- Cinco obras sem percentual na API; duas datas de contrato na ficha da obra posteriores à data de coleta; 16 divergências entre valor da ficha da obra e valor do contrato vinculado. Os valores não são corrigidos por inferência.
- Atualizações dos registros da API entre 06/06/2024 e 09/06/2026. Não há SLA ou frequência oficial confirmada.

Esses números descrevem esta coleta e podem mudar. Consulte o arquivo de fontes e a base para a evidência e a data exata. Nenhuma obra fictícia foi incluída no site; fixtures sintéticas ficam apenas nos testes.

## Funcionalidades

- Visão geral com cobertura das somas, sem tratar a base como orçamento atual ou censo municipal completo.
- Busca por objeto, localização, contrato, processo e fornecedor; filtros por situação e órgão, ordenação e paginação.
- URLs preservam busca e filtros. Bairro permanece indisponível porque a fonte não oferece campo padronizado.
- Fichas dinâmicas com valores, contratos, vigências, medições, anexos, proveniência e limites de qualidade, inclusive para novos IDs após a publicação.
- Página de fontes e método, download JSON, estado sem resultados, estado sem base, falha de coleta e 404.
- HTML semântico, labels, foco visível, link para pular ao conteúdo, resultados anunciados e respeito à preferência por movimento reduzido.

## Estrutura

```text
src/app/               páginas e apresentação
src/components/        navegação, consulta e situação
src/lib/schema.ts      contrato validado em Zod
src/lib/normalize.ts   formatos municipais → modelo local
src/lib/sync-core.ts   merge, retenção histórica e paginação
src/lib/data.ts        obras consultadas no servidor
src/lib/database.ts    leitura por requisição, protegida por server-only
scripts/sync.ts        ingestão e auditoria das fontes
scripts/probe*.mjs     reprodução da investigação pública
data/snapshot.json     base normalizada e estado de coleta
data/contracts.json    cache dos contratos vinculados
data/raw/              respostas locais por hash (não publicadas)
data/exports/          exportações locais para auditoria
src/app/dados/         downloads da base persistida por requisição
evidence/              relatórios HTTP e OpenAPI extraída
docs/                  fontes, arquitetura, esquema e validação
tests/                 testes dos contratos e comportamentos críticos
.open-next/            Worker e assets gerados (não versionados)
```

## Método

**Contratado**, **pago** e **executado** não são intercambiáveis. O percentual municipal é apresentado como indicador informado pela fonte, sem afirmar que mede progresso físico. Não dividimos pago por contratado para inventar execução física. Campos ausentes permanecem `null`; zero publicado continua zero. Datas divergentes, valores de contratos diferentes e dados antigos são sinalizados, sem alegação automática de irregularidade.

Ver [fontes](docs/fontes.md), [arquitetura](docs/arquitetura.md), [esquema](docs/esquema.md) e [validação](docs/validacao.md).

## Próximos passos

1. Confirmar com o órgão publicador o significado de `porcentagem_executado`, `data_contrato`, `execucao` e `valor_a_medir`, além da periodicidade de publicação.
2. Revalidar o catálogo quando retornar; identificar datasets e licença específica, sem substituir silenciosamente a origem.
3. Acompanhar as execuções diárias no GitHub Actions e renovar o token Cloudflare antes de 09/01/2027.
4. Expandir a persistência PostgreSQL para novos módulos conforme suas fontes forem validadas. O domínio já usa IDs de origem, centavos e timestamps separados.
5. Associar despesas apenas quando houver relação documental inequívoca. Não adicionar mapa ou denúncias neste corte.

## Hospedagem

Para publicar na Cloudflare Workers, execute `npm run build:cloudflare`, `npm run deploy:check` e `npm run deploy`. Configure as credenciais Supabase como secrets do Worker; o workflow atualizado faz isso usando os Actions secrets existentes. Consulte [a configuração Cloudflare/OpenNext](docs/cloudflare.md).

O projeto requer um servidor Next.js ou Worker OpenNext. A configuração histórica `.openai/hosting.json` de exportação estática não é usada nesta publicação.

Os JSONs não são consumidos pelas páginas. Não existe API pública de escrita; a ingestão continua nos coletores e no workflow.

## Licença

O código do projeto é distribuído sob a [licença MIT](LICENSE).
Dados, documentos e recursos de terceiros mantêm as condições de suas fontes;
esta licença não os relicencia.
