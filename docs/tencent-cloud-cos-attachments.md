# 腾讯云 COS 附件部署与验证

COS Bucket 必须保持私有。CVM 使用最小权限子账号，通过环境变量提供 COS Secret、Bucket 和 Region。浏览器只访问应用下载路由。应用先短查询授权，再以30秒超时和20 MiB上限打开COS流，返回前重新查询授权；COS网络读取期间不持有数据库事务。签名 URL 不返回浏览器。

附件或父记录软删除后，新下载请求会立即被拒绝。已经开始向浏览器传输的响应无法物理撤回，因此敏感附件不应在公开后才依赖软删除作为唯一保密手段。

## 补偿清理

数据库写入失败且即时删除 COS 对象也失败时，对象键写入 `cos_cleanup_jobs`。使用 root 所有、权限 `600` 的 `/etc/polysaccharide/cleanup-cos.curl` 保存 URL、POST 方法和 Authorization header，密钥不得出现在 crontab 或进程 argv。安全创建方式见部署文档：

```cron
*/10 * * * * root curl --config /etc/polysaccharide/cleanup-cos.curl
```

连续失败会累计次数、保存最后错误并设置告警字段；每次成功或失败都会写入审计日志。运维监控必须对 `alert_required=true` 建立告警。

## 病毒扫描

应用已执行格式结构解析、图片完整解码、像素限制和 PDF 主动内容拒绝，但这不等同于病毒扫描。正式上线前必须在 CVM/COS 上传链路接入独立恶意软件扫描基础设施，并将未扫描或扫描失败对象隔离，不能直接公开。

## 可选真实集成测试

设置独立测试资源的 `TEST_DATABASE_URL`、`TEST_COS_SECRET_ID`、`TEST_COS_SECRET_KEY`、`TEST_COS_BUCKET`、`TEST_COS_REGION` 后运行 `npm run test:cloud:attachments`。任一变量缺失时脚本明确输出 `SKIP` 并退出成功。测试 Bucket 必须为私有专用 Bucket，脚本只使用随机 `integration-tests/` 前缀。
