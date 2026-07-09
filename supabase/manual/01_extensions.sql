-- Moments Supabase Kurulumu - 01_extensions.sql
--
-- Bu dosya ne yapar?
-- Gerekli PostgreSQL extension'larini acar.
--
-- Ne zaman calistirilir?
-- Supabase SQL Editor'da ilk olarak bu dosya calistirilir.
--
-- Bundan once hangi dosya calismis olmali?
-- Hicbiri. Bu ilk dosyadir.

create extension if not exists "pgcrypto";
