const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de Multer para subida de archivos
const upload = multer({ dest: 'uploads/' });

// Helper para normalizar datos de Excel
const normalizeExcelData = (data) => {
  return data.map(row => {
    // Normalizar nombres de columnas a minúsculas y sin espacios si fuera necesario
    // Pero aquí asumimos las columnas especificadas por el usuario
    return {
      legajo: row.legajo || row.Legajo || '',
      nombre: row.nombre || row.Nombre || '',
      fecha: row.fecha || row.Fecha || '',
      hora_ingreso: row.hora_ingreso || row.hora_Ingreso || row.Ingreso || '',
      hora_salida: row.hora_salida || row.hora_Salida || row.Salida || ''
    };
  });
};

// Endpoint: Subir y Procesar Excel
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo.' });
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    const normalizedData = normalizeExcelData(rawData);

    // Guardar en Base de Datos
    db.serialize(() => {
      const stmtEmpleado = db.prepare('INSERT OR IGNORE INTO empleados (legajo, nombre) VALUES (?, ?)');
      const stmtRegistro = db.prepare('INSERT INTO registros (legajo, fecha, hora_ingreso, hora_salida) VALUES (?, ?, ?, ?)');

      normalizedData.forEach(row => {
        if (row.legajo && row.nombre) {
          stmtEmpleado.run(row.legajo, row.nombre);
          stmtRegistro.run(row.legajo, row.fecha, row.hora_ingreso, row.hora_salida);
        }
      });

      stmtEmpleado.finalize();
      stmtRegistro.finalize();
    });

    res.json({ message: 'Archivo procesado correctamente', count: normalizedData.length });
  } catch (err) {
    console.error('Error procesando Excel:', err);
    res.status(500).json({ error: 'Error al procesar el archivo Excel.' });
  }
});

// Endpoint: Listar Empleados
app.get('/api/empleados', (req, res) => {
  db.all('SELECT * FROM empleados ORDER BY nombre ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Endpoint: Ver Registros por Empleado
app.get('/api/registros/:legajo', (req, res) => {
  const { legajo } = req.params;
  db.all('SELECT * FROM registros WHERE legajo = ? ORDER BY fecha DESC', [legajo], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
