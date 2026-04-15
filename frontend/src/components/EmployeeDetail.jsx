import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function EmployeeDetail({ legajo, nombre, onBack }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRegistros();
  }, [legajo]);

  const fetchRegistros = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('registros_diarios')
      .select('fecha, hora_ingreso, hora_salida, horas_trabajadas, tipo_dia, horas_50, horas_100')
      .eq('legajo', legajo)
      .order('fecha', { ascending: false });

    setRegistros(data || []);
    setLoading(false);
  };

  // Totales
  const totales = registros.reduce(
    (acc, r) => ({
      horas: acc.horas + (Number(r.horas_trabajadas) || 0),
      h50: acc.h50 + (Number(r.horas_50) || 0),
      h100: acc.h100 + (Number(r.horas_100) || 0),
    }),
    { horas: 0, h50: 0, h100: 0 }
  );

  return (
    <div>
      <button onClick={onBack} style={backBtn}>← Volver</button>

      <h2 style={{ margin: '1rem 0 0.25rem' }}>{nombre}</h2>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>Legajo: {legajo}</p>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Card label="Total Horas" value={totales.horas.toFixed(2)} />
        <Card label="Horas 50%" value={totales.h50.toFixed(2)} color="#b45309" />
        <Card label="Horas 100%" value={totales.h100.toFixed(2)} color="#dc2626" />
        <Card label="Días Registrados" value={registros.length} />
      </div>

      {loading ? (
        <p>Cargando registros...</p>
      ) : registros.length === 0 ? (
        <p style={{ color: '#888' }}>Sin registros para este empleado.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={th}>Fecha</th>
              <th style={th}>Ingreso</th>
              <th style={th}>Salida</th>
              <th style={th}>Hs Trab.</th>
              <th style={th}>Tipo Día</th>
              <th style={th}>Hs 50%</th>
              <th style={th}>Hs 100%</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={td}>{r.fecha}</td>
                <td style={td}>{r.hora_ingreso || '-'}</td>
                <td style={td}>{r.hora_salida || '-'}</td>
                <td style={td}>{Number(r.horas_trabajadas).toFixed(2)}</td>
                <td style={td}>
                  <span style={badgeStyle(r.tipo_dia)}>{r.tipo_dia}</span>
                </td>
                <td style={{ ...td, color: Number(r.horas_50) > 0 ? '#b45309' : '#ccc' }}>
                  {Number(r.horas_50).toFixed(2)}
                </td>
                <td style={{ ...td, color: Number(r.horas_100) > 0 ? '#dc2626' : '#ccc' }}>
                  {Number(r.horas_100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div style={{
      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
      padding: '1rem 1.25rem', minWidth: '140px', flex: '1',
    }}>
      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: color || '#111' }}>{value}</div>
    </div>
  );
}

function badgeStyle(tipo) {
  const colors = {
    semana: { bg: '#dbeafe', color: '#1d4ed8' },
    sabado: { bg: '#fef3c7', color: '#b45309' },
    domingo: { bg: '#fee2e2', color: '#dc2626' },
  };
  const c = colors[tipo] || { bg: '#f3f4f6', color: '#666' };
  return {
    background: c.bg, color: c.color,
    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600',
  };
}

const th = { padding: '0.5rem 0.75rem' };
const td = { padding: '0.5rem 0.75rem' };
const backBtn = {
  background: 'none', border: '1px solid #ddd', padding: '0.4rem 0.75rem',
  borderRadius: '6px', cursor: 'pointer', color: '#555', fontSize: '0.85rem',
};
