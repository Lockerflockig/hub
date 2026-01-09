UPDATE planets SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE coordinates = ? AND type = ?
