-- 通知觀測查詢（無 UI 版）

-- 1) 近 7 天失敗率
SELECT
    date_trunc('day', created_at) AS day,
    count(*) AS total_logs,
    count(*) FILTER (WHERE status = 'failed') AS failed_logs,
    ROUND(
        100.0 * count(*) FILTER (WHERE status = 'failed') / NULLIF(count(*), 0),
        2
    ) AS failed_rate_pct
FROM public.notification_logs
WHERE created_at >= now() - interval '7 day'
GROUP BY 1
ORDER BY 1 DESC;

-- 2) 待重送數（queued + 可重試 failed）
SELECT
    count(*) FILTER (WHERE status = 'queued') AS queued_count,
    count(*) FILTER (WHERE status = 'failed' AND attempts < max_attempts) AS retryable_failed_count,
    count(*) FILTER (WHERE status = 'failed' AND attempts >= max_attempts) AS dead_failed_count
FROM public.notification_jobs;

-- 3) 事件別投遞健康度
SELECT
    event_code,
    count(*) AS total,
    count(*) FILTER (WHERE status = 'sent') AS sent_count,
    count(*) FILTER (WHERE status = 'failed') AS failed_count
FROM public.notification_logs
GROUP BY event_code
ORDER BY failed_count DESC, total DESC;

-- 4) 卡住 processing（可能 worker 中斷）
SELECT
    id,
    event_code,
    recipient_email,
    processing_started_at,
    attempts,
    max_attempts
FROM public.notification_jobs
WHERE status = 'processing'
  AND processing_started_at < now() - interval '10 minutes'
ORDER BY processing_started_at;
