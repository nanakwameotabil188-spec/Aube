-- =============================================================================
-- 0016_restore_stock.sql
--
-- Putting stock back when an order is cancelled.
--
-- ## Why this is a function and not an update
--
-- `decrement_variant_stock` (0007) cannot be reused with a negative quantity,
-- and deliberately so: it rejects `p_quantity < 1` rather than clamping, because
-- a negative or zero quantity on a decrement is a malformed request and quietly
-- turning it into 1 would ship stock nobody paid for.
--
-- That same reasoning applies here, so the two directions are separate functions
-- rather than one signed parameter. Reusing the decrement with `-n` would also
-- silently invert its floor test: `stock_quantity >= -5` is true for every row
-- including the ones that should not be touched.
--
-- ## Why it has to be atomic
--
-- Reading the current count and writing back `current + n` is two statements, and
-- a checkout for the same variant landing between them loses its decrement. The
-- arithmetic and the write are one statement here, exactly as in 0007.
--
-- ## Idempotency is the caller's problem, not this function's
--
-- There is no "was this order already cancelled" check in here, because the
-- function cannot see the order. `setOrderStatus` refuses to move an order that
-- is already in the target status, and `cancelled` is terminal in its transition
-- table, so a second cancellation cannot reach this path.
-- =============================================================================

create or replace function restore_variant_stock(p_variant_id text, p_quantity integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  affected integer;
begin
  -- Same convention as the decrement: a malformed quantity is rejected outright
  -- rather than clamped. Restoring more than was ever taken is a bug, and
  -- silently absorbing it would hide it until stock drifted.
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be at least 1';
  end if;

  update product_variants
     set stock_quantity = stock_quantity + p_quantity
   where id = p_variant_id;

  get diagnostics affected = row_count;

  -- False means the variant no longer exists — the product was deleted while the
  -- order was open. There is nothing to restore and nothing worth failing over:
  -- the order is still correctly cancelled.
  return affected = 1;
end;
$$;

-- Service role only, like every other writer in this schema. A shopper has no
-- update policy on `product_variants`, so this is not reachable from the client.
revoke execute on function restore_variant_stock(text, integer) from public;
grant execute on function restore_variant_stock(text, integer) to service_role;