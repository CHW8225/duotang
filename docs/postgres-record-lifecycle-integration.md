# PostgreSQL record lifecycle integration test

此可选检查只能针对空白或一次性（disposable）PostgreSQL 测试数据库运行，严禁连接生产数据库。测试库必须已经按顺序应用 `0001` 至 `0005` migration。

1. 将 `TEST_DATABASE_URL` 设置为一次性测试数据库连接字符串。
2. 按测试实例要求配置 `POSTGRES_SSL`。
3. 运行 `npm run test:postgres:record-lifecycle`。

脚本使用两个独立连接验证软删除和恢复的行锁竞争，并验证审计插入失败时数据修改整体回滚。它还检查 `deleted_at` 的 `TIMESTAMPTZ` 类型和 `changed_fields` 的 `JSONB` 类型。临时记录与审计日志使用随机 ID，并在 `finally` 中清理。

未配置 `TEST_DATABASE_URL` 时，命令会输出 `SKIP` 并成功退出。这只表示未运行真实 PostgreSQL 检查，不能报告为集成测试通过。
