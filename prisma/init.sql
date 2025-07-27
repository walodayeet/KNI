-- =============================================================================
-- KNI Platform - PostgreSQL Initialization Script
-- =============================================================================
-- This script initializes the PostgreSQL database for the KNI Platform
-- It's automatically executed when the PostgreSQL container starts

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- CREATE DATABASE IF NOT EXISTS kni_db;

-- Create user if it doesn't exist (handled by POSTGRES_USER env var)
-- CREATE USER IF NOT EXISTS kni_user WITH PASSWORD 'your_password';

-- Grant privileges
-- GRANT ALL PRIVILEGES ON DATABASE kni_db TO kni_user;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom functions for better performance
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create indexes for better search performance
-- Note: These will be created by Prisma migrations, but we can prepare the database

-- Log the initialization
DO $$
BEGIN
    RAISE NOTICE 'KNI Platform database initialized successfully';
END $$;

-- Set timezone
SET timezone = 'UTC';

-- Configure some PostgreSQL settings for better performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Note: These settings require a PostgreSQL restart to take effect
-- In a Docker environment, they will be applied on container restart