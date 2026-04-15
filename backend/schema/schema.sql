-- Esquema de base de datos para Gestión de Horas Extras
-- Generado por: Agente Backend (Supabase)

-- 1. Tabla de Empleados
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legajo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    cargo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Registros de Horas Extras
CREATE TABLE IF NOT EXISTS overtime_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL, -- Formato YYYY-MM
    fecha DATE NOT NULL,
    horas_diurnas DECIMAL(5,2) DEFAULT 0,
    horas_nocturnas DECIMAL(5,2) DEFAULT 0,
    horas_feriado DECIMAL(5,2) DEFAULT 0,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicados para la misma fecha/empleado si es necesario
    UNIQUE(employee_id, fecha)
);

-- 3. Row Level Security (RLS)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar según necesidad de auth)
CREATE POLICY "Lectura pública de empleados" ON employees FOR SELECT USING (true);
CREATE POLICY "Lectura pública de registros" ON overtime_records FOR SELECT USING (true);
CREATE POLICY "Inserción pública de registros" ON overtime_records FOR INSERT WITH CHECK (true);
