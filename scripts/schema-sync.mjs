// Reconcile the legacy manually applied releases, then use the real journal.
// No reset, data deletion, hash rewriting, or schema push. Default: rollback.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
const apply = process.argv.includes('--apply');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL,
 ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
await client.connect();
try {
 await client.query('BEGIN');
 await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s'");
 await client.query("SELECT pg_advisory_xact_lock(hashtext('qurtiz-schema-sync'))");
 const entries = JSON.parse(fs.readFileSync('src/db/migrations/meta/_journal.json')).entries;
 const history = (await client.query('select hash,created_at from drizzle.__drizzle_migrations')).rows;
 // This reconciler deliberately requires the established 0000–0016 baseline.
 // New databases should use db:migrate instead.
 if(entries.slice(0,17).some(e=>!history.some(h=>Number(h.created_at)===e.when))) throw Error('Missing baseline: use the normal migrator on a new database.');
 const before = {};
 const tables=(await client.query("select tablename from pg_tables where schemaname='public'")).rows;
 for(const {tablename} of tables) before[tablename]=Number((await client.query(`select count(*) from public."${tablename.replaceAll('"','""')}"`)).rows[0].count);
 for(const e of entries.slice(17)) {
   if(history.some(h=>Number(h.created_at)===e.when)) continue;
   const source=fs.readFileSync(`src/db/migrations/${e.tag}.sql`,'utf8');
   if(e.idx===17) {
     // The old one-off deployment added this column/index without recording 0017.
     const col=(await client.query("select data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='publishing_jobs' and column_name='provider_post_id'")).rows[0];
     if(col) {
       if(col.data_type!=='text'||col.is_nullable!=='YES') throw Error('Unexpected provider_post_id definition');
       await client.query('CREATE INDEX IF NOT EXISTS publishing_jobs_provider_post_id_idx ON public.publishing_jobs(provider_post_id)');
     } else await client.query(source);
   } else {
     // 0019–0025 explicitly support replay. 0018 and 0026–0028 must be absent
     // or fully recorded; partial DDL fails and rolls the entire batch back.
     await client.query(source);
   }
   await client.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)',[crypto.createHash('sha256').update(source).digest('hex'),e.when]);
   console.log(`${apply?'APPLY':'VALIDATE'} ${e.tag}`);
 }
 for(const [table,count] of Object.entries(before)) {
   const after=Number((await client.query(`select count(*) from public."${table.replaceAll('"','""')}"`)).rows[0].count);
   if(after<count) throw Error(`Row count decreased: ${table}`);
 }
 await client.query(apply?'COMMIT':'ROLLBACK');
 console.log(apply?'Committed. All existing table row counts preserved.':'Dry run passed; rolled back all changes.');
} catch(error) {
 await client.query('ROLLBACK');
 console.error('Schema sync stopped:',error.code??'',error.message);
 process.exitCode=1;
} finally { await client.end(); }
