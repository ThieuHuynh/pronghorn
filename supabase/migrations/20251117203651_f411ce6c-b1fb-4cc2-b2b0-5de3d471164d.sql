-- Standards Library Schema

-- Top-level standard categories (e.g., Cyber Security, Accessibility, App Specifications)
create table public.standard_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  color text,
  order_index integer not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Individual standards within categories
create table public.standards (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.standard_categories(id) on delete cascade not null,
  parent_id uuid references public.standards(id) on delete cascade,
  code text not null, -- e.g., "OWASP-ASVS-4.0.3", "WCAG-2.1-1.4.3"
  title text not null,
  description text,
  content text, -- Full specification text
  order_index integer not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  unique(code)
);

-- Attachments for standards (files, links, SharePoint, etc.)
create table public.standard_attachments (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid references public.standards(id) on delete cascade not null,
  type text not null, -- 'file', 'url', 'sharepoint', 'website'
  name text not null,
  url text not null,
  description text,
  created_at timestamp with time zone default now() not null
);

-- Link project requirements to library standards
create table public.requirement_standards (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid references public.requirements(id) on delete cascade not null,
  standard_id uuid references public.standards(id) on delete cascade not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  unique(requirement_id, standard_id)
);

-- Enable Row Level Security
alter table public.standard_categories enable row level security;
alter table public.standards enable row level security;
alter table public.standard_attachments enable row level security;
alter table public.requirement_standards enable row level security;

-- RLS Policies - Standards are readable by all authenticated users
create policy "Standard categories are viewable by authenticated users"
  on public.standard_categories for select
  using (auth.role() = 'authenticated');

create policy "Standards are viewable by authenticated users"
  on public.standards for select
  using (auth.role() = 'authenticated');

create policy "Standard attachments are viewable by authenticated users"
  on public.standard_attachments for select
  using (auth.role() = 'authenticated');

-- Requirement-standard links follow project access
create policy "Users can view requirement-standard links for accessible projects"
  on public.requirement_standards for select
  using (
    exists (
      select 1 from public.requirements
      join public.projects on projects.id = requirements.project_id
      join public.profiles on profiles.org_id = projects.org_id
      where requirements.id = requirement_standards.requirement_id
      and profiles.user_id = auth.uid()
    )
  );

create policy "Users can manage requirement-standard links for accessible projects"
  on public.requirement_standards for all
  using (
    exists (
      select 1 from public.requirements
      join public.projects on projects.id = requirements.project_id
      join public.profiles on profiles.org_id = projects.org_id
      where requirements.id = requirement_standards.requirement_id
      and profiles.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
create trigger update_standard_categories_updated_at before update on public.standard_categories
  for each row execute function public.update_updated_at_column();

create trigger update_standards_updated_at before update on public.standards
  for each row execute function public.update_updated_at_column();

-- Indexes
create index idx_standards_category_id on public.standards(category_id);
create index idx_standards_parent_id on public.standards(parent_id);
create index idx_standards_code on public.standards(code);
create index idx_standard_attachments_standard_id on public.standard_attachments(standard_id);
create index idx_requirement_standards_requirement_id on public.requirement_standards(requirement_id);
create index idx_requirement_standards_standard_id on public.requirement_standards(standard_id);

-- Enable Realtime for all tables
alter publication supabase_realtime add table public.standard_categories;
alter publication supabase_realtime add table public.standards;
alter publication supabase_realtime add table public.standard_attachments;
alter publication supabase_realtime add table public.requirements;
alter publication supabase_realtime add table public.requirement_standards;
alter publication supabase_realtime add table public.canvas_nodes;
alter publication supabase_realtime add table public.canvas_edges;

-- Configure Realtime for requirements table
alter table public.requirements replica identity full;
alter table public.canvas_nodes replica identity full;
alter table public.canvas_edges replica identity full;

-- Sample data for standards library
insert into public.standard_categories (name, description, icon, color, order_index) values
  ('Cyber Security', 'Security standards and frameworks including OWASP, NIST, and ISO', 'Shield', '#ef4444', 1),
  ('Accessibility', 'WCAG and accessibility compliance standards', 'Eye', '#8b5cf6', 2),
  ('Application Standards', 'Best practices for application development and architecture', 'Code', '#3b82f6', 3),
  ('Data Privacy', 'GDPR, CCPA, and data protection requirements', 'Lock', '#f59e0b', 4),
  ('Performance', 'Performance benchmarks and optimization standards', 'Zap', '#10b981', 5);

-- Sample standards (OWASP ASVS examples)
insert into public.standards (category_id, code, title, description, content, order_index)
select 
  c.id,
  'OWASP-ASVS-V1',
  'V1: Architecture, Design and Threat Modeling',
  'Requirements related to application architecture, design and threat modeling',
  'Architecture, design and threat modeling requirements ensure the application has a secure design foundation.',
  1
from public.standard_categories c where c.name = 'Cyber Security';

insert into public.standards (category_id, parent_id, code, title, description, order_index)
select 
  c.id,
  s.id,
  'OWASP-ASVS-V1.1',
  'V1.1 Secure Software Development Lifecycle',
  'Requirements for secure development lifecycle practices',
  1
from public.standard_categories c
cross join public.standards s
where c.name = 'Cyber Security' and s.code = 'OWASP-ASVS-V1';

insert into public.standards (category_id, code, title, description, content, order_index)
select 
  c.id,
  'WCAG-2.1',
  'WCAG 2.1 Guidelines',
  'Web Content Accessibility Guidelines 2.1',
  'WCAG 2.1 covers a wide range of recommendations for making Web content more accessible.',
  1
from public.standard_categories c where c.name = 'Accessibility';

insert into public.standards (category_id, parent_id, code, title, description, order_index)
select 
  c.id,
  s.id,
  'WCAG-2.1-1.4',
  'Guideline 1.4 Distinguishable',
  'Make it easier for users to see and hear content including separating foreground from background',
  4
from public.standard_categories c
cross join public.standards s
where c.name = 'Accessibility' and s.code = 'WCAG-2.1';

-- Sample attachments
insert into public.standard_attachments (standard_id, type, name, url, description)
select 
  s.id,
  'website',
  'OWASP ASVS Official Documentation',
  'https://owasp.org/www-project-application-security-verification-standard/',
  'Official OWASP Application Security Verification Standard documentation'
from public.standards s where s.code = 'OWASP-ASVS-V1';

insert into public.standard_attachments (standard_id, type, name, url, description)
select 
  s.id,
  'website',
  'WCAG 2.1 Quick Reference',
  'https://www.w3.org/WAI/WCAG21/quickref/',
  'Quick reference guide for WCAG 2.1 guidelines'
from public.standards s where s.code = 'WCAG-2.1';