import fs from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
const db=new pg.Client({ connectionString:process.env.DATABASE_URL, ssl:/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false},connectionTimeoutMillis:15000 });
await db.connect();
try {
 const journal=JSON.parse(fs.readFileSync('src/db/migrations/meta/_journal.json')).entries;
 const latest=String(journal.at(-1).idx).padStart(4,'0');
 const snapshot=JSON.parse(fs.readFileSync(`src/db/migrations/meta/${latest}_snapshot.json`));
 const columns=(await db.query(`select c.relname as tab,a.attname as col,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as required,pg_get_expr(d.adbin,d.adrelid) as default_value from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname='public' and a.attnum>0 and not a.attisdropped and c.relkind='r'`)).rows;
 const indexes=(await db.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public'")).rows;
 const constraints=(await db.query("select conrelid::regclass::text as tab,conname,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='public'::regnamespace")).rows;
 const enums=(await db.query("select t.typname,array_agg(e.enumlabel::text order by e.enumsortorder) as labels from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname")).rows;
 const problems=[];
 const history=(await db.query('select created_at from drizzle.__drizzle_migrations')).rows;
 for(let i=0;i<journal.length;i++) {
  const entry=journal[i];
  if(history.filter(h=>Number(h.created_at)===entry.when).length!==1) problems.push(`migration history ${entry.tag}`);
  if(i>0&&entry.when<=journal[i-1].when) problems.push(`migration ordering ${entry.tag}`);
 }
 const normalizeDefault = value => String(value).replace(/::[a-zA-Z_][a-zA-Z_0-9]*(\[\])?/g,'').replace(/\s/g,'');
 for(const t of Object.values(snapshot.tables)) {
  for(const c of Object.values(t.columns)) {
   const live=columns.find(x=>x.tab===t.name&&x.col===c.name);
   if(!live) {problems.push(`missing ${t.name}.${c.name}`);continue;}
   if(live.type.replaceAll(' ','')!==c.type.replace('varchar','character varying').replaceAll(' ','')) problems.push(`type ${t.name}.${c.name}: ${live.type} != ${c.type}`);
   if(live.required!==c.notNull) problems.push(`nullability ${t.name}.${c.name}`);
   if(c.default!==undefined && live.default_value===null) problems.push(`missing default ${t.name}.${c.name}`);
   else if(c.default!==undefined && normalizeDefault(live.default_value)!==normalizeDefault(c.default)) problems.push(`default ${t.name}.${c.name}`);
  }
  for(const idx of Object.values(t.indexes)) if(!indexes.some(x=>x.tablename===t.name&&x.indexname===idx.name)) problems.push(`index ${t.name}.${idx.name}`);
  const primary=Object.values(t.columns).filter(c=>c.primaryKey).map(c=>c.name);
  for(const pk of Object.values(t.compositePrimaryKeys)) primary.push(...pk.columns);
  if(primary.length&&!constraints.some(x=>x.tab===t.name&&x.definition===`PRIMARY KEY (${primary.join(', ')})`)) problems.push(`primary key ${t.name}`);
  for(const fk of Object.values(t.foreignKeys)) {
   const expected=`FOREIGN KEY (${fk.columnsFrom.join(', ')}) REFERENCES ${fk.tableTo}(${fk.columnsTo.join(', ')})${fk.onDelete==='no action'?'':` ON DELETE ${fk.onDelete.toUpperCase()}`}`;
   if(!constraints.some(x=>x.tab===t.name&&x.definition===expected)) problems.push(`foreign key ${fk.name}: ${expected}`);
  }
 }
 for(const e of Object.values(snapshot.enums)) if(JSON.stringify(enums.find(x=>x.typname===e.name)?.labels)!==JSON.stringify(e.values)) problems.push(`enum ${e.name}`);
 const security=(await db.query("select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') browser_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows;
 for(const t of security) if(!t.relrowsecurity||t.anon_access||t.browser_access) problems.push(`security ${t.relname}`);
 const functions=(await db.query("select proname,prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon_access from pg_proc where pronamespace='public'::regnamespace and proname in ('qurtiz_storage_access','qurtiz_agent_access','qurtiz_protect_identity')")).rows;
 for(const name of ['qurtiz_storage_access','qurtiz_agent_access']) {
  const fn=functions.find(f=>f.proname===name);
  if(!fn?.prosecdef||!fn.proconfig?.some(c=>c.startsWith('search_path='))||fn.anon_access) problems.push(`function protection ${name}`);
 }
 const triggers=(await db.query("select tgname from pg_trigger where tgrelid='public.agent_identities'::regclass and tgenabled='O'")).rows;
 if(!triggers.some(t=>t.tgname==='agent_identity_immutable')) problems.push('identity immutability trigger');
 const policies=(await db.query("select policyname from pg_policies where schemaname='storage' and tablename='objects'")).rows;
 for(const name of ['read','insert','update','delete','read_boundary','insert_boundary','update_boundary','delete_boundary','anonymous_boundary']) if(!policies.some(p=>p.policyname===`qurtiz_storage_${name}`)) problems.push(`storage policy ${name}`);
 console.log(JSON.stringify({tables:Object.keys(snapshot.tables).length,columns:columns.length,indexes:indexes.length,constraints:constraints.length,enums:enums.length,problems},null,2));
 if(problems.length) process.exitCode=1;
} finally {await db.end();}

