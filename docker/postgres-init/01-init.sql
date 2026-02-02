-- OTT Platform PostgreSQL Initialization Script
-- This script is automatically executed when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  date_of_birth DATE,
  profile_picture_url TEXT,
  country VARCHAR(100),
  region VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user',
  is_banned BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(10) DEFAULT 'en',
  subtitle_language VARCHAR(10),
  subtitle_enabled BOOLEAN DEFAULT TRUE,
  autoplay_enabled BOOLEAN DEFAULT TRUE,
  autoplay_next_episode BOOLEAN DEFAULT TRUE,
  preferred_quality VARCHAR(10) DEFAULT '1080p',
  notification_email BOOLEAN DEFAULT TRUE,
  notification_push BOOLEAN DEFAULT TRUE,
  notification_sms BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_method VARCHAR(50),
  theme VARCHAR(20) DEFAULT 'dark',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SUBSCRIPTION & BILLING TABLES
-- =============================================

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  billing_period INT NOT NULL DEFAULT 30,
  max_devices INT DEFAULT 1,
  max_resolution VARCHAR(10) DEFAULT '1080p',
  allows_download BOOLEAN DEFAULT FALSE,
  features JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  renewal_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  payment_gateway VARCHAR(100),
  gateway_response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- =============================================
-- AUDIT & LOGGING TABLES
-- =============================================

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================
-- Insert Default Subscription Plans
-- =============================================

INSERT INTO subscription_plans (name, description, price, billing_period, max_devices, max_resolution, allows_download, status)
VALUES 
  ('Free', 'Basic free tier with ads', 0, 30, 1, '720p', false, 'active'),
  ('Basic', 'HD streaming on 1 device', 9.99, 30, 1, '1080p', false, 'active'),
  ('Premium', 'HD streaming on 4 devices with downloads', 19.99, 30, 4, '4K', true, 'active'),
  ('Family', 'Ultra HD streaming on 6 devices with downloads', 29.99, 30, 6, '4K', true, 'active')
ON CONFLICT DO NOTHING;

-- =============================================
-- Create Roles and Set Permissions
-- =============================================

-- Create application user if not exists
DO
$do$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'ott_user') THEN
    CREATE USER ott_user WITH ENCRYPTED PASSWORD 'ott_password_secure';
  END IF;
END
$do$;

-- Grant permissions to ott_user
GRANT CONNECT ON DATABASE ott_platform TO ott_user;
GRANT USAGE ON SCHEMA public TO ott_user;
GRANT CREATE ON SCHEMA public TO ott_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ott_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ott_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ott_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ott_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ott_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ott_user;
