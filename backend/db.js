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
    const trimmed = sqliteText.trim();
    const isSelect = trimmed.match(/^(SELECT|WITH)/i);
    const hasReturning = trimmed.toUpperCase().includes('RETURNING');
    
    if (isSelect) {
        const rows = await db.all(sqliteText, params);
        return { rows, rowCount: rows.length };
    } else if (hasReturning) {
        // Try RETURNING first (SQLite 3.35+), fall back to manual SELECT
        try {
            const rows = await db.all(sqliteText, params);
            return { rows, rowCount: rows.length };
        } catch (e) {
            // Fallback: run without RETURNING, then SELECT the affected row
            const withoutReturning = sqliteText.replace(/\s+RETURNING\s+.*/i, ';');
            const result = await db.run(withoutReturning, params);
            
            // Determine table name from query
            const tableMatch = trimmed.match(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
            const table = tableMatch ? tableMatch[1] : null;
            
            if (table && result.lastID) {
                const rows = await db.all(`SELECT * FROM ${table} WHERE id = ?`, [result.lastID]);
                return { rows, rowCount: rows.length };
            } else if (table && result.changes > 0) {
                // For UPDATE/DELETE, try to get the row using the last param (usually the id)
                const idParam = params[params.length - 1];
                const rows = await db.all(`SELECT * FROM ${table} WHERE id = ?`, [idParam]);
                return { rows, rowCount: rows.length };
            }
            return { rows: [], rowCount: result.changes, lastID: result.lastID };
        }
    } else {
        const result = await db.run(sqliteText, params);
        return { rows: [], rowCount: result.changes, lastID: result.lastID };
    }
  }
};