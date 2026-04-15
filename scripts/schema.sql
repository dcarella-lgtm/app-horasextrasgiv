-- =============================================================
-- Esquema para Gestión de Horas Extras - Fase 1 (v3)
-- Ubicación: /scripts/schema.sql
-- v3: columnas de cálculo de horas extras (horas_50, horas_100)
-- =============================================================

-- ----------------------------------------------------------------
-- 1. Tabla de Empleados
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legajo      TEXT UNIQUE NOT NULL,
    nombre      TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 2. Tabla de Registros Diarios
-- v3: horas_trabajadas, tipo_dia, horas_50, horas_100
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registros_diarios (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id       UUID REFERENCES empleados(id) ON DELETE CASCADE,
    legajo            TEXT NOT NULL,
    fecha             DATE NOT NULL,
    hora_ingreso      TIME,
    hora_salida       TIME,
    horas_trabajadas  DECIMAL(5,2) DEFAULT 0,
    tipo_dia          TEXT CHECK (tipo_dia IN ('semana', 'sabado', 'domingo')),
    horas_50          DECIMAL(5,2) DEFAULT 0,
    horas_100         DECIMAL(5,2) DEFAULT 0,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(legajo, fecha)
);

-- ----------------------------------------------------------------
-- Migración v2 → v3 (ejecutar si la tabla ya existe)
-- ----------------------------------------------------------------
-- ALTER TABLE registros_diarios ADD COLUMN IF NOT EXISTS horas_trabajadas DECIMAL(5,2) DEFAULT 0;
-- ALTER TABLE registros_diarios ADD COLUMN IF NOT EXISTS tipo_dia TEXT CHECK (tipo_dia IN ('semana', 'sabado', 'domingo'));
-- ALTER TABLE registros_diarios ADD COLUMN IF NOT EXISTS horas_50 DECIMAL(5,2) DEFAULT 0;
-- ALTER TABLE registros_diarios ADD COLUMN IF NOT EXISTS horas_100 DECIMAL(5,2) DEFAULT 0;

-- ----------------------------------------------------------------
-- 3. Índices para optimización de consultas
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_registros_fecha    ON registros_diarios(fecha);
CREATE INDEX IF NOT EXISTS idx_registros_legajo   ON registros_diarios(legajo);
CREATE INDEX IF NOT EXISTS idx_empleados_legajo   ON empleados(legajo);

-- ----------------------------------------------------------------
-- 4. Row Level Security (RLS) — SEGURIDAD CRÍTICA
-- Habilitar RLS en ambas tablas antes de cualquier deploy
-- ----------------------------------------------------------------
ALTER TABLE empleados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_diarios ENABLE ROW LEVEL SECURITY;

-- Políticas para empleados
CREATE POLICY "empleados_select" ON empleados
    FOR SELECT USING (true);

CREATE POLICY "empleados_insert" ON empleados
    FOR INSERT WITH CHECK (true);

CREATE POLICY "empleados_update" ON empleados
    FOR UPDATE USING (true);

-- Políticas para registros_diarios
CREATE POLICY "registros_select" ON registros_diarios
    FOR SELECT USING (true);

CREATE POLICY "registros_insert" ON registros_diarios
    FOR INSERT WITH CHECK (true);

CREATE POLICY "registros_update" ON registros_diarios
    FOR UPDATE USING (true);

