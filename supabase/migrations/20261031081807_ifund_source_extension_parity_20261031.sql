-- Match the installed extensions from the former Ifund project.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists vector with schema extensions;
