-- Hemangi Glam Salon - MySQL schema
-- Run this in phpMyAdmin (XAMPP) or: mysql -u root < schema.sql

CREATE DATABASE IF NOT EXISTS salon_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE salon_db;

-- ---------------------------------------------------------------------------
-- Users (login / register)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80)  NOT NULL,
  email      VARCHAR(120) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  role       ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Add role column to existing databases (safe to run multiple times)
ALTER TABLE users
  MODIFY COLUMN role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER';

-- ---------------------------------------------------------------------------
-- Services (IDs match the React frontend catalog in services-data.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id          VARCHAR(40)  PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  price       VARCHAR(40)  NOT NULL,
  category    VARCHAR(80)  NOT NULL,
  description TEXT         NULL
);

-- ---------------------------------------------------------------------------
-- Appointments - one slot per date+time (prevents double-booking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  service_id VARCHAR(40)  NOT NULL,
  date       DATE         NOT NULL,
  time       VARCHAR(5)   NOT NULL,
  status     VARCHAR(20)  NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id),
  UNIQUE KEY unique_slot (date, time)
);

-- ---------------------------------------------------------------------------
-- Saved skin-tone analyses (optional feature used by try-on page)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skin_analyses (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  hex        VARCHAR(7)   NOT NULL,
  depth      VARCHAR(40)  NOT NULL,
  undertone  ENUM('warm', 'cool', 'neutral') NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Seed services from the salon menu
-- ---------------------------------------------------------------------------
INSERT INTO services (id, name, price, category, description) VALUES
  ('th-eye', 'Eyebrow', '40', 'Threading', NULL),
  ('th-lip', 'Upper Lips', '10', 'Threading', NULL),
  ('wx-hand', 'Hand Waxing', '150 / 300', 'Waxing', NULL),
  ('wx-halfleg', 'Half Leg Waxing', '200 / 400', 'Waxing', NULL),
  ('wx-fullleg', 'Full Leg Waxing', '400 / 800', 'Waxing', NULL),
  ('wx-face', 'Full Face', '150', 'Waxing', NULL),
  ('wx-arms', 'Under Arms', '40', 'Waxing', NULL),
  ('bl-herbal', 'Herbal / Oxy Bleach', '199', 'Bleach', NULL),
  ('bl-gold', 'Gold Bleach', '250', 'Bleach', NULL),
  ('cl-fruit', 'Fruit Cleanup', '300', 'Cleanup', NULL),
  ('cl-gold', 'Gold Cleanup', '399', 'Cleanup', NULL),
  ('cl-diamond', 'Diamond Cleanup', '399', 'Cleanup', NULL),
  ('cl-o3', 'O3+ Cleanup', '500', 'Cleanup', NULL),
  ('dt-raga', 'Raga D-Tan', '199', 'D-Tan', NULL),
  ('dt-o3', 'O3+ D-Tan', '299', 'D-Tan', NULL),
  ('mp-mani', 'Manicure', '399', 'Manicure & Pedicure', NULL),
  ('mp-pedi', 'Pedicure', '499', 'Manicure & Pedicure', NULL),
  ('hs-loreal', 'Loreal Spa (Lengthwise)', '500', 'Hair Spa', NULL),
  ('hs-keratin', 'Protein / Keratin Spa (Lengthwise)', '800', 'Hair Spa', NULL),
  ('hc-one', 'One Length', '150', 'Hair Cuts', NULL),
  ('hc-u', 'U Cut', '150', 'Hair Cuts', NULL),
  ('hc-step', 'Step Cut (Hair Wash)', '300', 'Hair Cuts', NULL),
  ('hc-layer', 'Layer Cut', '300', 'Hair Cuts', NULL),
  ('hc-butterfly', 'Butterfly Cut', '300', 'Hair Cuts', NULL),
  ('hc-feder', 'Feder Cut', '300', 'Hair Cuts', NULL),
  ('ht-botox', 'Botox', 'On request', 'Hair Treatments', NULL),
  ('ht-keratin', 'Keratin', 'On request', 'Hair Treatments', NULL),
  ('ht-cysteine', 'Cysteine', 'On request', 'Hair Treatments', NULL),
  ('ht-nano', 'Nanoplasty', 'On request', 'Hair Treatments', NULL),
  ('ht-smooth', 'Smoothening', 'On request', 'Hair Treatments', NULL),
  ('ht-kera', 'Kera Smooth', 'On request', 'Hair Treatments', NULL),
  ('hcol-high', 'Highlights Colour', 'On request', 'Hair Colour', NULL),
  ('hcol-global', 'Global Hair Colour', 'On request', 'Hair Colour', NULL),
  ('hcol-bal', 'Balayage Colour', 'On request', 'Hair Colour', NULL),
  ('ms-head', 'Oil Massage (Head)', 'On request', 'Massage', NULL),
  ('ms-body', 'Body Massage', 'On request', 'Massage', NULL),
  ('fc-fruit', 'Fruit Facial', '399', 'Facial', NULL),
  ('fc-dtan', 'D-Tan Facial', '399', 'Facial', NULL),
  ('fc-white', 'Whitening Facial', '499', 'Facial', NULL),
  ('fc-gold', 'Gold Facial', '599', 'Facial', NULL),
  ('fc-diamond', 'Diamond Facial', '599', 'Facial', NULL),
  ('fc-o3', 'O3+ Advance Facial', '1299', 'Facial', NULL),
  ('fc-hydra', 'Hydra Professional', '1999', 'Facial', NULL),
  ('nl-acrylic', 'Acrylic Extension', '1299', 'Nails', NULL),
  ('nl-gel-ext', 'Gel Extension', '1299', 'Nails', NULL),
  ('nl-temp', 'Temporary Extension', '1000', 'Nails', NULL),
  ('nl-gel-polish', 'Gel Polish (starting)', '300', 'Nails', NULL),
  ('br-engagement', 'Engagement Look', 'On request', 'Bridal Makeup Package', 'Makeup & hairstyle'),
  ('br-haldi', 'Haldi Look', 'On request', 'Bridal Makeup Package', 'Makeup & hairstyle'),
  ('br-vidhi', 'Vidhi Look', 'On request', 'Bridal Makeup Package', 'Makeup & hairstyle'),
  ('br-reception', 'Reception Look', 'On request', 'Bridal Makeup Package', 'Makeup & hairstyle'),
  ('br-inclusions', 'Inclusions', 'Included', 'Bridal Makeup Package', 'Jewellery, flower accessories & saree draping'),
  ('pb-package', 'Complete Pre-Bridal Package', '3000', 'Pre-Bridal Package', 'Bridal facial, full body wax, nail art, D-tan / bleach, manicure & pedicure')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------------------------------------------------------------------------
-- Admin audit log - records privileged actions (password resets, role changes)
-- Plain-text passwords are NEVER stored here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_actions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  admin_id     INT          NOT NULL,
  admin_email  VARCHAR(120) NOT NULL,
  action       VARCHAR(80)  NOT NULL,           -- e.g. 'password_reset', 'role_change'
  target_id    INT          NOT NULL,            -- user whose record was affected
  target_email VARCHAR(120) NOT NULL,
  detail       VARCHAR(255) NULL,               -- extra context, never the password itself
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
);

