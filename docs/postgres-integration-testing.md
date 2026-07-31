# PostgreSQL integration testing

This check requires a disposable PostgreSQL database with the initial migration already applied.
Never point it at production or a database containing valuable data.

1. Apply `migrations/postgres/0001_initial_schema.sql` to an empty test database.
2. Set `TEST_POSTGRES_DATABASE_URL` to that database only.
3. Set `POSTGRES_SSL=require` for a certificate-verified TLS connection, or
   `POSTGRES_SSL=disable` only on a trusted Tencent Cloud private network.
4. Run `npm run test:postgres:integration`.

The script uses two independent connections. The first holds a `FOR UPDATE` lock;
the second must time out with PostgreSQL error `55P03`, then update successfully
after the first connection releases the lock. It also checks the sequence-backed
`sort_order` and case-insensitive email uniqueness. A temporary prefixed record is
committed so both connections can see it and is deleted in `finally`; use only a
disposable test database in case the process is interrupted before cleanup.

This command is intentionally excluded from the normal test suite because it
requires real PostgreSQL credentials. Before production launch, repeat the same
concurrent lock test against the Tencent Cloud staging topology and retain the
command output as deployment acceptance evidence.
