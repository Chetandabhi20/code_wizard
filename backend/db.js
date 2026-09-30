require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

// Create connection promise for SQLite
const dbPromise = open({
  filename: path.join(__dirname, '..', 'database', 'civicflow.db'),
  driver: sqlite3.Database
});

// Initialize database schema
dbPromise.then(async (db) => {
  console.log('📦 Successfully connected to SQLite database (civicflow.db)!');
  
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Enforce foreign keys and apply schema
  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec(schema);
  console.log('📜 SQLite database schema ensured.');
}).catch(err => {
  console.error('❌ Database connection error:', err);
});

// Export a PostgreSQL-compatible query wrapper
module.exports = {
  query: async (text, params = []) => {
    const db = await dbPromise;
    // Replace Postgres placeholders ($1, $2) with SQLite placeholders (?)
    const sqliteText = text.replace(/\$\d+/g, '?');
    
    // Determine if query expects to return rows
    const isSelect = sqliteText.trim().match(/^(SELECT|WITH)/i) || sqliteText.toUpperCase().includes('RETURNING');
    
    if (isSelect) {
        const rows = await db.all(sqliteText, params);
        return { rows, rowCount: rows.length };
    } else {
        const result = await db.run(sqliteText, params);
        return { rows: [], rowCount: result.changes, lastID: result.lastID };
    }
  }
};