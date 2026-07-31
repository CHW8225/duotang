# 腾讯云 CVM 导入预览清理

导入预览保留 30 天。应用提供仅接受 `POST` 的内部清理接口：

```text
/api/internal/cleanup-imports
```

使用 root 所有、权限 `600` 的 `/etc/polysaccharide/cleanup-imports.curl` 保存固定 HTTPS URL、POST 方法和 Authorization header。密钥不得写入 crontab 或命令参数。安全创建方式见 `docs/tencent-cloud-deployment.md`。每天凌晨执行：

```cron
17 3 * * * root curl --config /etc/polysaccharide/cleanup-imports.curl
```

不要通过 `echo`、shell history 或进程 argv 写入真实密钥。接口删除超过 30 天的 `import_jobs`，数据库外键会级联删除对应 `import_job_rows`。上传时也会执行一次相同清理，作为每日任务之外的补充。
