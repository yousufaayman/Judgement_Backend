const sqlite3 = require('sqlite3').verbose();
const path = require('path');


const dbPath = path.resolve(__dirname, 'judgment.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});


const initDatabase = () => {
  console.log('Initializing database tables...');
  
  
  db.run('PRAGMA foreign_keys = ON');

  
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table created or already exists.');
    }
  });

  
  db.run(`CREATE TABLE IF NOT EXISTS player_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    level_id TEXT NOT NULL,
    unlocked BOOLEAN DEFAULT false,
    high_score INTEGER DEFAULT 0,
    last_played DATETIME,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, level_id)
  )`, (err) => {
    if (err) {
      console.error('Error creating player_progress table:', err.message);
    } else {
      console.log('Player progress table created or already exists.');
    }
  });
};


module.exports = {
  db,
  initDatabase
};