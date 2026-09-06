-- Web Push Subscriptions Table
-- Run this migration against your MySQL database (XAMPP locally, Aiven in production).
-- This table stores one row per browser/device per user. ON DELETE CASCADE ensures
-- subscriptions are automatically cleaned up when the user account is deleted.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  endpoint     TEXT NOT NULL,
  p256dh       VARCHAR(512) NOT NULL,
  auth         VARCHAR(256) NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_push_sub_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_push_endpoint (endpoint(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
