-- Optional read-only checks AFTER schema.sql is applied. Every passed value
-- should be true. These metadata checks supplement, not replace, two-user tests.
select 'profiles RLS enabled' as check_name, relrowsecurity as passed
  from pg_class where oid = 'public.profiles'::regclass
union all
select 'applications RLS enabled', relrowsecurity
  from pg_class where oid = 'public.authority_applications'::regclass
union all
select 'own name update privilege', has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
union all
select 'no role update', not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
union all
select 'no verification update', not has_column_privilege('authenticated', 'public.profiles', 'authority_status', 'UPDATE')
union all
select 'no organization update', not has_column_privilege('authenticated', 'public.profiles', 'organization', 'UPDATE')
union all
select 'no profile insert', not has_any_column_privilege('authenticated', 'public.profiles', 'INSERT')
union all
select 'no profile delete', not has_table_privilege('authenticated', 'public.profiles', 'DELETE')
union all
select 'no browser IIN read', not has_column_privilege('authenticated', 'public.authority_applications', 'iin', 'SELECT')
union all
select 'no application status insert', not has_column_privilege('authenticated', 'public.authority_applications', 'status', 'INSERT')
union all
select 'no application user_id insert', not has_column_privilege('authenticated', 'public.authority_applications', 'user_id', 'INSERT')
union all
select 'no application update', not has_any_column_privilege('authenticated', 'public.authority_applications', 'UPDATE')
union all
select 'no anonymous profiles read', not has_any_column_privilege('anon', 'public.profiles', 'SELECT')
union all
select 'no anonymous applications read', not has_any_column_privilege('anon', 'public.authority_applications', 'SELECT')
union all
select 'no signup function RPC', not has_function_privilege('authenticated', 'public.aitu_create_citizen_profile()', 'EXECUTE');
