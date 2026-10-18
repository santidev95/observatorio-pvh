# Orientacoes para agentes

Estas instrucoes se aplicam a todo o repositorio. Respeite o escopo solicitado
pelo usuario e os padroes existentes antes de introduzir novas abstracoes.

## Ambiente e forma de trabalhar

- Use portugues nas respostas e preserve a linguagem da interface.
- Leia os arquivos afetados, seus consumidores e os testes antes de editar.
- Preserve alteracoes locais de outras tarefas. Nao reverta trabalho alheio.
- Commits, pushes, deploys e coletas reais devem fazer parte do pedido autorizado;
  nao os execute como efeito colateral de uma alteracao local.
- No ambiente Windows do mantenedor, siga
  `C:\Users\santi\.codex\RTK.md`. Prefixe comandos de shell com `rtk`;
  use `rtk proxy <comando>` quando precisar da saida sem filtros.

## Projeto e estrutura

O Observatorio de Porto Velho e uma iniciativa civica independente, informativa
e sem propaganda eleitoral. Os modulos atuais sao Obras, Contratos e Receitas.
A aplicacao usa Next.js App Router, React, TypeScript, Zod e PostgreSQL; a
publicacao executa Next.js no Cloudflare Workers por meio do OpenNext.

| Caminho                | Responsabilidade                              |
| ---------------------- | --------------------------------------------- |
| `src/app/`             | Paginas, rotas, metadados e estilos globais   |
| `src/components/`      | Componentes compartilhados e navegacao        |
| `src/features/`        | Apresentacao e regras de cada modulo          |
| `src/lib/`             | Leitura no servidor, esquemas e normalizacao  |
| `scripts/`             | Coletores e exportacoes locais                |
| `supabase/migrations/` | Evolucao versionada do banco                  |
| `tests/`               | Comportamentos criticos e fixtures sinteticas |
| `docs/`                | Fontes, arquitetura, metodo e operacao        |

Consulte `docs/arquitetura.md`, `docs/fontes.md` e `docs/esquema.md` para o
dominio; `docs/contratos.md` e `docs/receitas.md` para os modulos; e
`docs/supabase.md` e `docs/cloudflare.md` para operacao. Confira afirmacoes
historicas da documentacao contra o codigo e a configuracao atuais.

## Leitura dos dados

- Paginas e downloads consultam a base persistida durante a
  requisicao. Use os carregadores existentes e `src/lib/database.ts`.
- Preserve `server-only`, `connection()`, validacao Zod e o isolamento das
  consultas por requisicao. React `cache` compartilha a leitura dentro da
  renderizacao; nao deve conservar snapshots entre requisicoes.
- Os arquivos de `data/` e `data/exports/` servem para ingestao, bootstrap e
  auditoria. Nao os importe nas paginas nem os publique como base estatica.
- Os downloads em `src/app/dados/[file]/route.ts` usam o mesmo leitor do banco.
  Falhas de leitura nao devem gerar fallback silencioso para JSON antigo.
- `SUPABASE_URL` e `SUPABASE_SECRET_KEY` pertencem ao servidor e aos coletores.
  Nunca exponha chaves secretas com `NEXT_PUBLIC_`, em bundles ou em logs.
  Preserve o schema privado, RLS e as permissoes restritas das RPCs.
- `DATABASE_PROVIDER=postgres` seleciona a VPS. No Worker, use Hyperdrive;
  no Node.js, use `DATABASE_URL` e a CA publica `DATABASE_SSL_CA`, com TLS
  verificado. Nunca use a conta administrativa no site ou no coletor.
- O site usa `observatory_reader`; a coleta usa `observatory_ingestor`.
  `db:setup` e `db:seed` sao operacoes manuais, nunca etapas de deploy/sync.
  A nova base foi planejada a partir dos snapshots locais, sem copiar o
  historico exclusivo do Supabase. O provedor antigo exige escolha explicita.

## Integridade e interpretacao

- Preserve IDs oficiais, links de origem, datas e limites de cobertura.
- Valores monetarios usam centavos. `null` significa ausente; zero publicado
  continua zero. Receitas negativas permanecem negativas.
- Contratado, pago e executado tem significados distintos. Nao estime progresso
  fisico dividindo valores financeiros nem atribua irregularidade por inferencia.
- Relacione obra e contrato pelo ID oficial publicado. CNPJ, nomes ou valores
  semelhantes nao comprovam vinculo documental.
- Registros ausentes na coleta permanecem historicos com `inLatestSnapshot=false`
  e ficam fora dos totais atuais. Falhas da origem preservam a ultima base valida.
- Nao corrija snapshots manualmente nem introduza dados ficticios na interface.
  Ajuste transformacoes com evidencia e mantenha fixtures sinteticas nos testes.

## Deploy e coleta

- `.github/workflows/deploy.yml` valida, constroi e publica o codigo no push
  em `main` ou por acionamento manual. Usa a base existente, sem sync ou exportacao.
- `.github/workflows/sync-data.yml` atualiza Obras, Contratos e Receitas somente
  por `workflow_dispatch`, sem build ou deploy. Nao ha coleta agendada.
- Nao adicione sync ao deploy. Mudancas de dados persistidas passam a aparecer
  na proxima consulta ao site, sem reconstruir a aplicacao.
- `npm run data:export` e uma ferramenta local opcional, nao uma etapa de deploy.
- O build Cloudflare gera `.open-next/worker.js` e `.open-next/assets`.
  A aplicacao atual nao usa `output: "export"` nem publica `out/`.
- O patch OpenNext em `patches/` e aplicado pelo `postinstall`. Ao atualizar o
  adaptador ou o Next.js, valide a necessidade do patch e o runtime Workers.

## Comandos e verificacao

Use Node.js >=22 e as versoes fixadas em `package-lock.json`. No ambiente com
RTK, execute os comandos abaixo com o prefixo descrito anteriormente.

| Comando                    | Uso                                        |
| -------------------------- | ------------------------------------------ |
| `npm ci`                   | Instalar dependencias e aplicar os patches |
| `npm run db:local`         | PostgreSQL local no Docker com snapshots   |
| `npm run dev`              | Desenvolvimento local com `.env.local`     |
| `npm run typecheck`        | Validacao TypeScript                       |
| `npm test`                 | Testes de dominio, leitores e ingestao     |
| `npm run build`            | Build Next.js                              |
| `npm start`                | Servir o build Next.js localmente          |
| `npm run build:cloudflare` | Gerar o pacote OpenNext para Workers       |
| `npm run deploy:check`     | Validar o pacote com dry-run, sem publicar |
| `npm run preview`          | Executar o Worker local com `.env.local`   |

Dimensione a verificacao ao risco: documentacao exige revisao de caminhos,
formatacao e `git diff --check`; codigo exige typecheck e testes pertinentes;
alteracoes de build ou hospedagem exigem build Cloudflare e dry-run. Em mudancas
visuais, confira desktop, celular, navegacao e acessibilidade.

Informe o que foi validado e o que nao foi executado. Testes locais, build e
dry-run nao comprovam CI remoto nem publicacao. Nao execute uma coleta real
apenas para validar uma mudanca de interface, documentacao ou deploy.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
