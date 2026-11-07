-- Schema fingerprint (W1): one row per column, constraint, index, policy, function body, grant,
-- trigger, view, enum, bucket, Realtime table and extension of the public/private schemas.
-- Run it on two databases and diff the outputs; read-only (system catalogs only).
with ns as (select oid, nspname from pg_namespace where nspname in ('public','private'))
select kind, name, h from (
  select 'column' kind, ns.nspname||'.'||c.relname||'.'||a.attname name,
         md5(concat_ws('|', format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid), array_to_string(a.attacl, ','))) h
  from pg_attribute a join pg_class c on c.oid = a.attrelid join ns on ns.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where c.relkind in ('r','p','v','m') and a.attnum > 0 and not a.attisdropped
  union all
  select 'relation', ns.nspname||'.'||c.relname, md5(concat_ws('|', c.relkind, c.relrowsecurity, c.relforcerowsecurity, array_to_string(c.relacl, ',')))
  from pg_class c join ns on ns.oid = c.relnamespace where c.relkind in ('r','p','v','m','S')
  union all
  select 'constraint', ns.nspname||'.'||cl.relname||'.'||co.conname, md5(pg_get_constraintdef(co.oid))
  from pg_constraint co join pg_class cl on cl.oid = co.conrelid join ns on ns.oid = cl.relnamespace
  union all
  select 'index', schemaname||'.'||indexname, md5(indexdef) from pg_indexes where schemaname in ('public','private')
  union all
  select 'policy', schemaname||'.'||tablename||'.'||policyname, md5(concat_ws('|', permissive, roles::text, cmd, qual, with_check))
  from pg_policies where schemaname in ('public','private','storage')
  union all
  select 'function', ns.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
         md5(concat_ws('|', p.prosrc, p.prosecdef, array_to_string(p.proconfig, ','), array_to_string(p.proacl, ','), pg_get_function_result(p.oid)))
  from pg_proc p join ns on ns.oid = p.pronamespace
  union all
  select 'trigger', ns.nspname||'.'||c.relname||'.'||t.tgname, md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join ns on ns.oid = c.relnamespace where not t.tgisinternal
  union all
  select 'view', ns.nspname||'.'||c.relname, md5(pg_get_viewdef(c.oid)) from pg_class c join ns on ns.oid = c.relnamespace where c.relkind in ('v','m')
  union all
  select 'enum', t.typname, md5(string_agg(e.enumlabel, ',' order by e.enumsortorder))
  from pg_type t join pg_enum e on e.enumtypid = t.oid join ns on ns.oid = t.typnamespace group by t.typname
  union all
  select 'bucket', id, md5(concat_ws('|', public, file_size_limit, array_to_string(allowed_mime_types, ','))) from storage.buckets
  union all
  select 'publication', schemaname||'.'||tablename, 'realtime' from pg_publication_tables where pubname = 'supabase_realtime'
  union all
  select 'extension', extname, 'present' from pg_extension
) x order by kind, name;
