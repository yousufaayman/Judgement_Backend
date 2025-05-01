
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { db, initDatabase } = require('./database');
const app = express();
const PORT = 3000;


const SALT_ROUNDS = 10;


app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.json()); 


app.get('/init-db', (req, res) => {
  try {
    initDatabase();
    res.json({ message: 'Database initialized successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const normalizedUsername = username.toLowerCase();

    if (!normalizedUsername || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (normalizedUsername.length < 6) {
      return res.status(400).json({ error: 'Username must be at least 6 characters long' });
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one capital letter and one digit' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const insertUserSql = `INSERT INTO users (username, password) VALUES (?, ?)`;

    db.run(insertUserSql, [normalizedUsername, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: err.message });
      }

      const userId = this.lastID;

      const levels = ['LEVEL1', 'LEVEL2', 'LEVEL3'];
      let completed = 0;
      let totalLevels = levels.length;

      const initProgressSql = `INSERT INTO player_progress (user_id, level_id, unlocked, high_score) VALUES (?, ?, ?, ?)`;

      db.run(initProgressSql, [userId, 'LEVEL1', true, 0], function(err) {
        if (err) {
          console.error('Error initializing first level:', err.message);
        }
        completed++;
        checkComplete();
      });

      for (let i = 1; i < levels.length; i++) {
        db.run(initProgressSql, [userId, levels[i], false, 0], function(err) {
          if (err) {
            console.error(`Error initializing ${levels[i]}:`, err.message);
          }
          completed++;
          checkComplete();
        });
      }

      function checkComplete() {
        if (completed === totalLevels) {
          res.status(201).json({ 
            message: 'User registered successfully', 
            id: userId, 
            username: normalizedUsername
          });
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    
    console.log("Received login request with username:", username);
    console.log("Received password:", password);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const normalizedUsername = username.toLowerCase();  

    const sql = `SELECT * FROM users WHERE username = ?`;
    db.get(sql, [normalizedUsername], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      console.log("Stored hash:", user.password);
      console.log("Input password:", password);

      const validPassword = await bcrypt.compare(password, user.password);
      console.log("Password match result:", validPassword);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      res.json({
        message: 'Login successful',
        id: user.id,
        username: user.username
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/user/:id', (req, res) => {
  const userId = req.params.id;
  
  
  const sql = `
    SELECT 
      u.id, u.username, u.created_at,
      pp.level_id, pp.unlocked, pp.high_score, pp.last_played
    FROM users u
    LEFT JOIN player_progress pp ON u.id = pp.user_id
    WHERE u.id = ?
  `;
  
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    
    const user = {
      id: rows[0].id,
      username: rows[0].username,
      created_at: rows[0].created_at,
      progress: {}
    };
    
    
    rows.forEach(row => {
      if (row.level_id) {
        user.progress[row.level_id] = {
          unlocked: row.unlocked === 1, 
          high_score: row.high_score,
          last_played: row.last_played
        };
      }
    });
    
    res.json(user);
  });
});


app.post('/update-score', (req, res) => {
  const { user_id, level_id, score } = req.body;
  
  if (!user_id || !level_id || score === undefined) {
    return res.status(400).json({ error: 'User ID, Level ID and score are required' });
  }
  
  
  const checkScoreSql = `
    SELECT high_score FROM player_progress
    WHERE user_id = ? AND level_id = ?
  `;
  
  db.get(checkScoreSql, [user_id, level_id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    
    if (!row || score > row.high_score) {
      const updateScoreSql = `
        INSERT INTO player_progress (user_id, level_id, high_score, last_played, unlocked)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
        ON CONFLICT(user_id, level_id) 
        DO UPDATE SET high_score = ?, last_played = CURRENT_TIMESTAMP
      `;
      
      db.run(updateScoreSql, [user_id, level_id, score, score], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ 
          message: 'High score updated', 
          level_id,
          new_high_score: score,
          previous_high_score: row ? row.high_score : 0
        });
      });
    } else {
      
      const updateLastPlayedSql = `
        UPDATE player_progress
        SET last_played = CURRENT_TIMESTAMP
        WHERE user_id = ? AND level_id = ?
      `;
      
      db.run(updateLastPlayedSql, [user_id, level_id], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ 
          message: 'Score recorded but not a new high score', 
          level_id,
          current_high_score: row.high_score,
          submitted_score: score
        });
      });
    }
  });
});


app.post('/unlock-level', (req, res) => {
  const { user_id, level_id } = req.body;
  
  if (!user_id || !level_id) {
    return res.status(400).json({ error: 'User ID and Level ID are required' });
  }
  
  const sql = `
    INSERT INTO player_progress (user_id, level_id, unlocked, high_score, last_played)
    VALUES (?, ?, 1, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, level_id) 
    DO UPDATE SET unlocked = 1
  `;
  
  db.run(sql, [user_id, level_id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json({ message: `Level ${level_id} unlocked successfully` });
  });
});


app.get('/leaderboard/:level_id', (req, res) => {
  const level_id = req.params.level_id;
  
  const sql = `
    SELECT u.username, pp.high_score, pp.last_played
    FROM player_progress pp
    JOIN users u ON pp.user_id = u.id
    WHERE pp.level_id = ? AND pp.high_score > 0
    ORDER BY pp.high_score DESC
    LIMIT 20
  `;
  
  db.all(sql, [level_id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json({
      level_id,
      leaderboard: rows
    });
  });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Initialize database by visiting http://localhost:${PORT}/init-db`);
});