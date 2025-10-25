-- DB-based rate limiting (1-hour sliding window by hour buckets)
-- Safe to run multiple times

create table if not exists public.api_rate_limit (
  key text not null,
    window_start timestamptz not null,
      count integer not null default 0,
        primary key (key, window_start)
        );

        comment on table public.api_rate_limit is 'Simple rate limit buckets by hour for fallback when Redis is unavailable';

        -- Function: increment counter atomically and return allowance
        create or replace function public.check_and_increment_rate(
          p_key text,
            p_limit int
            )
            returns table(
              allowed boolean,
                remaining int,
                  reset_at timestamptz
                  ) as $$
                  declare
                    v_window_start timestamptz := date_trunc('hour', now());
                      v_next_reset timestamptz := date_trunc('hour', now()) + interval '1 hour';
                        v_count int;
                        begin
                          insert into public.api_rate_limit(key, window_start, count)
                            values (p_key, v_window_start, 1)
                              on conflict (key, window_start) do update
                                  set count = public.api_rate_limit.count + 1
                                    returning public.api_rate_limit.count into v_count;

                                      return query select (v_count <= p_limit) as allowed,
                                                             greatest(p_limit - v_count, 0) as remaining,
                                                                                    v_next_reset as reset_at;
                                                                                    end;
                                                                                    $$ language plpgsql security definer;

                                                                                    -- Optional: Allow execution to authenticated and service roles (reading/modifying only via function)
                                                                                    grant execute on function public.check_and_increment_rate(text, int) to authenticated, service_role, anon;
                                                                                    