# PostgreSQL user-library integration test

This optional check must run only against an empty or disposable PostgreSQL test database with migrations `0001` through `0003` applied. Never use a production database.

1. Set `TEST_DATABASE_URL` to the disposable database connection string.
2. Configure `POSTGRES_SSL` as required by the test instance.
3. Run `npm run test:postgres:user-library`.

The script opens two independent connections and verifies the concurrent 50th/51st saved-search limit, transaction rollback, row locking, and the favorite versus soft-delete race. All temporary rows use generated identifiers and are removed in `finally`.

When `TEST_DATABASE_URL` is absent, the command prints `SKIP` and exits successfully. This means no real PostgreSQL verification occurred; it must not be reported as a passing integration run.
