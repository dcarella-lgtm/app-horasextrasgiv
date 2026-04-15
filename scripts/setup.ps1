# Configuración del Proyecto app-horas

Param(
    [switch]$Install = $true
)

$root = $PSScriptRoot
$backendDir = Join-Path $root "../backend"
$frontendDir = Join-Path $root "../frontend"

Write-Host "🚀 Iniciando configuración de App Horas..." -ForegroundColor Cyan

if ($Install) {
    Write-Host "`n📦 Instalando dependencias del Backend..." -ForegroundColor Yellow
    Set-Location $backendDir
    npm install

    Write-Host "`n📦 Instalando dependencias del Frontend..." -ForegroundColor Yellow
    Set-Location $frontendDir
    npm install
}

Write-Host "`n✅ Configuración completada." -ForegroundColor Green
Write-Host "`nPara iniciar la aplicación:" -ForegroundColor White
Write-Host "1. Abre una terminal en 'backend' y ejecuta: npm run start" -ForegroundColor Gray
Write-Host "2. Abre otra terminal en 'frontend' y ejecuta: npm run dev" -ForegroundColor Gray
Write-Host "3. Accede a http://localhost:3000" -ForegroundColor Gray

Read-Host "`nPresiona Enter para salir"
