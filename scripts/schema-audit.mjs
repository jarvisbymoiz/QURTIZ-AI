import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
const url = new URL(process.env.DATABASE_URL);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: /localhost|127\.0\.0\.1/.test(url.hostname) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
await client.connect();
try {
 const journal = JSON.parse(fs.readFileSync('src/db/migrations/meta/_journal.json')).entries;
 const history = (await client.query('select id, hash, created_at from drizzle.__drizzle_migrations order by created_at')).rows;
 console.log(JSON.stringify({ databaseHost: url.hostname, supabaseProject: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, cronSecretConfigured: Boolean(process.env.CRON_SECRET), workerDisabled: process.env.DISABLE_BACKGROUND_WORKER === 'true', migrations: journal.map(e => ({ tag:e.tag, when:e.when, recorded:history.some(h=>Number(h.created_at)===e.when), hashMatches:history.some(h=>h.hash===crypto.createHash('sha256').update(fs.readFileSync(`src/db/migrations/${e.tag}.sql`)).digest('hex')) })), historyCount:history.length }, null, 2));
 const latest=String(journal.at(-1).idx).padStart(4,'0');
 const snapshot=JSON.parse(fs.readFileSync(`src/db/migrations/meta/${latest}_snapshot.json`));
 const cols=(await client.query("select table_name,column_name,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public'")).rows;
 const missing=[];
 for(const t of Object.values(snapshot.tables)) for(const c of Object.values(t.columns)) if(!cols.some(x=>x.table_name===t.name&&x.column_name===c.name)) missing.push(`${t.name}.${c.name}`);
 console.log('MISSING_COLUMNS',JSON.stringify(missing));
 console.log('TABLE_SECURITY', JSON.stringify((await client.query("select c.relname, c.relrowsecurity, has_table_privilege('anon',c.oid,'SELECT') anon_read, has_table_privilege('authenticated',c.oid,'SELECT') authenticated_read from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname")).rows));
 console.log('JOBS',JSON.stringify((await client.query("select status, count(*), min(scheduled_at), max(updated_at) from publishing_jobs group by status")).rows));
 console.log('EXTENSIONS',JSON.stringify((await client.query('select extname from pg_extension')).rows));
 console.log('QUEUE_SCHEMA',JSON.stringify((await client.query("select schema_name from information_schema.schemata where schema_name in ('pgboss','cron')")).rows));
 console.log('STORAGE_POLICIES',JSON.stringify((await client.query("select policyname from pg_policies where schemaname='storage' and policyname like 'qurtiz%'")).rows));
 console.log('INDEXES',JSON.stringify((await client.query("select tablename,indexname from pg_indexes where schemaname='public'")).rows));
 console.log('PG_BOSS',JSON.stringify((await client.query('select name, cron, timezone from pgboss.schedule')).rows));
 console.log('HASH_LF_MATCHES',journal.filter(e=>history.some(h=>Number(h.created_at)===e.when&&h.hash===crypto.createHash('sha256').update(fs.readFileSync(`src/db/migrations/${e.tag}.sql`,'utf8').replace(/\r\n/g,'\n')).digest('hex'))).map(e=>e.tag));
} finally { await client.end(); }
