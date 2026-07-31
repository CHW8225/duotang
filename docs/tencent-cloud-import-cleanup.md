# 腾讯云 CVM 导入预览清理

导入预览保留 30 天。应用提供仅接受 `POST` 的内部清理接口：

```text
/api/internal/cleanup-imports
```

在 CVM 的安全环境文件中设置独立随机值 `CRON_SECRET`，不要提交到 Git。每天凌晨执行：

```cron
17 3 * * * . /etc/polysaccharide/cron.env && curl --fail --silent --show-error --request POST --header "Authorization: Bearer ${CRON_SECRET}" https://数据库域名/api/internal/cleanup-imports
```

`/etc/polysaccharide/cron.env` 应设置为仅 root 可读，并包含 `CRON_SECRET=...`。不要把真实密钥直接写入 crontab。接口删除超过 30 天的 `import_jobs`，数据库外键会级联删除对应 `import_job_rows`。上传时也会执行一次相同清理，作为每日任务之外的补充。
