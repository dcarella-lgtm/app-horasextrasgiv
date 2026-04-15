import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ----------------------------------------------------------------
// Lógica de cálculo de horas extras
// Reglas:
//   semana  → 0 extras
//   sábado  → antes de 14h = 50%, después de 14h = 100%
//   domingo → todo 100%
// ----------------------------------------------------------------

function timeToHours(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
}

function getTipoDia(fechaStr, dayOffset = 0) {
  const date = new Date(fechaStr + 'T12:00:00'); // T12 evita problemas de timezone
  date.setDate(date.getDate() + dayOffset);
  const day = date.getDay(); // 0=domingo, 6=sábado
  if (day === 0) return 'domingo';
  if (day === 6) return 'sabado';
  return 'semana';
}

function calcularHorasExtras(record) {
  const ingreso = timeToHours(record.hora_ingreso);
  const salida = timeToHours(record.hora_salida);

  // Si faltan datos de hora, devolver valores por defecto
  if (ingreso === null || salida === null) {
    return { horas_trabajadas: 0, tipo_dia: getTipoDia(record.fecha), horas_50: 0, horas_100: 0 };
  }

  let horas_trabajadas = 0;
  let cruzomedianoche = false;

  if (salida >= ingreso) {
    horas_trabajadas = salida - ingreso;
  } else {
    // Turno nocturno (cruza la medianoche)
    horas_trabajadas = (24 - ingreso) + salida;
    cruzomedianoche = true;
  }
  
  horas_trabajadas = parseFloat(horas_trabajadas.toFixed(2));
  const tipo_dia = getTipoDia(record.fecha);

  let horas_50 = 0;
  let horas_100 = 0;

  // Función de ayuda para calcular las horas extras de un día específico
  const calcularExtrasPorDia = (horasEnElDia, tipoDiaActual, esSalida = false) => {
    let h50 = 0;
    let h100 = 0;

    if (tipoDiaActual === 'domingo') {
       h100 = horasEnElDia;
    } else if (tipoDiaActual === 'sabado') {
        // Logica compleja para el sabado dependiendo de si es cruce de medianoche y donde caen las horas
        // Esta logica asume que el cruce de medianoche significa que las horas 
        // son entre 'ingreso' y 24:00 del sabado, o entre 00:00 y 'salida' del sabado

        if (cruzomedianoche) {
             if (!esSalida) {
                // Horas trabajadas el sábado desde el ingreso hasta medianoche
                if (ingreso >= 14) {
                    h100 = horasEnElDia; // Todo después de las 14
                } else {
                    // Ingresa antes de las 14, sale a medianoche
                    h50 = 14 - ingreso;
                    h100 = 24 - 14;
                }
             } else {
                 // Horas trabajadas el sábado desde medianoche hasta la salida (turno termina el sábado)
                 // Como estamos desde 00:00, siempre es antes de las 14 asumiendo turnos < 24h
                 if (salida <= 14) {
                    h50 = horasEnElDia;
                 } else {
                     h50 = 14;
                     h100 = salida - 14;
                 }
             }
        } else {
            // Turno normal en sábado
            const corte = 14;
            if (salida <= corte) {
              h50 = horasEnElDia;
            } else if (ingreso >= corte) {
              h100 = horasEnElDia;
            } else {
              h50 = corte - ingreso;
              h100 = salida - corte;
            }
        }
    }
    return { h50, h100 };
  };

  if (cruzomedianoche) {
    const horasDia1 = 24 - ingreso;
    const horasDia2 = salida;
    const tipoDiaSiguiente = getTipoDia(record.fecha, 1);

    const extrasDia1 = calcularExtrasPorDia(horasDia1, tipo_dia, false);
    const extrasDia2 = calcularExtrasPorDia(horasDia2, tipoDiaSiguiente, true);

    horas_50 = extrasDia1.h50 + extrasDia2.h50;
    horas_100 = extrasDia1.h100 + extrasDia2.h100;

  } else {
      const extras = calcularExtrasPorDia(horas_trabajadas, tipo_dia);
      horas_50 = extras.h50;
      horas_100 = extras.h100;
  }

  return { 
      horas_trabajadas, 
      tipo_dia, 
      horas_50: parseFloat(horas_50.toFixed(2)), 
      horas_100: parseFloat(horas_100.toFixed(2)) 
  };
}

// ----------------------------------------------------------------
// Handler serverless
// ----------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { employees, records } = req.body;

  if (!Array.isArray(employees) || !Array.isArray(records)) {
    return res.status(400).json({ error: 'employees y records deben ser arrays' });
  }

  if (employees.length === 0 || records.length === 0) {
    return res.status(400).json({ error: 'No hay datos para procesar' });
  }

  try {
    // 1. Upsert empleados y recuperar ids
    const { data: upsertedEmployees, error: empError } = await supabase
      .from('empleados')
      .upsert(employees, { onConflict: 'legajo' })
      .select('id, legajo');

    if (empError) throw new Error(`Error en empleados: ${empError.message}`);

    // 2. Mapa legajo → UUID
    const legajoToId = {};
    upsertedEmployees.forEach(emp => {
      legajoToId[emp.legajo] = emp.id;
    });

    // 3. Enriquecer registros: FK + cálculo de horas extras
    const enrichedRecords = records.map(rec => {
      const extras = calcularHorasExtras(rec);
      return {
        ...rec,
        empleado_id: legajoToId[rec.legajo] ?? null,
        horas_trabajadas: extras.horas_trabajadas,
        tipo_dia: extras.tipo_dia,
        horas_50: extras.horas_50,
        horas_100: extras.horas_100,
      };
    });

    // 4. Upsert registros
    const { error: recError } = await supabase
      .from('registros_diarios')
      .upsert(enrichedRecords, { onConflict: 'legajo,fecha' });

    if (recError) throw new Error(`Error en registros: ${recError.message}`);

    return res.status(200).json({
      message: 'Sincronización completa',
      empleados: upsertedEmployees.length,
      registros: enrichedRecords.length,
    });
  } catch (error) {
    console.error('[process.js]', error.message);
    return res.status(500).json({ error: error.message });
  }
}

