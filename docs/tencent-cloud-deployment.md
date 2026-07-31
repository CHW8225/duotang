# 腾讯云部署与上线检查

## 前行者需要提供

部署前需要准备：已备案域名及 HTTPS 证书、CVM 地址与 SSH 管理权限、腾讯云 PostgreSQL 私网地址和应用账号、COS 私有 Bucket、SES 已验证域名/发件地址/模板。真实密码和 Secret 只写入 CVM 的 `/etc/polysaccharide/app.env`，绝不提交 Git。

## 云资源原则

- PostgreSQL：CVM 与数据库位于同地域 VPC，优先私网连接；安全组只允许 CVM 访问 5432。应用账号仅拥有目标 schema 的连接、建表、读写和 sequence 权限，不授予超级用户或其他数据库权限。云数据库要求 TLS 时使用 `POSTGRES_SSL=require`。
- COS：Bucket 必须私有；CAM 子账号仅允许指定 Bucket 前缀所需的上传、读取和补偿删除。附件经应用服务端代理，默认不需要浏览器直连 CORS；若未来启用浏览器直传，只允许正式 HTTPS 域名和必要方法/请求头，不使用 `*`。
- SES：开发先在沙箱验证收件地址、模板和退信处理；域名完成 SPF/DKIM 验证并通过生产审核后，才设置 `AUTH_EMAIL_MODE=tencent-ses` 对外开放注册。

## 首次部署

1. 在 CVM 安装受支持的 Node.js、Nginx 和 PostgreSQL client，创建不可登录用户 `polysaccharide`。
2. 将项目放入 `/srv/polysaccharide/current`，执行 `npm ci`、`npm run test:deployment-contract`、`npm run build`。
3. 由 root 从 `deploy/env/app.env.example` 创建 `/etc/polysaccharide/app.env`，属主设为 root、权限设为 `600`。不要在 shell 中 `source` 该文件，也不要让应用用户直接读取它。
4. 使用下面的 transient systemd unit 先执行 status，再执行 migrate。systemd 负责安全解析 EnvironmentFile，然后降权为 `polysaccharide` 用户；runner 使用 advisory lock，按 `0001–0008` 顺序执行，已应用文件 hash 变化会拒绝迁移。
5. 初次导入时执行 `npm run migrate:seed:postgres -- --source json`，并核对772条、42字段哈希；已迁移环境不得重复运行。
6. 安装 `deploy/systemd/polysaccharide.service`，执行 `systemctl daemon-reload && systemctl enable --now polysaccharide`。
7. 替换 Nginx 示例中的域名、证书路径和代理密钥，确保密钥与 app.env 完全一致；运行 `nginx -t` 后 reload。
8. 按“清理任务凭据”创建两个 curl 配置后安装 cron。公网检查 `/api/health`；仅在 CVM 本机使用 `--resolve` 检查 `/api/ready`。ready 的 Nginx exact location 仅允许 loopback，公网请求不会代理到应用。

## 数据库命令的安全环境加载

以下命令不启动 shell，也不执行环境文件中的内容：

```bash
sudo systemd-run --quiet --wait --pipe --collect --uid=polysaccharide --gid=polysaccharide --working-directory=/srv/polysaccharide/current --property=EnvironmentFile=/etc/polysaccharide/app.env /usr/bin/npm run db:status
sudo systemd-run --quiet --wait --pipe --collect --uid=polysaccharide --gid=polysaccharide --working-directory=/srv/polysaccharide/current --property=EnvironmentFile=/etc/polysaccharide/app.env /usr/bin/npm run db:migrate
```

## 清理任务凭据

Bearer header 只能保存在 root 专用的 curl 配置中，不能写入 crontab、命令参数或日志。使用空文件加 `sudoedit`，避免在终端回显密钥：

```bash
sudo install -o root -g root -m 600 /dev/null /etc/polysaccharide/cleanup-imports.curl
sudo install -o root -g root -m 600 /dev/null /etc/polysaccharide/cleanup-cos.curl
sudoedit /etc/polysaccharide/cleanup-imports.curl
sudoedit /etc/polysaccharide/cleanup-cos.curl
```

分别参考 `deploy/env/cleanup-imports.curl.example` 和 `cleanup-cos.curl.example` 填写正式 HTTPS URL 与同一个随机 `CRON_SECRET`。完成后用 `stat` 确认属主为 root、权限为 `600`，再安装 `deploy/cron/polysaccharide-cleanup`。

## 发布命令与验收

```bash
cd /srv/polysaccharide/current
npm ci
npm run test
npx tsc --noEmit --incremental false
npm run lint
npm run build
npm run verify:import
npm run test:deployment-contract
# 使用上文两条 systemd-run 命令执行 db:status 和 db:migrate
sudo systemctl restart polysaccharide
curl --fail https://database.example.cn/api/health
curl --fail --resolve database.example.cn:443:127.0.0.1 https://database.example.cn/api/ready
```

上线后检查注册验证邮件、管理员登录、检索与导出、附件上传下载、导入预览、两项清理任务和审计日志。CVM 仅开放 80/443 和受限来源的 SSH，3100 不对公网开放。
