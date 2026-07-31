import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFile(join(root, path), "utf8");

describe("Tencent Cloud deployment contract", () => {
  it("pins migration, status, and deployment contract commands", async () => {
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.scripts["db:migrate"]).toBeTruthy();
    expect(pkg.scripts["db:status"]).toBeTruthy();
    expect(pkg.scripts["test:deployment-contract"]).toBeTruthy();
  });

  it("provides hardened HTTPS reverse proxy configuration", async () => {
    const nginx = await read("deploy/nginx/polysaccharide.conf");
    expect(nginx).toMatch(/listen 443 ssl/);
    expect(nginx).toMatch(/client_max_body_size 22m/);
    expect(nginx).toMatch(/proxy_set_header Host \$host/);
    expect(nginx).toMatch(/X-Forwarded-Host/);
    expect(nginx).toMatch(/X-Polysaccharide-Proxy-Secret/);
    expect(nginx).toMatch(/proxy_pass http:\/\/127\.0\.0\.1:3100/);
    expect(nginx).toMatch(/X-Content-Type-Options/);
    expect(nginx).toMatch(/Strict-Transport-Security/);
    expect(nginx).toMatch(/location = \/api\/ready[\s\S]*allow 127\.0\.0\.1[\s\S]*allow ::1[\s\S]*deny all/);
    expect(nginx).toMatch(/location = \/api\/ready[\s\S]*proxy_pass http:\/\/127\.0\.0\.1:3100/);
  });

  it("runs the app as an unprivileged systemd service with readiness checks", async () => {
    const service = await read("deploy/systemd/polysaccharide.service");
    expect(service).toMatch(/User=polysaccharide/);
    expect(service).toMatch(/EnvironmentFile=\/etc\/polysaccharide\/app\.env/);
    expect(service).toMatch(/ExecStart=.*npm.*start/);
    expect(service).toMatch(/NoNewPrivileges=true/);
    const deploy = await read("docs/tencent-cloud-deployment.md");
    expect(deploy).toMatch(/\/api\/ready/);
    expect(deploy).toMatch(/db:migrate/);
  });

  it("schedules both import and COS cleanup without embedding secrets", async () => {
    const cron = await read("deploy/cron/polysaccharide-cleanup");
    expect(cron).toMatch(/cleanup-imports/);
    expect(cron).toMatch(/cleanup-cos/);
    expect(cron).toMatch(/curl --config \/etc\/polysaccharide\/cleanup-imports\.curl/);
    expect(cron).toMatch(/curl --config \/etc\/polysaccharide\/cleanup-cos\.curl/);
    expect(cron).not.toMatch(/Authorization|Bearer|CRON_SECRET|--header/);
  });

  it("documents private cloud resources, least privilege, backup, and required inputs", async () => {
    const deploy = await read("docs/tencent-cloud-deployment.md");
    const backup = await read("docs/tencent-cloud-backup-restore.md");
    expect(deploy).toMatch(/PostgreSQL[\s\S]*私网/);
    expect(deploy).toMatch(/COS[\s\S]*私有/);
    expect(deploy).toMatch(/SES[\s\S]*沙箱[\s\S]*生产/);
    expect(deploy).toMatch(/域名[\s\S]*CVM[\s\S]*PostgreSQL[\s\S]*COS[\s\S]*SES/);
    expect(backup).toMatch(/SQLite/);
    expect(backup).toMatch(/PostgreSQL/);
    expect(backup).toMatch(/每日/);
    expect(backup).toMatch(/恢复演练/);
  });

  it("loads migration credentials through systemd without sourcing an env file", async () => {
    const deploy = await read("docs/tencent-cloud-deployment.md");
    expect(deploy).toMatch(/systemd-run[\s\S]*--uid=polysaccharide[\s\S]*EnvironmentFile=\/etc\/polysaccharide\/app\.env[\s\S]*npm run db:status/);
    expect(deploy).toMatch(/systemd-run[\s\S]*npm run db:migrate/);
    expect(deploy).not.toMatch(/source \/etc\/polysaccharide\/app\.env/);
  });

  it("pins LF endings for migration SQL and provides a real PostgreSQL migration check", async () => {
    expect(await read(".gitattributes")).toMatch(/\*\.sql text eol=lf/);
    const script = await read("scripts/verify-postgres-migrations.ts");
    expect(script).toMatch(/TEST_DATABASE_URL/);
    expect(script).toMatch(/SKIP/);
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.scripts["test:postgres:migrations"]).toBeTruthy();
  });
});
