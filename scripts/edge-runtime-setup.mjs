// Test-only. Never reads DATABASE_URL and refuses non-local servers.
import pg from 'pg';
import { readFileSync } from 'node:fs';
const u = new URL(process.env.TEST_DATABASE_URL || '');
if (!['127.0.0.1','localhost'].includes(u.hostname)) throw Error('PostgreSQL local descartável obrigatório');
u.pathname='/postgres';
const admin=new pg.Client({connectionString:u.href});await admin.connect();
await admin.query('drop database if exists cardajuda_runtime with (force)');
await admin.query('create database cardajuda_runtime');await admin.end();
u.pathname='/cardajuda_runtime';
const c=new pg.Client({connectionString:u.href});await c.connect();
for (const f of ['supabase/schema.sql','supabase/seed.sql','supabase/migrations/20261015_mobile_boundary.sql']) await c.query(readFileSync(f,'utf8'));
await c.query('insert into mobile_private.approved_doctors(medico_id) select id from medicos');await c.end();
