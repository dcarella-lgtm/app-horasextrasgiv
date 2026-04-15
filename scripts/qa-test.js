const fs = require('fs');
const XLSX = require('xlsx');

// 1. Funciones Frontend (simulación)
const normalizeKey = (key) =>
  key.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const formatDate = (val) => {
  if (typeof val === 'number') {
    return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
  }
  if (typeof val === 'string' && val.trim()) {
    let str = val.trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
          let year, month, day;
          if (parts[2].length === 4) {
               year = parts[2];
               if (Number(parts[0]) > 12) {
                   day = parts[0]; month = parts[1]; 
               } else {
                   day = parts[0]; month = parts[1]; 
               }
          } else if (parts[0].length === 4) {
               year = parts[0]; month = parts[1]; day = parts[2]; 
          }
          if (year && month && day) {
               return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          }
      }
    }
    str = str.replace(/\//g, '-');
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

// 2. Funciones Backend (simulación)
function timeToHours(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
}

function getTipoDia(fechaStr, dayOffset = 0) {
  const date = new Date(fechaStr + 'T12:00:00'); 
  date.setDate(date.getDate() + dayOffset);
  const day = date.getDay(); 
  if (day === 0) return 'domingo';
  if (day === 6) return 'sabado';
  return 'semana';
}

function calcularHorasExtras(record) {
  const ingreso = timeToHours(record.hora_ingreso);
  const salida = timeToHours(record.hora_salida);

  if (ingreso === null || salida === null) {
    return { horas_trabajadas: 0, tipo_dia: getTipoDia(record.fecha), horas_50: 0, horas_100: 0 };
  }

  let horas_trabajadas = 0;
  let cruzomedianoche = false;

  if (salida >= ingreso) {
    horas_trabajadas = salida - ingreso;
  } else {
    horas_trabajadas = (24 - ingreso) + salida;
    cruzomedianoche = true;
  }
  
  horas_trabajadas = parseFloat(horas_trabajadas.toFixed(2));
  const tipo_dia = getTipoDia(record.fecha);

  let horas_50 = 0;
  let horas_100 = 0;

  const calcularExtrasPorDia = (horasEnElDia, tipoDiaActual, esSalida = false) => {
    let h50 = 0; let h100 = 0;
    if (tipoDiaActual === 'domingo') {
       h100 = horasEnElDia;
    } else if (tipoDiaActual === 'sabado') {
        if (cruzomedianoche) {
             if (!esSalida) {
                if (ingreso >= 14) h100 = horasEnElDia; 
                else { h50 = 14 - ingreso; h100 = 24 - 14; }
             } else {
                 if (salida <= 14) h50 = horasEnElDia;
                 else { h50 = 14; h100 = salida - 14; }
             }
        } else {
            const corte = 14;
            if (salida <= corte) h50 = horasEnElDia;
            else if (ingreso >= corte) h100 = horasEnElDia;
            else { h50 = corte - ingreso; h100 = salida - corte; }
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

  return { horas_trabajadas, tipo_dia, horas_50: parseFloat(horas_50.toFixed(2)), horas_100: parseFloat(horas_100.toFixed(2)) };
}

// 3. Script Principal
try {
  console.log('--- INICIANDO QA SCRIPT ---');
  const filePath = '../copia prueba horas.xlsm';
  if (!fs.existsSync(filePath)) {
    console.error('El archivo Excel no existe:', filePath);
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, { type: 'binary', cellDates: true });
  // El usuario dice "hoja 'procesado'"
  const wsname = wb.SheetNames.find(n => n.toLowerCase() === 'procesado') || wb.SheetNames[0];
  const ws = wb.Sheets[wsname];

  const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });
  
  const normalizedData = rawData.map(row => {
    const normalized = {};
    Object.keys(row).forEach(key => {
      normalized[normalizeKey(key)] = row[key];
    });
    return normalized;
  });

  const employees = [];
  const records = [];
  const empSet = new Set();
  let ignorados = 0;

  normalizedData.forEach(row => {
    const { legajo, nombre, fecha, hora_ingreso, hora_salida } = row;
    
    if (!legajo || !nombre || !fecha || hora_ingreso === undefined || hora_salida === undefined || hora_ingreso === '' || hora_salida === '') {
        ignorados++;
        return; 
    }

    const legajoStr = String(legajo).trim();
    if (!empSet.has(legajoStr)) {
      employees.push({ legajo: legajoStr, nombre: String(nombre).trim() });
      empSet.add(legajoStr);
    }
    
    // Simular el parseo de Excel si viene como fecha (SheetJS puede convertirlo si cellDates:true)
    let fechaFinal = fecha;
    if (fecha instanceof Date) {
        fechaFinal = fecha.toISOString().split('T')[0];
    } else {
        fechaFinal = formatDate(fecha);
    }

    let ingresoFinal = hora_ingreso;
    let salidaFinal = hora_salida;
    
    if (hora_ingreso instanceof Date) {
        ingresoFinal = `${String(hora_ingreso.getUTCHours()).padStart(2,'0')}:${String(hora_ingreso.getUTCMinutes()).padStart(2,'0')}`;
    } else {
        ingresoFinal = formatTime(hora_ingreso);
    }

    if (hora_salida instanceof Date) {
        salidaFinal = `${String(hora_salida.getUTCHours()).padStart(2,'0')}:${String(hora_salida.getUTCMinutes()).padStart(2,'0')}`;
    } else {
        salidaFinal = formatTime(hora_salida);
    }


    records.push({
      legajo: legajoStr,
      fecha: fechaFinal,
      hora_ingreso: ingresoFinal,
      hora_salida: salidaFinal,
    });
  });

  console.log(`\n🔍 RESULTADOS PARSING:`);
  console.log(`- Empleados detectados: ${employees.length}`);
  console.log(`- Registros válidos: ${records.length}`);
  console.log(`- Filas ignoradas (vacías/incompletas): ${ignorados}`);

  // Analizar muestras de cálculo
  console.log(`\n✅ ANÁLISIS DE CÁLCULO (Primeros 10 casos):`);
  records.slice(0, 10).forEach(rec => {
      const calculo = calcularHorasExtras(rec);
      console.log(`> [${rec.fecha} | ${calculo.tipo_dia}] ${rec.legajo}: ${rec.hora_ingreso} a ${rec.hora_salida} -> Total: ${calculo.horas_trabajadas}hs | 50%: ${calculo.horas_50}hs | 100%: ${calculo.horas_100}hs`);
  });
  
  // Buscar casos especiales para QA:
  const nocturnos = records.filter(r => timeToHours(r.hora_salida) < timeToHours(r.hora_ingreso) && r.hora_salida && r.hora_ingreso);
  const sabados = records.filter(r => getTipoDia(r.fecha) === 'sabado');
  const domingos = records.filter(r => getTipoDia(r.fecha) === 'domingo');

  console.log(`\n🌙 TURNOS NOCTURNOS (Cruce Medianoche): ${nocturnos.length} encontrados`);
  nocturnos.slice(0, 5).forEach(rec => {
      const calculo = calcularHorasExtras(rec);
      console.log(`> [${rec.fecha} | ${calculo.tipo_dia}] ${rec.legajo}: ${rec.hora_ingreso} a ${rec.hora_salida} -> Total: ${calculo.horas_trabajadas}hs | 50%: ${calculo.horas_50}hs | 100%: ${calculo.horas_100}hs`);
  });

  console.log(`\n☀️ SÁBADOS: ${sabados.length} encontrados`);
  sabados.slice(0, 5).forEach(rec => {
      const calculo = calcularHorasExtras(rec);
      console.log(`> [${rec.fecha} | ${calculo.tipo_dia}] ${rec.legajo}: ${rec.hora_ingreso} a ${rec.hora_salida} -> Total: ${calculo.horas_trabajadas}hs | 50%: ${calculo.horas_50}hs | 100%: ${calculo.horas_100}hs`);
  });

  console.log(`\n🔥 DOMINGOS: ${domingos.length} encontrados`);
  domingos.slice(0, 5).forEach(rec => {
      const calculo = calcularHorasExtras(rec);
      console.log(`> [${rec.fecha} | ${calculo.tipo_dia}] ${rec.legajo}: ${rec.hora_ingreso} a ${rec.hora_salida} -> Total: ${calculo.horas_trabajadas}hs | 50%: ${calculo.horas_50}hs | 100%: ${calculo.horas_100}hs`);
  });

  console.log('\n--- QA SCRIPT FINALIZADO ---');
  
} catch (e) {
  console.error('Error durante la validación:', e);
}
