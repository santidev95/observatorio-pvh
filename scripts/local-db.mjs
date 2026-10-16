// Prepara o PostgreSQL de desenvolvimento (ops/local/compose.yaml) com os
// snapshots versionados. Nao consulta a API municipal, a VPS nem o Supabase.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const compose = ["compose", "-f", "ops/local/compose.yaml"];
const adminFile = ".env.postgres-admin.local";
const readerFile = ".env.postgres.local";
const ingestorFile = ".env.postgres-sync.local";
const port = process.env.LOCAL_POSTGRES_PORT || "55432";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Falha ao executar: ${command} ${args.join(" ")}`);
  return result.stdout;
}

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const value = line.slice(index + 1);
        return [
          line.slice(0, index),
          value.startsWith('"') ? JSON.parse(value) : value,
        ];
      }),
  );
}

const reset = `docker compose -f ops/local/compose.yaml down -v
rm .env.local ${readerFile} ${ingestorFile} ${adminFile}`;

const docker = spawnSync("docker", [...compose, "version"], {
  stdio: "ignore",
});
if (docker.error || docker.status !== 0) {
  console.error(
    "Docker com o plugin compose nao encontrado. Instale e inicie o Docker antes de preparar a base local.",
  );
  process.exit(1);
}

if (existsSync(".env.local")) {
  console.error(
    ".env.local ja existe; remova-o ou renomeie-o antes de preparar a base local.",
  );
  process.exit(1);
}

let password;
if (existsSync(adminFile)) {
  password = new URL(parseEnv(await readFile(adminFile, "utf8")).DATABASE_URL)
    .password;
} else {
  password = randomBytes(24).toString("hex");
}

run("docker", [...compose, "up", "-d", "--wait"], {
  env: { POSTGRES_PASSWORD: password, LOCAL_POSTGRES_PORT: port },
});
const ca = run(
  "docker",
  [...compose, "exec", "-T", "postgresql", "cat", "/etc/postgresql/tls/ca.crt"],
  { capture: true, env: { POSTGRES_PASSWORD: password } },
);
const admin = {
  DATABASE_PROVIDER: "postgres",
  DATABASE_URL: `postgresql://observatorio_admin:${password}@127.0.0.1:${port}/observatorio_pvh`,
  DATABASE_SSL_CA: ca.replaceAll("\r\n", "\n"),
};
await writeFile(
  adminFile,
  `DATABASE_PROVIDER=postgres\nDATABASE_URL=${admin.DATABASE_URL}\nDATABASE_SSL_CA=${JSON.stringify(admin.DATABASE_SSL_CA)}\n`,
);

if (existsSync(readerFile) && existsSync(ingestorFile)) {
  console.log("Base local ja preparada; reutilizando as credenciais locais.");
} else {
  run("node", ["--import", "tsx", "scripts/setup-postgres.ts", "--apply"], {
    env: admin,
  });
  try {
    run("node", ["--import", "tsx", "scripts/seed-postgres.ts", "--apply"], {
      env: parseEnv(await readFile(ingestorFile, "utf8")),
    });
  } catch (error) {
    // O schema ja foi criado; sem recomecar, a proxima execucao pularia o seed.
    console.error(`Importacao dos snapshots falhou. Recomece com:\n${reset}`);
    throw error;
  }
}

await copyFile(readerFile, ".env.local");
console.log(
  `Base local pronta em 127.0.0.1:${port}. Execute npm run dev. Para remover: docker compose -f ops/local/compose.yaml down -v`,
);
