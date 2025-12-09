-- init-db/init.sql (Виправлений код для PostgreSQL)
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY, -- Правильний синтаксис PostgreSQL
    name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL
);