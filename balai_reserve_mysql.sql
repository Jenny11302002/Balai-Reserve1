-- ============================================================
-- Balai-Reserve – MySQL Schema
-- Compatible with Laragon / phpMyAdmin / MySQL 8.0+
-- 
-- HOW TO IMPORT IN LARAGON:
--   1. Start Laragon and click "Database" (opens HeidiSQL / phpMyAdmin)
--   2. Create a new database:  CREATE DATABASE balai_reserve CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   3. Select the "balai_reserve" database
--   4. Click Import → Choose this file → Execute
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `balai_reserve`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `balai_reserve`;

-- ─── ROLES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `roles` (
  `id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(50)     NOT NULL UNIQUE COMMENT 'admin | reservation_staff | marketing_staff | inventory_staff | customer',
  `label`      VARCHAR(100)    NOT NULL,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── USERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `role_id`       INT UNSIGNED    NOT NULL,
  `first_name`    VARCHAR(100)    NOT NULL,
  `last_name`     VARCHAR(100)    NOT NULL,
  `email`         VARCHAR(191)    NOT NULL UNIQUE,
  `password_hash` VARCHAR(255)    NOT NULL,
  `phone`         VARCHAR(30)     DEFAULT NULL,
  `avatar`        VARCHAR(500)    DEFAULT NULL,
  `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
  `last_login`    DATETIME        DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_users_role` (`role_id`),
  KEY `idx_users_email` (`email`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── CUSTOMERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `customers` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`           INT UNSIGNED    DEFAULT NULL,
  `customer_code`     VARCHAR(20)     UNIQUE DEFAULT NULL,
  `first_name`        VARCHAR(100)    NOT NULL,
  `last_name`         VARCHAR(100)    NOT NULL,
  `email`             VARCHAR(191)    DEFAULT NULL,
  `phone`             VARCHAR(30)     DEFAULT NULL,
  `address`           TEXT            DEFAULT NULL,
  `preferred_contact` ENUM('email','phone','sms') NOT NULL DEFAULT 'email',
  `customer_type`     ENUM('regular','vip','corporate') NOT NULL DEFAULT 'regular',
  `status`            ENUM('active','inactive','blacklisted') NOT NULL DEFAULT 'active',
  `notes`             TEXT            DEFAULT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_user` (`user_id`),
  KEY `idx_customers_code` (`customer_code`),
  CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ROOM TYPES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `room_types` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100)    NOT NULL UNIQUE COMMENT 'Standard | Deluxe | Suite | Family | Cottage',
  `description` TEXT            DEFAULT NULL,
  `base_price`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ROOMS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `rooms` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `room_type_id` INT UNSIGNED    NOT NULL,
  `room_number`  VARCHAR(20)     NOT NULL UNIQUE,
  `name`         VARCHAR(200)    NOT NULL,
  `description`  TEXT            DEFAULT NULL,
  `capacity`     TINYINT UNSIGNED NOT NULL DEFAULT 2,
  `price`        DECIMAL(10,2)   NOT NULL,
  `amenities`    JSON            DEFAULT NULL COMMENT 'JSON array of amenity strings',
  `images`       JSON            DEFAULT NULL COMMENT 'JSON array of image URL paths',
  `floor`        VARCHAR(50)     DEFAULT NULL,
  `status`       ENUM('available','reserved','occupied','cleaning','maintenance','unavailable') NOT NULL DEFAULT 'available',
  `is_active`    TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rooms_type`   (`room_type_id`),
  KEY `idx_rooms_status` (`status`),
  CONSTRAINT `fk_rooms_type` FOREIGN KEY (`room_type_id`) REFERENCES `room_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── VENUES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `venues` (
  `id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(200)    NOT NULL,
  `venue_type` ENUM('function_hall','outdoor','garden','pavilion','poolside','event_space') NOT NULL,
  `capacity`   SMALLINT UNSIGNED NOT NULL DEFAULT 50,
  `description` TEXT           DEFAULT NULL,
  `location`   VARCHAR(300)    DEFAULT NULL,
  `price`      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `price_note` VARCHAR(300)    DEFAULT NULL,
  `amenities`  JSON            DEFAULT NULL,
  `images`     JSON            DEFAULT NULL,
  `status`     ENUM('available','reserved','maintenance','unavailable') NOT NULL DEFAULT 'available',
  `is_active`  TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_venues_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── COTTAGES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `cottages` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200)    NOT NULL,
  `description` TEXT            DEFAULT NULL,
  `capacity`    TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `price`       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `amenities`   JSON            DEFAULT NULL,
  `images`      JSON            DEFAULT NULL,
  `status`      ENUM('available','reserved','occupied','maintenance','unavailable') NOT NULL DEFAULT 'available',
  `is_active`   TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cottages_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── EVENT PACKAGES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `event_packages` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200)    NOT NULL,
  `description` TEXT            DEFAULT NULL,
  `event_type`  ENUM('wedding','birthday','debut','corporate','meeting','party','family_gathering','other') DEFAULT NULL,
  `price`       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `inclusions`  JSON            DEFAULT NULL COMMENT 'JSON array of included items',
  `capacity`    SMALLINT UNSIGNED DEFAULT NULL,
  `is_active`   TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── RESERVATIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `reservations` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `booking_ref`       VARCHAR(30)     NOT NULL UNIQUE,
  `customer_id`       INT UNSIGNED    NOT NULL,
  `reservation_type`  ENUM('room','venue','event','cottage') NOT NULL,
  `check_in_date`     DATE            DEFAULT NULL,
  `check_out_date`    DATE            DEFAULT NULL,
  `event_date`        DATE            DEFAULT NULL,
  `start_time`        TIME            DEFAULT NULL,
  `end_time`          TIME            DEFAULT NULL,
  `num_guests`        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `special_requests`  TEXT            DEFAULT NULL,
  `total_amount`      DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `downpayment_req`   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `status`            ENUM('pending','awaiting_payment','confirmed','checked_in','completed','cancelled','rejected','no_show') NOT NULL DEFAULT 'pending',
  `payment_status`    ENUM('unpaid','partially_paid','fully_paid','refunded') NOT NULL DEFAULT 'unpaid',
  `assigned_staff_id` INT UNSIGNED    DEFAULT NULL,
  `notes`             TEXT            DEFAULT NULL,
  `source`            ENUM('walk_in','online','phone','staff') NOT NULL DEFAULT 'walk_in',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_booking_ref` (`booking_ref`),
  KEY `idx_res_customer`   (`customer_id`),
  KEY `idx_res_status`     (`status`),
  KEY `idx_res_dates`      (`check_in_date`,`check_out_date`),
  KEY `idx_res_staff`      (`assigned_staff_id`),
  CONSTRAINT `fk_res_customer` FOREIGN KEY (`customer_id`)       REFERENCES `customers` (`id`),
  CONSTRAINT `fk_res_staff`    FOREIGN KEY (`assigned_staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── RESERVATION ITEMS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `reservation_items` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id` INT UNSIGNED    NOT NULL,
  `item_type`      ENUM('room','venue','cottage','event_package','equipment') NOT NULL,
  `item_id`        INT UNSIGNED    NOT NULL,
  `item_name`      VARCHAR(300)    DEFAULT NULL,
  `quantity`       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price`     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `total_price`    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `notes`          TEXT            DEFAULT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ri_reservation` (`reservation_id`),
  CONSTRAINT `fk_ri_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── RESERVATION STATUS HISTORY ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `reservation_status_history` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id` INT UNSIGNED    NOT NULL,
  `from_status`    VARCHAR(30)     DEFAULT NULL,
  `to_status`      VARCHAR(30)     NOT NULL,
  `changed_by`     INT UNSIGNED    DEFAULT NULL,
  `notes`          TEXT            DEFAULT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rsh_reservation` (`reservation_id`),
  CONSTRAINT `fk_rsh_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rsh_user`        FOREIGN KEY (`changed_by`)     REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── EVENTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `events` (
  `id`               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id`   INT UNSIGNED    DEFAULT NULL,
  `customer_id`      INT UNSIGNED    NOT NULL,
  `event_package_id` INT UNSIGNED    DEFAULT NULL,
  `venue_id`         INT UNSIGNED    DEFAULT NULL,
  `event_name`       VARCHAR(300)    NOT NULL,
  `event_type`       ENUM('wedding','birthday','debut','corporate','meeting','party','family_gathering','other') NOT NULL,
  `event_date`       DATE            NOT NULL,
  `start_time`       TIME            NOT NULL,
  `end_time`         TIME            NOT NULL,
  `num_attendees`    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `special_requests` TEXT            DEFAULT NULL,
  `equipment_needs`  JSON            DEFAULT NULL,
  `status`           ENUM('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  `total_cost`       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `payment_status`   ENUM('unpaid','partially_paid','fully_paid','refunded') NOT NULL DEFAULT 'unpaid',
  `notes`            TEXT            DEFAULT NULL,
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_events_date`        (`event_date`),
  KEY `idx_events_customer`    (`customer_id`),
  KEY `idx_events_reservation` (`reservation_id`),
  CONSTRAINT `fk_events_reservation`   FOREIGN KEY (`reservation_id`)   REFERENCES `reservations`   (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_events_customer`      FOREIGN KEY (`customer_id`)       REFERENCES `customers`      (`id`),
  CONSTRAINT `fk_events_package`       FOREIGN KEY (`event_package_id`)  REFERENCES `event_packages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_events_venue`         FOREIGN KEY (`venue_id`)          REFERENCES `venues`         (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── PAYMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payments` (
  `id`               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id`   INT UNSIGNED    NOT NULL,
  `reference_number` VARCHAR(100)    UNIQUE DEFAULT NULL,
  `amount`           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `payment_method`   ENUM('cash','gcash','bank_transfer','credit_card','check') NOT NULL DEFAULT 'cash',
  `payment_date`     DATE            NOT NULL,
  `payment_type`     ENUM('downpayment','full_payment','balance','refund') NOT NULL DEFAULT 'downpayment',
  `status`           ENUM('received','verified','refunded') NOT NULL DEFAULT 'received',
  `received_by`      INT UNSIGNED    DEFAULT NULL,
  `notes`            TEXT            DEFAULT NULL,
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payments_reservation` (`reservation_id`),
  KEY `idx_payments_date`        (`payment_date`),
  CONSTRAINT `fk_payments_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `fk_payments_user`        FOREIGN KEY (`received_by`)    REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── GUESTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `guests` (
  `id`               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id`   INT UNSIGNED    NOT NULL,
  `customer_id`      INT UNSIGNED    DEFAULT NULL,
  `first_name`       VARCHAR(100)    NOT NULL,
  `last_name`        VARCHAR(100)    NOT NULL,
  `email`            VARCHAR(191)    DEFAULT NULL,
  `phone`            VARCHAR(30)     DEFAULT NULL,
  `address`          TEXT            DEFAULT NULL,
  `id_type`          ENUM('passport','drivers_license','national_id','other') DEFAULT NULL,
  `id_number`        VARCHAR(100)    DEFAULT NULL,
  `num_guests`       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `special_requests` TEXT            DEFAULT NULL,
  `status`           ENUM('expected','checked_in','checked_out','no_show') NOT NULL DEFAULT 'expected',
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_guests_reservation` (`reservation_id`),
  KEY `idx_guests_customer`    (`customer_id`),
  CONSTRAINT `fk_guests_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `fk_guests_customer`    FOREIGN KEY (`customer_id`)    REFERENCES `customers`    (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── CHECK-INS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `check_ins` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id` INT UNSIGNED    NOT NULL,
  `guest_id`       INT UNSIGNED    DEFAULT NULL,
  `checked_in_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checked_in_by`  INT UNSIGNED    DEFAULT NULL,
  `method`         ENUM('manual','qr') NOT NULL DEFAULT 'manual',
  `notes`          TEXT            DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_checkins_reservation` (`reservation_id`),
  CONSTRAINT `fk_checkins_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `fk_checkins_user`        FOREIGN KEY (`checked_in_by`)  REFERENCES `users`        (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── CHECK-OUTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `check_outs` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id`  INT UNSIGNED    NOT NULL,
  `guest_id`        INT UNSIGNED    DEFAULT NULL,
  `checked_out_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checked_out_by`  INT UNSIGNED    DEFAULT NULL,
  `notes`           TEXT            DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_checkouts_reservation` (`reservation_id`),
  CONSTRAINT `fk_checkouts_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `fk_checkouts_user`        FOREIGN KEY (`checked_out_by`) REFERENCES `users`        (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── QR CODES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `qr_codes` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id` INT UNSIGNED    NOT NULL,
  `token`          VARCHAR(100)    NOT NULL UNIQUE,
  `qr_path`        VARCHAR(500)    DEFAULT NULL,
  `used`           TINYINT(1)      NOT NULL DEFAULT 0,
  `used_at`        DATETIME        DEFAULT NULL,
  `expires_at`     DATETIME        DEFAULT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_qr_reservation` (`reservation_id`),
  KEY `idx_qr_token`       (`token`),
  CONSTRAINT `fk_qr_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── FEEDBACK & RATINGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `feedback` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id` INT UNSIGNED    NOT NULL,
  `customer_id`    INT UNSIGNED    NOT NULL,
  `rating`         TINYINT UNSIGNED NOT NULL COMMENT '1-5',
  `category`       ENUM('overall','room','venue','service','event') DEFAULT 'overall',
  `comments`       TEXT            DEFAULT NULL,
  `suggestions`    TEXT            DEFAULT NULL,
  `is_public`      TINYINT(1)      NOT NULL DEFAULT 1,
  `admin_response` TEXT            DEFAULT NULL,
  `responded_by`   INT UNSIGNED    DEFAULT NULL,
  `responded_at`   DATETIME        DEFAULT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_rating` CHECK (`rating` BETWEEN 1 AND 5),
  KEY `idx_feedback_reservation` (`reservation_id`),
  KEY `idx_feedback_customer`    (`customer_id`),
  CONSTRAINT `fk_feedback_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `fk_feedback_customer`    FOREIGN KEY (`customer_id`)    REFERENCES `customers`    (`id`),
  CONSTRAINT `fk_feedback_staff`       FOREIGN KEY (`responded_by`)   REFERENCES `users`        (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── INQUIRIES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inquiries` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `customer_id` INT UNSIGNED    DEFAULT NULL,
  `name`        VARCHAR(200)    DEFAULT NULL,
  `email`       VARCHAR(191)    DEFAULT NULL,
  `phone`       VARCHAR(30)     DEFAULT NULL,
  `subject`     VARCHAR(500)    NOT NULL,
  `message`     TEXT            NOT NULL,
  `category`    ENUM('general','room','venue','event','pricing','complaint','other') NOT NULL DEFAULT 'general',
  `source`      ENUM('website','chatbot','email','phone','walk_in') NOT NULL DEFAULT 'website',
  `status`      ENUM('open','in_progress','escalated','resolved','closed') NOT NULL DEFAULT 'open',
  `assigned_to` INT UNSIGNED    DEFAULT NULL,
  `resolution`  TEXT            DEFAULT NULL,
  `resolved_at` DATETIME        DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inquiries_customer`  (`customer_id`),
  KEY `idx_inquiries_status`    (`status`),
  KEY `idx_inquiries_assigned`  (`assigned_to`),
  CONSTRAINT `fk_inquiries_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inquiries_staff`    FOREIGN KEY (`assigned_to`) REFERENCES `users`     (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── CRM ACTIVITIES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `crm_activities` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `customer_id`   INT UNSIGNED    NOT NULL,
  `activity_type` ENUM('call','email','chat','support','follow_up','inquiry','complaint','feedback') NOT NULL,
  `subject`       VARCHAR(500)    DEFAULT NULL,
  `description`   TEXT            DEFAULT NULL,
  `staff_id`      INT UNSIGNED    DEFAULT NULL,
  `status`        ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'completed',
  `scheduled_at`  DATETIME        DEFAULT NULL,
  `completed_at`  DATETIME        DEFAULT NULL,
  `follow_up_at`  DATETIME        DEFAULT NULL,
  `outcome`       TEXT            DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_customer` (`customer_id`),
  KEY `idx_crm_staff`    (`staff_id`),
  CONSTRAINT `fk_crm_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_crm_staff`    FOREIGN KEY (`staff_id`)    REFERENCES `users`     (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── SALES CALLS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sales_calls` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `customer_id`  INT UNSIGNED    NOT NULL,
  `staff_id`     INT UNSIGNED    NOT NULL,
  `call_date`    DATE            NOT NULL,
  `call_time`    TIME            DEFAULT NULL,
  `purpose`      VARCHAR(500)    NOT NULL,
  `result`       TEXT            DEFAULT NULL,
  `notes`        TEXT            DEFAULT NULL,
  `follow_up_at` DATETIME        DEFAULT NULL,
  `status`       ENUM('scheduled','completed','no_answer','cancelled') NOT NULL DEFAULT 'completed',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_calls_customer` (`customer_id`),
  KEY `idx_calls_staff`    (`staff_id`),
  CONSTRAINT `fk_calls_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_calls_staff`    FOREIGN KEY (`staff_id`)    REFERENCES `users`     (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── MARKETING EMAILS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `marketing_emails` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `customer_id`  INT UNSIGNED    DEFAULT NULL,
  `campaign`     VARCHAR(200)    DEFAULT NULL,
  `recipient`    VARCHAR(191)    NOT NULL,
  `subject`      VARCHAR(500)    NOT NULL,
  `body`         TEXT            DEFAULT NULL,
  `sent_at`      DATETIME        DEFAULT NULL,
  `status`       ENUM('draft','sent','failed','bounced') NOT NULL DEFAULT 'draft',
  `follow_up_at` DATETIME        DEFAULT NULL,
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emails_customer` (`customer_id`),
  CONSTRAINT `fk_emails_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── SUPPORT TICKETS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `ticket_number`  VARCHAR(20)     NOT NULL UNIQUE,
  `customer_id`    INT UNSIGNED    DEFAULT NULL,
  `inquiry_id`     INT UNSIGNED    DEFAULT NULL,
  `subject`        VARCHAR(500)    NOT NULL,
  `description`    TEXT            NOT NULL,
  `category`       VARCHAR(50)     NOT NULL DEFAULT 'general',
  `priority`       ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `assigned_to`    INT UNSIGNED    DEFAULT NULL,
  `status`         ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `resolution`     TEXT            DEFAULT NULL,
  `resolved_at`    DATETIME        DEFAULT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tickets_customer` (`customer_id`),
  KEY `idx_tickets_inquiry`  (`inquiry_id`),
  KEY `idx_tickets_assigned` (`assigned_to`),
  CONSTRAINT `fk_tickets_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)    ON DELETE SET NULL,
  CONSTRAINT `fk_tickets_inquiry`  FOREIGN KEY (`inquiry_id`)  REFERENCES `inquiries` (`id`)    ON DELETE SET NULL,
  CONSTRAINT `fk_tickets_staff`    FOREIGN KEY (`assigned_to`) REFERENCES `users`     (`id`)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── INVENTORY CATEGORIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_categories` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100)    NOT NULL UNIQUE,
  `description` TEXT            DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── INVENTORY ITEMS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `category_id`   INT UNSIGNED    NOT NULL,
  `item_code`     VARCHAR(50)     UNIQUE DEFAULT NULL,
  `name`          VARCHAR(200)    NOT NULL,
  `description`   TEXT            DEFAULT NULL,
  `unit`          VARCHAR(20)     NOT NULL DEFAULT 'pcs',
  `total_qty`     INT UNSIGNED    NOT NULL DEFAULT 0,
  `available_qty` INT UNSIGNED    NOT NULL DEFAULT 0,
  `reserved_qty`  INT UNSIGNED    NOT NULL DEFAULT 0,
  `damaged_qty`   INT UNSIGNED    NOT NULL DEFAULT 0,
  `reorder_level` INT UNSIGNED    NOT NULL DEFAULT 5,
  `location`      VARCHAR(200)    DEFAULT NULL,
  `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_items_category` (`category_id`),
  CONSTRAINT `fk_inv_items_category` FOREIGN KEY (`category_id`) REFERENCES `inventory_categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── INVENTORY TRANSACTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id`               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `item_id`          INT UNSIGNED    NOT NULL,
  `transaction_type` ENUM('reserved','released','damaged','repaired','added','removed','lost') NOT NULL,
  `quantity`         INT             NOT NULL DEFAULT 1,
  `reference_id`     INT UNSIGNED    DEFAULT NULL,
  `reference_type`   ENUM('reservation','event') DEFAULT NULL,
  `performed_by`     INT UNSIGNED    DEFAULT NULL,
  `notes`            TEXT            DEFAULT NULL,
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_txn_item`  (`item_id`),
  KEY `idx_inv_txn_staff` (`performed_by`),
  CONSTRAINT `fk_inv_txn_item`  FOREIGN KEY (`item_id`)      REFERENCES `inventory_items` (`id`),
  CONSTRAINT `fk_inv_txn_staff` FOREIGN KEY (`performed_by`) REFERENCES `users`           (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── EQUIPMENT ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `equipment` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `category_id`       INT UNSIGNED    DEFAULT NULL,
  `equipment_code`    VARCHAR(50)     UNIQUE DEFAULT NULL,
  `name`              VARCHAR(200)    NOT NULL,
  `description`       TEXT            DEFAULT NULL,
  `quantity`          INT UNSIGNED    NOT NULL DEFAULT 1,
  `condition`         ENUM('excellent','good','needs_maintenance','damaged','lost') NOT NULL DEFAULT 'good',
  `available_qty`     INT UNSIGNED    NOT NULL DEFAULT 1,
  `maintenance_notes` TEXT            DEFAULT NULL,
  `is_active`         TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_equipment_category` (`category_id`),
  CONSTRAINT `fk_equipment_category` FOREIGN KEY (`category_id`) REFERENCES `inventory_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── EQUIPMENT ASSIGNMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `equipment_assignments` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `equipment_id`    INT UNSIGNED    NOT NULL,
  `reservation_id`  INT UNSIGNED    DEFAULT NULL,
  `event_id`        INT UNSIGNED    DEFAULT NULL,
  `quantity`        INT UNSIGNED    NOT NULL DEFAULT 1,
  `assigned_by`     INT UNSIGNED    DEFAULT NULL,
  `date_assigned`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expected_return` DATETIME        DEFAULT NULL,
  `actual_return`   DATETIME        DEFAULT NULL,
  `condition_out`   ENUM('excellent','good','needs_maintenance','damaged') DEFAULT 'good',
  `condition_in`    ENUM('excellent','good','needs_maintenance','damaged','lost') DEFAULT NULL,
  `status`          ENUM('assigned','returned','damaged','lost') NOT NULL DEFAULT 'assigned',
  `notes`           TEXT            DEFAULT NULL,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ea_equipment`   (`equipment_id`),
  KEY `idx_ea_reservation` (`reservation_id`),
  KEY `idx_ea_event`       (`event_id`),
  CONSTRAINT `fk_ea_equipment`   FOREIGN KEY (`equipment_id`)   REFERENCES `equipment`    (`id`),
  CONSTRAINT `fk_ea_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ea_event`       FOREIGN KEY (`event_id`)       REFERENCES `events`       (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ea_user`        FOREIGN KEY (`assigned_by`)    REFERENCES `users`        (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED    DEFAULT NULL,
  `customer_id` INT UNSIGNED    DEFAULT NULL,
  `type`        ENUM('reservation','payment','event','inventory','system','inquiry') NOT NULL,
  `title`       VARCHAR(300)    NOT NULL,
  `message`     TEXT            NOT NULL,
  `link`        VARCHAR(500)    DEFAULT NULL,
  `is_read`     TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user`        (`user_id`, `is_read`),
  KEY `idx_notif_customer`    (`customer_id`),
  CONSTRAINT `fk_notif_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notif_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── FOLLOW-UPS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `follow_ups` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `reservation_id` INT UNSIGNED    DEFAULT NULL,
  `customer_id`    INT UNSIGNED    NOT NULL,
  `follow_up_type` ENUM('booking_inquiry','payment_reminder','event_reminder','checkin_reminder','post_stay','feedback_request') NOT NULL,
  `scheduled_at`   DATETIME        NOT NULL,
  `sent_at`        DATETIME        DEFAULT NULL,
  `status`         ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
  `message`        TEXT            DEFAULT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_followup_reservation` (`reservation_id`),
  KEY `idx_followup_customer`    (`customer_id`),
  CONSTRAINT `fk_followup_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_followup_customer`    FOREIGN KEY (`customer_id`)    REFERENCES `customers`    (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── AUDIT LOGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED    DEFAULT NULL,
  `action`     VARCHAR(100)    NOT NULL,
  `module`     VARCHAR(100)    NOT NULL,
  `record_id`  INT UNSIGNED    DEFAULT NULL,
  `old_values` JSON            DEFAULT NULL,
  `new_values` JSON            DEFAULT NULL,
  `ip_address` VARCHAR(45)     DEFAULT NULL,
  `user_agent` VARCHAR(500)    DEFAULT NULL,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user`   (`user_id`),
  KEY `idx_audit_module` (`module`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── AI INSIGHTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_insights` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `insight_type`  ENUM('trend','recommendation','forecast','alert') NOT NULL,
  `category`      ENUM('reservations','revenue','inventory','events','satisfaction') DEFAULT NULL,
  `title`         VARCHAR(300)    NOT NULL,
  `message`       TEXT            NOT NULL,
  `data_basis`    JSON            DEFAULT NULL,
  `confidence`    ENUM('low','medium','high') DEFAULT NULL,
  `is_dismissed`  TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_insights_type` (`insight_type`, `is_dismissed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── SETTINGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `settings` (
  `id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `key`        VARCHAR(100)    NOT NULL UNIQUE,
  `value`      TEXT            DEFAULT NULL,
  `label`      VARCHAR(300)    DEFAULT NULL,
  `group_name` VARCHAR(50)     NOT NULL DEFAULT 'general',
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_settings_group` (`group_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── SESSIONS (connect-sqlite3 equivalent for MySQL) ──────────────────────
CREATE TABLE IF NOT EXISTS `sessions` (
  `sid`     VARCHAR(255)    NOT NULL,
  `sess`    TEXT            NOT NULL,
  `expired` DATETIME        NOT NULL,
  PRIMARY KEY (`sid`),
  KEY `idx_sessions_expired` (`expired`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA — Default Roles and System Settings
-- ============================================================

INSERT IGNORE INTO `roles` (`name`, `label`) VALUES
  ('admin',             'Administrator'),
  ('reservation_staff', 'Reservation Staff'),
  ('marketing_staff',   'Marketing / Sales Staff'),
  ('inventory_staff',   'Inventory Staff'),
  ('customer',          'Customer / Guest');

INSERT IGNORE INTO `settings` (`key`, `value`, `label`, `group_name`) VALUES
  ('resort_name',         'Balai-Reserve',                           'Resort Name',                'general'),
  ('resort_tagline',      'Your Home Away From Home',                'Resort Tagline',             'general'),
  ('resort_address',      'Miciano Road, Quezon City, Philippines',  'Resort Address',             'general'),
  ('resort_phone',        '(02) 8123-4567',                         'Resort Phone',               'general'),
  ('resort_email',        'info@balai-reserve.com',                  'Resort Email',               'general'),
  ('check_in_time',       '14:00',                                   'Default Check-in Time',      'booking'),
  ('check_out_time',      '12:00',                                   'Default Check-out Time',     'booking'),
  ('downpayment_percent', '50',                                      'Downpayment Percentage (%)', 'booking'),
  ('cancellation_policy', 'Cancellations made 7 days before the event are eligible for a 50% refund. No refund for cancellations within 48 hours.', 'Cancellation Policy', 'booking'),
  ('followup_days',       '3',                                       'Follow-up Wait Days',        'automation'),
  ('currency_symbol',     '₱',                                       'Currency Symbol',            'general'),
  ('records_per_page',    '20',                                      'Records Per Page',           'display');

-- ============================================================
-- END OF SCHEMA
-- ============================================================
