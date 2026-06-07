CREATE TABLE IF NOT EXISTS edit_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  action ENUM('INSERT','UPDATE') NOT NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  changed_by VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_edit_history_person (person_id),
  INDEX idx_edit_history_time (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
