-- =============================================================================
-- 0007_stock_reservation.sql
--
-- Makes stock decrementing safe under concurrency.
--
-- The checkout path checks that a variant has enough stock, then writes the
-- order, then decrements. The problem is that the check and the write are
-- separate statements, so two shoppers checking out the last unit at the same
-- moment both pass the check and both succeed.
--
-- `update set stock = stock - 1` does not fix it either: a plain update has no
-- floor, so it can drive a column below zero. Guarding that in application code
-- means another round trip and another race.
--
-- The function does the arithmetic and the floor test in one statement. The
-- `where stock_quantity >= p_quantity` clause is part of the UPDATE's own
-- predicate, so the row is locked, tested and updated as a single operation —
-- there is no window between the check and the write for a second transaction
-- to slip into.
-- =============================================================================

create or replace function decrement_variant_stock(p_variant_id text, p_quantity integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  affected integer;
begin
  -- `p_quantity < 1` is rejected rather than clamped. A zero or negative
  -- quantity is not a rounding error, it is a malformed request, and quietly
  -- turning it into 1 would ship stock nobody paid for.
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be at least 1';
  end if;

  update product_variants
     set stock_quantity = stock_quantity - p_quantity
   where id = p_variant_id
     and stock_quantity >= p_quantity;

  get diagnostics affected = row_count;

  -- False means the row was not in a state that could satisfy the request:
  -- either it does not exist, or there was not enough stock. The caller has
  -- already written its order by this point, so it reports the conflict rather
  -- than retrying.
  return affected = 1;
end;
$$;

-- Callable by the service role, which is the only caller. The anon and
-- authenticated roles have no policy on `product_variants` for update, so a
-- shopper cannot call this directly to drain stock, and there is deliberately
-- no `grant` to `anon` or `authenticated` here.
revoke execute on function decrement_variant_stock(text, integer) from public;
grant execute on function decrement_variant_stock(text, integer) to service_role;
