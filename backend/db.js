const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    // Tabla de Empleados
    db.run(`
      CREATE TABLE IF NOT EXISTS empleados (
        legajo TEXT PRIMARY KEY,
        nombre TEXT NOT NULL
      )
    `);

    // Tabla de Registros de Horas
    db.run(`
      CREATE TABLE IF NOT EXISTS registros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        legajo TEXT NOT NULL,
        fecha TEXT NOT NULL,
        hora_ingreso TEXT,
        hora_salida TEXT,
        FOREIGN KEY (legajo) REFERENCES empleados (legajo)
      )
    `);
  });
}

module.exports = db;
