import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si no hay credenciales, exportamos null — la app usa localStorage (Zustand persist)
export const supabase = url && key ? createClient(url, key) : null

// ── Esquema Supabase (ejecuta esto en el SQL Editor de tu proyecto) ──
//
// create table transactions (
//   id          text primary key,
//   type        text not null,
//   amount      numeric not null,
//   description text,
//   category    text,
//   card_id     text,
//   date        date,
//   created_at  timestamptz default now()
// );
//
// create table cards (
//   id          text primary key,
//   bank_name   text not null,
//   card_name   text,
//   last4       text,
//   "limit"     numeric not null default 0,
//   balance     numeric not null default 0,
//   cut_day     int,
//   due_day     int,
//   color_index int default 0,
//   created_at  timestamptz default now()
// );
//
// create table subscriptions (
//   id           text primary key,
//   name         text not null,
//   amount       numeric not null,
//   billing_day  int,
//   is_active    boolean default true,
//   category     text,
//   card_id      text,
//   created_at   timestamptz default now()
// );
//
// -- Habilita RLS y crea políticas según tu esquema de auth
