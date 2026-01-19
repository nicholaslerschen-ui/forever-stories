-- Test query to verify timezone logic
-- This shows how timestamps convert to dates in your timezone

SELECT 
    id,
    created_at as utc_timestamp,
    created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Phoenix' as arizona_timestamp,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Phoenix')::date as arizona_date,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Phoenix')::date as today_arizona,
    CASE 
        WHEN (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Phoenix')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Phoenix')::date 
        THEN 'TODAY' 
        ELSE 'NOT TODAY' 
    END as is_today,
    response_type
FROM prompt_responses 
WHERE response_type = 'daily'
ORDER BY created_at DESC;
