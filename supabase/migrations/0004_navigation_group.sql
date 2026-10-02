-- =============================================================================
-- 0004_navigation_group.sql
--
-- `navigation_links` stores three distinct lists — primary, utility, and
-- account — but 0001 gave it no column to tell them apart. Every row is
-- identical in shape, so reading one list out of the table returns all three
-- interleaved and ordered by position.
--
-- The column is named `nav_group` rather than `group` because `group` is a
-- reserved word in SQL and would have to be quoted at every call site.
-- =============================================================================

alter table navigation_links
  add column if not exists nav_group text not null default 'primary';

-- Constrained rather than free text: the frontend renders exactly three nav
-- groups, and a fourth spelling would be silently ignored.
alter table navigation_links
  drop constraint if exists navigation_links_nav_group_check;

alter table navigation_links
  add constraint navigation_links_nav_group_check
  check (nav_group in ('primary', 'utility', 'account'));

-- A parent link always belongs to the same group as its children, otherwise a
-- child could be orphaned into a list its parent is not rendered in.
create index if not exists navigation_links_group_idx
  on navigation_links (nav_group, position);
