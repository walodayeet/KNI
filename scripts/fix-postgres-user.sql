-- =============================================================================
-- Fix PostgreSQL User Issue for Coolify Deployment
-- =============================================================================
-- Run this script as postgres user to create kni_user and fix permissions

-- Create the kni_user if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kni_user') THEN
        CREATE USER kni_user WITH PASSWORD 'your_password_here';
        RAISE NOTICE 'Created user kni_user';
    ELSE
        RAISE NOTICE 'User kni_user already exists';
    END IF;
END
$$;

-- Create the kni_db database if it doesn't exist
SELECT 'CREATE DATABASE kni_db OWNER kni_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kni_db')\gexec

-- Grant privileges on the kni_db database
\c kni_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO kni_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kni_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kni_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO kni_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO kni_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO kni_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO kni_user;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log completion
\echo 'PostgreSQL user setup completed successfully'