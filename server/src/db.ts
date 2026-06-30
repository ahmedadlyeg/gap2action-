/**
 * db.ts — PostgreSQL via the `pg` package.
 * Provides an async interface similar to the old SQLite shim.
 */
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

/** Convert SQLite ? placeholders to PostgreSQL $1, $2, … */
function toPositional(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Flatten variadic / single-array call conventions */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(args: any[]): any[] | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

type Executor = Pick<Pool | PoolClient, 'query'>;

class Stmt {
  constructor(
    private readonly executor: Executor,
    private readonly pgSql: string,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(...args: any[]): Promise<any> {
    const { rows } = await this.executor.query(this.pgSql, normalise(args));
    return rows[0] ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async all(...args: any[]): Promise<any[]> {
    const { rows } = await this.executor.query(this.pgSql, normalise(args));
    return rows;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(...args: any[]): Promise<{ changes: number }> {
    const result = await this.executor.query(this.pgSql, normalise(args));
    return { changes: result.rowCount ?? 0 };
  }
}

export type TxDb = { prepare(sql: string): Stmt };

class DB {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host:     process.env.PG_HOST     ?? 'localhost',
      port:     Number(process.env.PG_PORT ?? 5432),
      database: process.env.PG_DATABASE ?? 'nudj_db',
      user:     process.env.PG_USER     ?? 'postgres',
      password: process.env.PG_PASSWORD ?? '',
    });

    this.pool.on('error', (err) => {
      console.error('[pg] unexpected idle client error', err.message);
    });
  }

  /** no-op — SQLite PRAGMAs not needed in PostgreSQL */
  pragma(_str: string) { /* no-op */ }

  /** Execute raw SQL (no params) */
  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  /** Return a lazy statement that runs against the shared pool */
  prepare(sql: string): Stmt {
    return new Stmt(this.pool, toPositional(sql));
  }

  /**
   * Run fn inside BEGIN/COMMIT/ROLLBACK.
   * fn receives txDb whose .prepare() binds to the same client connection.
   */
  async transaction(fn: (txDb: TxDb) => Promise<void>): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txDb: TxDb = {
        prepare: (sql: string) => new Stmt(client, toPositional(sql)),
      };
      await fn(txDb);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

const db = new DB();
export default db;
