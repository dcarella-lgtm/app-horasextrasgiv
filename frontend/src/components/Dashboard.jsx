import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard({ onSelectEmployee }) {
  const [empleados, setEmpleados] = useState([]);
  const [resumen, setResumen] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Traer empleados
    const { data: empData } = await supabase
      .from('empleados')
      .select('legajo, nombre')
      .order('nombre');

    // Traer resumen agrupado por legajo
    const { data: regData } = await supabase
      .from('registros_diarios')
      .select('legajo, horas_trabajadas, horas_50, horas_100');

    // Agrupar totales por legajo
    const totales = {};
    (regData || []).forEach(r => {
      if (!totales[r.legajo]) {
        totales[r.legajo] = { dias: 0, horas: 0, h50: 0, h100: 0 };
      }
      totales[r.legajo].dias += 1;
      totales[r.legajo].horas += Number(r.horas_trabajadas) || 0;
      totales[r.legajo].h50 += Number(r.horas_50) || 0;
      totales[r.legajo].h100 += Number(r.horas_100) || 0;
    });

    setEmpleados(empData || []);
    setResumen(totales);
    setLoading(false);
  };

  if (loading) return <p style={{ padding: '1rem' }}>Cargando dashboard...</p>;

  if (empleados.length === 0) {
    return <p style={{ padding: '1rem', color: '#888' }}>No hay empleados cargados. Sube un Excel para comenzar.</p>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Empleados</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={th}>Legajo</th>
            <th style={th}>Nombre</th>
            <th style={th}>Días</th>
            <th style={th}>Hs Trab.</th>
            <th style={th}>Hs 50%</th>
            <th style={th}>Hs 100%</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {empleados.map(emp => {
            const t = resumen[emp.legajo] || { dias: 0, horas: 0, h50: 0, h100: 0 };
            return (
              <tr key={emp.legajo} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={td}>{emp.legajo}</td>
                <td style={td}>{emp.nombre}</td>
                <td style={td}>{t.dias}</td>
                <td style={td}>{t.horas.toFixed(2)}</td>
                <td style={{ ...td, color: t.h50 > 0 ? '#b45309' : '#999' }}>{t.h50.toFixed(2)}</td>
                <td style={{ ...td, color: t.h100 > 0 ? '#dc2626' : '#999' }}>{t.h100.toFixed(2)}</td>
                <td style={td}>
                  <button
                    onClick={() => onSelectEmployee(emp.legajo, emp.nombre)}
                    style={btnStyle}
                  >
                    Ver Detalle
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = { padding: '0.5rem 0.75rem' };
const td = { padding: '0.5rem 0.75rem' };
const btnStyle = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.35rem 0.75rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
