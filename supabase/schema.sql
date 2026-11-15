-- Run once in a new Supabase project, then enable Anonymous Sign-Ins.
-- The public browser key alone grants no trip or document access.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.trips (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 200),
 invite_hash text unique not null,
 owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.trip_members (
 trip_id uuid not null references public.trips(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key (trip_id,user_id)
);
create table public.trip_records (
 trip_id uuid not null references public.trips(id) on delete cascade,
 id uuid not null,
 kind text not null check(kind in ('destination','activity','stay','idea','document','expense','settlement')),
 data jsonb not null check(jsonb_typeof(data)='object' and jsonb_typeof(data->'title')='string' and length(data->>'title')<=180),
 "by" text not null check("by" in ('gaba','janek','konrad','julia')),
 updated_at timestamptz not null default now(),
 deleted boolean not null default false,
 revision integer not null default 1,
 primary key(trip_id,id)
);
create index trip_records_trip_updated on public.trip_records(trip_id,updated_at);

create function public.can_access_trip(p_trip text) returns boolean
language sql stable security definer set search_path=public
as $$select exists(select 1 from public.trip_members where trip_id::text=p_trip and user_id=auth.uid())$$;
revoke all on function public.can_access_trip(text) from public;
grant execute on function public.can_access_trip(text) to authenticated;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_records enable row level security;
revoke all on public.trips,public.trip_members,public.trip_records from anon,authenticated;
grant select on public.trip_records to authenticated;
create policy "Members read trip records" on public.trip_records for select to authenticated using(public.can_access_trip(trip_id::text));
-- All writes go through the revision-checked RPC. Direct table writes are denied.

create function public.create_trip(trip_name text,invite_code text) returns uuid
language plpgsql security definer set search_path=public,extensions
as $$
declare new_trip uuid;
begin
 if auth.uid() is null then raise exception 'Sign in anonymously first';end if;
 if invite_code !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invite code';end if;
 if length(trim(trip_name)) not between 1 and 200 then raise exception 'Invalid trip name';end if;
 insert into public.trips(name,invite_hash,owner_id) values(trim(trip_name),encode(extensions.digest(invite_code,'sha256'),'hex'),auth.uid()) returning id into new_trip;
 insert into public.trip_members(trip_id,user_id) values(new_trip,auth.uid());
 return new_trip;
end $$;

create function public.join_trip(invite_code text) returns uuid
language plpgsql security definer set search_path=public,extensions
as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Sign in anonymously first';end if;
 if invite_code !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invite code';end if;
 select id into target from public.trips where invite_hash=encode(extensions.digest(invite_code,'sha256'),'hex');
 if target is null then raise exception 'Invite not found. Check the code with your crew.';end if;
 insert into public.trip_members(trip_id,user_id) values(target,auth.uid()) on conflict do nothing;
 return target;
end $$;

create function public.save_trip_record(p_trip_id uuid,p_id uuid,p_kind text,p_data jsonb,p_by text,p_deleted boolean,p_revision integer) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare saved public.trip_records;
begin
 if not public.can_access_trip(p_trip_id::text) then raise exception 'Trip access denied';end if;
 if octet_length(p_data::text)>250000 then raise exception 'Item is too large';end if;
 if p_revision=0 then
  insert into public.trip_records(trip_id,id,kind,data,"by",deleted,revision) values(p_trip_id,p_id,p_kind,p_data,p_by,p_deleted,1)
  on conflict(trip_id,id) do nothing returning * into saved;
 else
  update public.trip_records set kind=p_kind,data=p_data,"by"=p_by,deleted=p_deleted,revision=revision+1,updated_at=now()
  where trip_id=p_trip_id and id=p_id and revision=p_revision returning * into saved;
 end if;
 if saved.id is null then raise exception 'RECORD_CONFLICT';end if;
 return to_jsonb(saved);
end $$;

revoke all on function public.create_trip(text,text),public.join_trip(text),public.save_trip_record(uuid,uuid,text,jsonb,text,boolean,integer) from public;
grant execute on function public.create_trip(text,text),public.join_trip(text),public.save_trip_record(uuid,uuid,text,jsonb,text,boolean,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('trip-documents','trip-documents',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','text/plain']);
create policy "Members read their trip files" on storage.objects for select to authenticated using(bucket_id='trip-documents' and public.can_access_trip(split_part(name,'/',1)));
create policy "Members upload to their trip" on storage.objects for insert to authenticated with check(bucket_id='trip-documents' and public.can_access_trip(split_part(name,'/',1)));
create policy "Members update their trip files" on storage.objects for update to authenticated using(bucket_id='trip-documents' and public.can_access_trip(split_part(name,'/',1))) with check(bucket_id='trip-documents' and public.can_access_trip(split_part(name,'/',1)));
create policy "Members remove their trip files" on storage.objects for delete to authenticated using(bucket_id='trip-documents' and public.can_access_trip(split_part(name,'/',1)));
commit;
