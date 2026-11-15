-- Only needed if you already ran the original schema before travel legs were added.
begin;
alter table public.trip_records drop constraint if exists trip_records_kind_check;
alter table public.trip_records add constraint trip_records_kind_check
check(kind in ('destination','activity','travel','stay','idea','document','expense','settlement'));
commit;
