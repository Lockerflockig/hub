UPDATE planets SET status = 'seen', updated_at = CURRENT_TIMESTAMP WHERE status = 'new'
