-- ============================================================
-- HOPE BUILT ADVISORY — F&C Command Center
-- Supabase Migration 001: Initial Schema
-- Multi-tenant, RLS-enforced, production-ready
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fuzzy search

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum (
  'admin',          -- Hope Built Advisory staff
  'coordinator',    -- Vanessa — full access within org
  'approver',       -- Layne, Daniel, Sylvia — approve docs
  'leadership',     -- CFO/COO — read + leadership dashboard
  'read_only'       -- Stakeholders with folder access
);

create type meeting_type as enum (
  'fac_doc_rev',    -- Weekly FAC Document Review
  'tactical',       -- Weekly Tactical
  'bod'             -- Board of Directors session
);

create type state_region as enum (
  'TX', 'FL', 'OH', 'IPS_FL', 'TX_IPS'
);

create type approval_stage as enum (
  'fc_committee',
  'coo',
  'treasury_finance',
  'legal',
  'finance_committee',
  'board'
);

create type approval_status as enum (
  'pending',
  'approved',
  'approved_by_delegation',
  'approved_pending_conditions',
  'denied',
  'on_hold',
  'not_required'
);

create type pipeline_status as enum (
  'pending_fc_review',
  'pending_coo',
  'pending_treasury',
  'pending_legal',
  'pending_finance_committee',
  'pending_bod',
  'pending_execution',
  'fully_executed',
  'on_hold',
  'denied',
  'archived'
);

create type action_status as enum (
  'open', 'in_progress', 'complete', 'cancelled'
);

create type action_priority as enum (
  'urgent', 'high', 'medium', 'low'
);

create type notification_type as enum (
  'approval_request',
  'approval_reminder_nudge',
  'weekly_agenda',
  'bod_packet_digest',
  'item_approved',
  'item_denied',
  'item_on_hold',
  'action_item_due'
);

create type bod_item_type as enum (
  'consent_agenda',
  'action_item',
  'ratification',
  'information_only'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Organizations (tenants)
-- Every future client is one row here.
-- IDEA TX is row 1.
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,  -- 'idea-tx', 'client-abc'
  logo_url      text,
  primary_color text default '#1F4E79',
  settings      jsonb not null default '{
    "approval_chain": ["fc_committee","coo","treasury_finance","legal","finance_committee","board"],
    "bod_amount_threshold": 50000,
    "legal_required_doc_types": ["Contract Amendment","PSA","Easement","Master Agreement"],
    "nudge_after_business_days": 5,
    "agenda_send_day": "wednesday",
    "agenda_send_hour": 7,
    "bod_packet_weeks_before": 3,
    "fiscal_year_start_month": 7
  }',
  active        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Users (extends Supabase auth.users)
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid not null references organizations(id),
  full_name     text not null,
  email         text not null,
  role          user_role not null default 'read_only',
  title         text,                     -- 'F&C Coordinator', 'VP Treasury'
  avatar_initials text,                   -- 'VR', 'LF'
  auth_provider text default 'email',     -- 'email' | 'microsoft' | 'google'
  microsoft_oid text,                     -- Azure AD object ID for future SSO
  is_active     boolean default true,
  last_seen_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(org_id, email)
);

-- Campuses (configurable per org, no hardcoding campus names)
create table campuses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id),
  name        text not null,               -- 'IDEA Henry', 'IPS Lakeland'
  state       state_region,
  region      text,                        -- 'RGV', 'San Antonio', 'Jacksonville'
  is_active   boolean default true,
  created_at  timestamptz default now(),
  unique(org_id, name)
);

-- Document Types (configurable per org)
-- This is the approval matrix — encodes which rules apply to which doc types
create table document_types (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references organizations(id),
  name                      text not null,   -- 'CEA', 'CO', 'Task Order', 'A101 Contract'
  abbreviation              text,            -- 'CEA', 'CO', 'TO'
  requires_legal            boolean default false,
  requires_bod              boolean default false,
  bod_amount_threshold      numeric,         -- override org default if set
  requires_budget_amendment boolean default false,
  requires_wet_signature    boolean default false,
  approval_stages           approval_stage[] default array['fc_committee','coo','treasury_finance']::approval_stage[],
  notes                     text,
  is_active                 boolean default true,
  created_at                timestamptz default now(),
  unique(org_id, name)
);

-- Meetings
create table meetings (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id),
  meeting_date          date not null,
  meeting_type          meeting_type not null,
  state                 state_region,
  title                 text,               -- auto-generated: 'FAC Doc Rev — July 15, 2025'
  agenda_generated_at   timestamptz,
  agenda_sent_at        timestamptz,
  agenda_recipients     text[],             -- email addresses
  minutes_url           text,
  coordinator_id        uuid references users(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Documents (the core approval pipeline record)
create table documents (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id),
  meeting_id            uuid references meetings(id),
  doc_number            integer,            -- agenda item number within meeting
  state                 state_region not null,
  campus_id             uuid references campuses(id),
  campus_name           text,               -- denormalized for perf + deleted campus safety
  document_type_id      uuid references document_types(id),
  document_type_name    text,               -- denormalized
  presenter_id          uuid references users(id),
  presenter_name        text,               -- denormalized (external presenters like 'PMSI')
  amount                numeric,
  funding_request       text,
  funding_source        text,
  description           text,
  notes                 text,
  next_steps            text,
  attachment_url        text,
  sharepoint_folder_url text,              -- link to the weekly docs folder
  gl_account            text,
  gl_account_funded     boolean,
  notified_rm           boolean default false,
  legal_ticket_number   text,              -- e.g. 'Ticket #1209399'
  pipeline_status       pipeline_status not null default 'pending_fc_review',
  is_archived           boolean default false,
  archived_at           timestamptz,
  is_on_hold            boolean default false,
  on_hold_reason        text,
  on_hold_since         timestamptz,
  additional_notes      text,
  created_by            uuid references users(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Approvals (one row per stage per document)
-- Created automatically when a document is submitted
-- based on the document type's approval_stages array
create table approvals (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id),
  document_id     uuid not null references documents(id) on delete cascade,
  stage           approval_stage not null,
  stage_order     integer not null,         -- 1, 2, 3... drives pipeline sequence
  status          approval_status not null default 'pending',
  is_required     boolean not null default true,
  approver_id     uuid references users(id),
  approver_name   text,                     -- denormalized (external approvers)
  approved_at     timestamptz,
  denied_at       timestamptz,
  notes           text,
  conditions      text,                     -- 'pending conditions: ...'
  ticket_number   text,
  -- computed fields (updated by trigger)
  days_at_stage   integer default 0,
  is_overdue      boolean default false,    -- true if days_at_stage > org nudge threshold
  nudge_sent_at   timestamptz,              -- last nudge notification sent
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(document_id, stage)
);

-- Tactical Items (weekly tactical meeting log)
create table tactical_items (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references organizations(id),
  meeting_id                uuid not null references meetings(id),
  agenda_number             integer,
  state                     state_region,
  campus_id                 uuid references campuses(id),
  campus_name               text,
  subtopic                  text,
  presenter_id              uuid references users(id),
  presenter_name            text,
  description               text,
  discussion_notes          text,
  fc_outcome                text,
  -- when a tactical item becomes a formal approval doc
  promoted_to_document_id   uuid references documents(id),
  promoted_at               timestamptz,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- Action Items (next steps, trackable, assignable)
create table action_items (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id),
  document_id         uuid references documents(id) on delete cascade,
  tactical_item_id    uuid references tactical_items(id) on delete cascade,
  description         text not null,
  assigned_to_id      uuid references users(id),
  assigned_to_name    text,               -- for external assignees like 'PMSI'
  due_date            date,
  status              action_status not null default 'open',
  priority            action_priority not null default 'medium',
  completed_at        timestamptz,
  completed_by        uuid references users(id),
  -- computed
  days_overdue        integer default 0,
  created_by          uuid references users(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- BOD Items (auto-created when document.requires_bod = true)
create table bod_items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id),
  document_id       uuid not null references documents(id) on delete cascade,
  bod_meeting_id    uuid references meetings(id),   -- the BOD meeting record
  board_entity      text,                           -- 'TX Board', 'IPS Board', 'OH Board'
  item_type         bod_item_type default 'action_item',
  packet_submitted  boolean default false,
  packet_submitted_at timestamptz,
  board_approved    boolean,
  approved_at       timestamptz,
  denied_at         timestamptz,
  resolution_number text,
  board_notes       text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique(document_id)                               -- one BOD record per document
);

-- Notification Log (full audit trail of every automated email sent)
create table notification_log (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id),
  document_id         uuid references documents(id),
  action_item_id      uuid references action_items(id),
  notification_type   notification_type not null,
  recipient_id        uuid references users(id),
  recipient_email     text not null,
  subject             text,
  sent_at             timestamptz default now(),
  status              text default 'sent',  -- 'sent' | 'failed' | 'bounced'
  error_message       text,
  resend_message_id   text                 -- Resend API message ID for tracking
);

-- ============================================================
-- INDEXES (performance)
-- ============================================================

-- Documents
create index idx_documents_org_id        on documents(org_id);
create index idx_documents_meeting_id    on documents(meeting_id);
create index idx_documents_pipeline      on documents(org_id, pipeline_status);
create index idx_documents_state         on documents(org_id, state);
create index idx_documents_archived      on documents(org_id, is_archived);
create index idx_documents_on_hold       on documents(org_id, is_on_hold);
create index idx_documents_updated       on documents(org_id, updated_at desc);
-- Full-text search
create index idx_documents_search on documents
  using gin(to_tsvector('english',
    coalesce(campus_name,'') || ' ' ||
    coalesce(document_type_name,'') || ' ' ||
    coalesce(presenter_name,'') || ' ' ||
    coalesce(description,'') || ' ' ||
    coalesce(legal_ticket_number,'')
  ));

-- Approvals
create index idx_approvals_document_id   on approvals(document_id);
create index idx_approvals_org_stage     on approvals(org_id, stage, status);
create index idx_approvals_overdue       on approvals(org_id, is_overdue) where is_overdue = true;

-- Action Items
create index idx_action_items_org        on action_items(org_id, status);
create index idx_action_items_assigned   on action_items(assigned_to_id, status);
create index idx_action_items_overdue    on action_items(org_id, days_overdue) where status = 'open';

-- Tactical
create index idx_tactical_meeting        on tactical_items(meeting_id);
create index idx_tactical_org            on tactical_items(org_id);

-- BOD
create index idx_bod_meeting             on bod_items(bod_meeting_id);
create index idx_bod_org_approved        on bod_items(org_id, board_approved);

-- Meetings
create index idx_meetings_org_date       on meetings(org_id, meeting_date desc);
create index idx_meetings_type           on meetings(org_id, meeting_type);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_documents
  before update on documents
  for each row execute function set_updated_at();

create trigger set_updated_at_approvals
  before update on approvals
  for each row execute function set_updated_at();

create trigger set_updated_at_action_items
  before update on action_items
  for each row execute function set_updated_at();

create trigger set_updated_at_tactical_items
  before update on tactical_items
  for each row execute function set_updated_at();

create trigger set_updated_at_meetings
  before update on meetings
  for each row execute function set_updated_at();

create trigger set_updated_at_users
  before update on users
  for each row execute function set_updated_at();

-- Recalculate pipeline_status when any approval changes
create or replace function recalc_pipeline_status()
returns trigger language plpgsql as $$
declare
  v_doc_id    uuid;
  v_status    pipeline_status;
  v_on_hold   boolean;
  v_denied    boolean;
  v_bod_reqd  boolean;
  v_bod_appr  boolean;
begin
  v_doc_id := new.document_id;

  -- Check if any required approval is denied
  select exists(
    select 1 from approvals
    where document_id = v_doc_id
      and status = 'denied'
      and is_required = true
  ) into v_denied;

  if v_denied then
    update documents set pipeline_status = 'denied' where id = v_doc_id;
    return new;
  end if;

  -- Check on hold
  select exists(
    select 1 from approvals
    where document_id = v_doc_id
      and status = 'on_hold'
  ) into v_on_hold;

  if v_on_hold then
    update documents
    set pipeline_status = 'on_hold', is_on_hold = true, on_hold_since = now()
    where id = v_doc_id;
    return new;
  end if;

  -- Walk the approval chain in order
  -- Find the first required approval that isn't approved yet
  select stage into v_status
  from (
    select
      case stage
        when 'fc_committee'       then 'pending_fc_review'::pipeline_status
        when 'coo'                then 'pending_coo'::pipeline_status
        when 'treasury_finance'   then 'pending_treasury'::pipeline_status
        when 'legal'              then 'pending_legal'::pipeline_status
        when 'finance_committee'  then 'pending_finance_committee'::pipeline_status
        when 'board'              then 'pending_bod'::pipeline_status
      end as derived_status,
      stage_order
    from approvals
    where document_id = v_doc_id
      and is_required = true
      and status not in ('approved', 'approved_by_delegation', 'approved_pending_conditions', 'not_required')
    order by stage_order asc
    limit 1
  ) pending;

  -- If nothing pending, check BOD
  if v_status is null then
    select exists(
      select 1 from bod_items
      where document_id = v_doc_id and board_approved = true
    ) into v_bod_appr;

    select exists(
      select 1 from bod_items where document_id = v_doc_id
    ) into v_bod_reqd;

    if v_bod_reqd and not v_bod_appr then
      v_status := 'pending_bod';
    else
      v_status := 'pending_execution';
    end if;
  end if;

  update documents set pipeline_status = v_status where id = v_doc_id;
  return new;
end;
$$;

create trigger recalc_pipeline_on_approval_change
  after insert or update on approvals
  for each row execute function recalc_pipeline_status();

create trigger recalc_pipeline_on_bod_change
  after insert or update on bod_items
  for each row execute function recalc_pipeline_status();

-- Auto-create approval rows when a document is inserted
-- Based on the document_type's approval_stages config
create or replace function create_approval_records()
returns trigger language plpgsql as $$
declare
  v_stages    approval_stage[];
  v_stage     approval_stage;
  v_order     integer := 1;
  v_org       organizations;
begin
  -- Get org settings
  select * into v_org from organizations where id = new.org_id;

  -- Get stages from document type, fall back to org default chain
  select approval_stages into v_stages
  from document_types
  where id = new.document_type_id;

  if v_stages is null then
    v_stages := array(
      select unnest(
        (v_org.settings->>'approval_chain')::text[]::approval_stage[]
      )
    );
  end if;

  foreach v_stage in array v_stages loop
    insert into approvals(org_id, document_id, stage, stage_order, status, is_required)
    values (new.org_id, new.id, v_stage, v_order, 'pending', true);
    v_order := v_order + 1;
  end loop;

  -- Auto-create BOD item if type requires it, or amount exceeds threshold
  if exists(
    select 1 from document_types
    where id = new.document_type_id and requires_bod = true
  ) or (
    new.amount > (v_org.settings->>'bod_amount_threshold')::numeric
  ) then
    insert into bod_items(org_id, document_id)
    values (new.org_id, new.id);
  end if;

  return new;
end;
$$;

create trigger create_approvals_on_document_insert
  after insert on documents
  for each row execute function create_approval_records();

-- Update days_at_stage and is_overdue on approvals (run daily via cron)
create or replace function refresh_approval_aging()
returns void language plpgsql as $$
declare
  v_org       organizations;
  v_threshold integer;
begin
  for v_org in select * from organizations where active = true loop
    v_threshold := coalesce(
      (v_org.settings->>'nudge_after_business_days')::integer,
      5
    );

    update approvals a
    set
      days_at_stage = (
        select extract(day from now() - a.created_at)::integer
      ),
      is_overdue = (
        select extract(day from now() - a.created_at)::integer > v_threshold
      )
    where a.org_id = v_org.id
      and a.status = 'pending';
  end loop;
end;
$$;

-- Update action item days_overdue (run daily via cron)
create or replace function refresh_action_item_aging()
returns void language plpgsql as $$
begin
  update action_items
  set days_overdue = greatest(0, (current_date - due_date))
  where status in ('open', 'in_progress')
    and due_date is not null
    and due_date < current_date;
end;
$$;

-- ============================================================
-- VIEWS (convenience queries)
-- ============================================================

-- Active pipeline view — what Vanessa's swimlane runs on
create or replace view v_active_pipeline as
select
  d.id,
  d.org_id,
  d.meeting_id,
  d.doc_number,
  d.state,
  d.campus_name,
  d.document_type_name,
  d.presenter_name,
  d.amount,
  d.funding_source,
  d.pipeline_status,
  d.is_on_hold,
  d.on_hold_reason,
  d.sharepoint_folder_url,
  d.legal_ticket_number,
  d.created_at,
  d.updated_at,
  -- Current pending stage (the bottleneck)
  (
    select a.stage from approvals a
    where a.document_id = d.id
      and a.status = 'pending'
      and a.is_required = true
    order by a.stage_order asc
    limit 1
  ) as current_pending_stage,
  -- Days in current stage
  (
    select a.days_at_stage from approvals a
    where a.document_id = d.id
      and a.status = 'pending'
      and a.is_required = true
    order by a.stage_order asc
    limit 1
  ) as days_in_current_stage,
  -- Is overdue flag
  (
    select a.is_overdue from approvals a
    where a.document_id = d.id
      and a.status = 'pending'
      and a.is_required = true
    order by a.stage_order asc
    limit 1
  ) as is_overdue,
  -- BOD meeting date if applicable
  (
    select m.meeting_date from bod_items bi
    join meetings m on m.id = bi.bod_meeting_id
    where bi.document_id = d.id
  ) as bod_meeting_date,
  -- Count of open action items
  (
    select count(*) from action_items ai
    where ai.document_id = d.id and ai.status in ('open','in_progress')
  ) as open_action_item_count
from documents d
where d.is_archived = false
  and d.pipeline_status not in ('fully_executed', 'denied', 'archived');

-- Dashboard metrics view — what the metric cards pull from
create or replace view v_dashboard_metrics as
select
  org_id,
  count(*) filter (where pipeline_status = 'pending_fc_review') as needs_fc_review,
  count(*) filter (where pipeline_status in ('pending_coo','pending_treasury','pending_legal','pending_finance_committee')) as waiting_on_others,
  count(*) filter (where pipeline_status = 'pending_bod') as pending_bod,
  count(*) filter (where pipeline_status = 'pending_execution') as pending_execution,
  count(*) filter (where pipeline_status = 'fully_executed') as fully_executed,
  count(*) filter (where is_on_hold = true) as on_hold,
  sum(amount) filter (where pipeline_status not in ('fully_executed','denied','archived')) as pipeline_value,
  count(*) filter (where pipeline_status not in ('fully_executed','denied','archived','on_hold')) as total_active
from documents
group by org_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table organizations    enable row level security;
alter table users            enable row level security;
alter table campuses         enable row level security;
alter table document_types   enable row level security;
alter table meetings         enable row level security;
alter table documents        enable row level security;
alter table approvals        enable row level security;
alter table tactical_items   enable row level security;
alter table action_items     enable row level security;
alter table bod_items        enable row level security;
alter table notification_log enable row level security;

-- Helper: get current user's org_id
create or replace function auth_org_id()
returns uuid language sql stable as $$
  select org_id from users where id = auth.uid()
$$;

-- Helper: get current user's role
create or replace function auth_role()
returns user_role language sql stable as $$
  select role from users where id = auth.uid()
$$;

-- Organizations: users see only their org
create policy "users_see_own_org" on organizations
  for select using (id = auth_org_id());

-- Users: see all users in same org
create policy "users_see_org_users" on users
  for select using (org_id = auth_org_id());

create policy "users_update_own_profile" on users
  for update using (id = auth.uid());

-- Admins and coordinators can manage users
create policy "coordinators_manage_users" on users
  for all using (auth_role() in ('admin', 'coordinator'));

-- Campuses, document_types: org-scoped read
create policy "org_scoped_campuses" on campuses
  for select using (org_id = auth_org_id());

create policy "coordinators_manage_campuses" on campuses
  for all using (org_id = auth_org_id() and auth_role() in ('admin','coordinator'));

create policy "org_scoped_doc_types" on document_types
  for select using (org_id = auth_org_id());

create policy "coordinators_manage_doc_types" on document_types
  for all using (org_id = auth_org_id() and auth_role() in ('admin','coordinator'));

-- Meetings: org-scoped
create policy "org_scoped_meetings" on meetings
  for select using (org_id = auth_org_id());

create policy "coordinators_manage_meetings" on meetings
  for all using (org_id = auth_org_id() and auth_role() in ('admin','coordinator'));

-- Documents: org-scoped for all, write requires coordinator+
create policy "org_scoped_documents" on documents
  for select using (org_id = auth_org_id());

create policy "coordinators_manage_documents" on documents
  for all using (org_id = auth_org_id() and auth_role() in ('admin','coordinator'));

create policy "approvers_submit_documents" on documents
  for insert with check (org_id = auth_org_id() and auth_role() in ('admin','coordinator','approver'));

-- Approvals: org-scoped, approvers can update their stage
create policy "org_scoped_approvals" on approvals
  for select using (org_id = auth_org_id());

create policy "approvers_update_their_stage" on approvals
  for update using (
    org_id = auth_org_id()
    and auth_role() in ('admin','coordinator','approver','leadership')
  );

-- Action items: org-scoped, assignees can update
create policy "org_scoped_action_items" on action_items
  for select using (org_id = auth_org_id());

create policy "manage_action_items" on action_items
  for all using (org_id = auth_org_id() and auth_role() in ('admin','coordinator','approver'));

-- Tactical items: org-scoped
create policy "org_scoped_tactical" on tactical_items
  for select using (org_id = auth_org_id());

create policy "coordinators_manage_tactical" on tactical_items
  for all using (org_id = auth_org_id() and auth_role() in ('admin','coordinator'));

-- BOD items: org-scoped read
create policy "org_scoped_bod" on bod_items
  for select using (org_id = auth_org_id());

create policy "coordinators_manage_bod" on bod_items
  for all using (org_id = auth_org_id() and auth_role() in ('admin','coordinator'));

-- Notification log: coordinator+ only
create policy "coordinators_view_notifications" on notification_log
  for select using (org_id = auth_org_id() and auth_role() in ('admin','coordinator'));

-- ============================================================
-- SEED: IDEA TX as first organization
-- ============================================================

insert into organizations (id, name, slug, primary_color, settings) values (
  'a0000000-0000-0000-0000-000000000001',
  'IDEA Public Schools — TX & IPS',
  'idea-tx',
  '#1F4E79',
  '{
    "approval_chain": ["fc_committee","coo","treasury_finance","legal","finance_committee","board"],
    "bod_amount_threshold": 50000,
    "legal_required_doc_types": ["Contract Amendment","PSA","Easement","Master Agreement","A101 Contract"],
    "nudge_after_business_days": 5,
    "agenda_send_day": "wednesday",
    "agenda_send_hour": 7,
    "bod_packet_weeks_before": 3,
    "fiscal_year_start_month": 7,
    "committee_name": "Facilities & Construction Committee",
    "coordinator_name": "Vanessa Rangel",
    "bod_entities": ["TX Board of Directors","IPS Board of Directors"]
  }'
);

-- Document types for IDEA
insert into document_types (org_id, name, abbreviation, requires_legal, requires_bod, bod_amount_threshold, approval_stages) values
  ('a0000000-0000-0000-0000-000000000001', 'Task Order', 'TO', false, false, 50000, array['fc_committee','coo','treasury_finance']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'CEA — Contingency Expenditure Authorization', 'CEA', false, false, 50000, array['fc_committee','coo','treasury_finance']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'CO — Change Order', 'CO', false, true, 50000, array['fc_committee','coo','treasury_finance']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'ASA — Additional Service Agreement', 'ASA', false, false, 50000, array['fc_committee','coo','treasury_finance']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'Contractor Ranking / Selection Criteria', 'Ranking', false, false, null, array['fc_committee','coo','treasury_finance']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'A101 Construction Contract', 'A101', true, true, 0, array['fc_committee','coo','treasury_finance','legal','board']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'Contract Amendment', 'Amend', true, true, 0, array['fc_committee','coo','treasury_finance','legal','board']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'PSA — Purchase and Sale Agreement', 'PSA', true, true, 0, array['fc_committee','coo','treasury_finance','legal','board']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'Easement', 'Ease', true, true, 0, array['fc_committee','coo','treasury_finance','legal','board']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'Final Retainage Pay Application', 'Retainage', false, true, 0, array['fc_committee','coo','treasury_finance','board']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'Monitoring Agreement', 'Monitor', false, false, 50000, array['fc_committee','coo','treasury_finance']::approval_stage[]),
  ('a0000000-0000-0000-0000-000000000001', 'Plat Application', 'Plat', false, false, null, array['fc_committee','coo','treasury_finance']::approval_stage[]);
