
--@block
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(32) NOT NULL,
    password VARCHAR(255) NOT NULL
);

--@block
SELECT password FROM users Where username = "uwu";

--@block
SELECT * FROM users;

--@block
ALTER TABLE users ADD UNIQUE (username)

--@block
CREATE TABLE posts (
    author_id BIGINT NOT NULL,
    post_title VARCHAR(255) NOT NULL UNIQUE,
    post_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(user_id)
);

--@block
DELETE FROM posts;
DELETE FROM users;

--@block
SELECT users.username AS author, posts.post_title,posts.post_content,posts.created_at
FROM posts
INNER JOIN users ON posts.author_id = users.user_id;