create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key,
  full_name text not null,
  username text unique not null,
  email text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  notes text,
  order_index integer not null default 0,
  forge_passed boolean not null default false,
  forge_feedback text,
  cooldown_until timestamptz,
  messages_json jsonb not null default '[]'::jsonb
);

create table if not exists node_dependencies (
  id text primary key,
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  from_node_id uuid not null references nodes(id) on delete cascade,
  to_node_id uuid not null references nodes(id) on delete cascade
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  node_id uuid references nodes(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roadmaps_user_id_idx on roadmaps(user_id);
create index if not exists nodes_roadmap_id_idx on nodes(roadmap_id);
create index if not exists node_dependencies_roadmap_id_idx on node_dependencies(roadmap_id);
create index if not exists tasks_roadmap_id_idx on tasks(roadmap_id);
create index if not exists tasks_node_id_idx on tasks(node_id);

grant usage on schema public to anon, authenticated, service_role;
grant all on table profiles to service_role;
grant all on table roadmaps to service_role;
grant all on table nodes to service_role;
grant all on table node_dependencies to service_role;
grant all on table tasks to service_role;
