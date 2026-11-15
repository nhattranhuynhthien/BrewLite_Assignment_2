-- Ensure dedicated test database exists when initializing PostgreSQL container
SELECT 'CREATE DATABASE brewlite_test'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'brewlite_test'
)\gexec
