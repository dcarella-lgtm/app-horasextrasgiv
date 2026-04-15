import { useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import EmployeeDetail from './components/EmployeeDetail';

// Normaliza cabeceras del Excel: trim + lowercase + sin acentos
const normalizeKey = (key) =>
  key
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'upload' | 'detail'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [dataPreview, setDataPreview] = useState([]);

  // --- Navegación ---
  const goToDashboard = () => { setView('dashboard'); setSelectedEmployee(null); };
  const goToUpload = () => { setView('upload'); };
  const goToDetail = (legajo, nombre) => {
    setSelectedEmployee({ legajo, nombre });
    setView('detail');
  };

  // --- Upload logic (sin cambios) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const targetSheet =
        wb.SheetNames.find(n => n.toLowerCase().includes('procesado')) 
        || wb.SheetNames[0];
      const ws = wb.Sheets[targetSheet];
      const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const normalizedData = rawData.map(row => {
        const normalized = {};
        Object.keys(row).forEach(key => {
          normalized[normalizeKey(key)] = row[key];
        });
        return normalized;
      });

      processExcelData(normalizedData);
    };
    reader.readAsBinaryString(file);
  };

  const processExcelData = (rawData) => {
    try {
      const employees = [];
      const records = [];
      const empSet = new Set();

      rawData.forEach(row => {
        const { legajo, nombre, fecha, hora_ingreso, hora_salida } = row;
        // Requerir nombre, legajo, fecha y ambas horas para considerar la fila válida
        if (!legajo || !nombre || !fecha || hora_ingreso === undefined || hora_salida === undefined || hora_ingreso === '' || hora_salida === '') {
            return; // Saltar filas incompletas
        }

        const legajoStr = String(legajo).trim();

        if (!empSet.has(legajoStr)) {
          employees.push({ legajo: legajoStr, nombre: String(nombre).trim() });
          empSet.add(legajoStr);
        }

        if (fecha) {
          records.push({
            legajo: legajoStr,
            fecha: formatDate(fecha),
            hora_ingreso: formatTime(hora_ingreso),
            hora_salida: formatTime(hora_salida),
          });
        }
      });

      if (employees.length === 0) {
        setStatus('Error: No se encontraron datos válidos en el archivo.');
        return;
      }

      setDataPreview(records.slice(0, 5));
      syncWithSupabase(employees, records);
    } catch (err) {
      setStatus('Error al procesar archivo: ' + err.message);
    }
  };

  const syncWithSupabase = async (employees, records) => {
    setLoading(true);
    setStatus('Sincronizando...');
    try {
      const response = await axios.post('/api/process', { employees, records });
      const { empleados, registros } = response.data;
      setStatus(`✓ ${empleados} empleados, ${registros} registros sincronizados.`);
    } catch (err) {
      console.error(err);
      setStatus('Error en sincronización: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (val) => {
    if (typeof val === 'number') {
      return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
    }
    if (typeof val === 'string' && val.trim()) {
      let str = val.trim();
      // Detectar si la fecha viene con barras (ej: 15/04/2026)
      if (str.includes('/')) {
        const parts = str.split('/');
        // Asumir que el año es el de 4 digitos
        if (parts.length === 3) {
            let year, month, day;
            if (parts[2].length === 4) {
                 year = parts[2];
                 // Intentar deducir DD/MM o MM/DD
                 if (Number(parts[0]) > 12) {
                     day = parts[0]; month = parts[1]; // DD/MM/YYYY
                 } else {
                     // Si no se puede deducir seguro, asume DD/MM/YYYY que es más comun latam
                     day = parts[0]; month = parts[1]; 
                 }
            } else if (parts[0].length === 4) {
                 year = parts[0]; month = parts[1]; day = parts[2]; // YYYY/MM/DD
            }
            if (year && month && day) {
                 return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            }
        }
      }
      // Reemplazo básico de / a - si no se armó arriba
      str = str.replace(/\//g, '-');
      // Intentar forzar el formato YYYY-MM-DD final a través del Date de Javascript (fallback)
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
      }
      return str; 
    }
    return null;
  };

  const formatTime = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    if (typeof val === 'number') {
      const totalSeconds = Math.round(val * 86400);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (typeof val === 'string') return val.trim();
    return null;
  };

  const isError = status.startsWith('Error');

  // --- Render ---
  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem', borderBottom: '2px solid #eee', paddingBottom: '1rem' }}>
        <h1 style={{ marginBottom: '0.75rem' }}>Gestión de Horas Extras</h1>
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          <NavBtn label="Dashboard" active={view === 'dashboard' || view === 'detail'} onClick={goToDashboard} />
          <NavBtn label="Cargar Excel" active={view === 'upload'} onClick={goToUpload} />
        </nav>
      </header>

      <main>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>

          {/* Vista: Dashboard */}
          {view === 'dashboard' && (
            <Dashboard onSelectEmployee={goToDetail} />
          )}

          {/* Vista: Detalle de empleado */}
          {view === 'detail' && selectedEmployee && (
            <EmployeeDetail
              legajo={selectedEmployee.legajo}
              nombre={selectedEmployee.nombre}
              onBack={goToDashboard}
            />
          )}

          {/* Vista: Upload */}
          {view === 'upload' && (
            <>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Seleccionar Archivo Excel:
              </label>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Columnas esperadas: <code>legajo, nombre, fecha, hora_ingreso, hora_salida</code>
              </p>
              <input
                type="file"
                accept=".xlsx, .xlsm"
                onChange={handleFileUpload}
                disabled={loading}
                style={{ marginBottom: '1.5rem', width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px' }}
              />

              {status && (
                <div style={{
                  padding: '1rem', borderRadius: '8px',
                  backgroundColor: isError ? '#fee2e2' : '#dcfce7',
                  color: isError ? '#991b1b' : '#166534',
                  marginBottom: '1.5rem',
                }}>
                  {status}
                </div>
              )}

              {dataPreview.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '0.75rem' }}>Vista Previa (5 registros):</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                        <th style={{ padding: '0.5rem' }}>Legajo</th>
                        <th style={{ padding: '0.5rem' }}>Fecha</th>
                        <th style={{ padding: '0.5rem' }}>Ingreso</th>
                        <th style={{ padding: '0.5rem' }}>Salida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataPreview.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '0.5rem' }}>{row.legajo}</td>
                          <td style={{ padding: '0.5rem' }}>{row.fecha}</td>
                          <td style={{ padding: '0.5rem' }}>{row.hora_ingreso}</td>
                          <td style={{ padding: '0.5rem' }}>{row.hora_salida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      <footer style={{ marginTop: '2rem', textAlign: 'center', color: '#999', fontSize: '0.8rem' }}>
        App-Horas v1.1 | Backend Serverless + Supabase
      </footer>
    </div>
  );
}

function NavBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        border: active ? '2px solid #2563eb' : '1px solid #ddd',
        background: active ? '#eff6ff' : 'transparent',
        color: active ? '#2563eb' : '#666',
        fontWeight: active ? '600' : '400',
        cursor: 'pointer',
        fontSize: '0.9rem',
      }}
    >
      {label}
    </button>
  );
}

export default App;




