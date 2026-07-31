# 腾讯云普通用户认证部署

## 数据库

先应用 `0001_initial_schema.sql`，再应用 `0002_user_auth.sql`。生产环境必须配置
`DATABASE_URL`，SQLite 仅用于本地开发和测试。不要修改已经应用过的 migration。

## Nginx 可信代理

应用不信任浏览器传入的 `Forwarded` 或 `X-Forwarded-For`。Nginx 必须覆盖以下请求头，
其中私密值与 CVM 进程的 `TRUSTED_PROXY_HEADER_SECRET` 完全一致：

```nginx
location / {
    # Server Actions allow 22 MB so multipart metadata has headroom;
    # application validation still limits each attachment to 20 MiB.
    client_max_body_size 22m;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Polysaccharide-Proxy-Secret "replace_with_random_secret";
    proxy_set_header X-Forwarded-For "";
    proxy_pass http://127.0.0.1:3100;
}
```

该私密标记不得暴露给客户端或写入 Git。CVM 防火墙只允许 Nginx 访问 Next.js 端口。

## 腾讯云 SES

开发和测试环境使用 `AUTH_EMAIL_MODE=development`，邮件只保存在当前 Node.js 进程的
短时内存 adapter 中，不写入数据库或文件；服务器日志不会记录令牌。进程重启后测试邮件消失。
生产环境若未设置 `AUTH_EMAIL_MODE=tencent-ses`，应用会拒绝执行邮件发送。

生产环境设置 `AUTH_EMAIL_MODE=tencent-ses`，并在 CVM 安全环境变量中配置 SES 凭据、
已验证发件地址、区域和模板 ID。模板 JSON 参数为 `action_url` 和 `purpose`。
`APP_BASE_URL` 必须是正式 HTTPS 域名。腾讯云 Secret 只授予 SES 发信所需的最小权限。
