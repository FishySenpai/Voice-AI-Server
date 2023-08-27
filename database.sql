CREATE DATABASE voiceai;

CREATE TABLE text(
    text_id SERIAL PRIMARY KEY,
    description VARCHAR(255)
);
ALTER TABLE text
ADD COLUMN audio bytea;