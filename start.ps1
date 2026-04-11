# Leggendo startup script

Write-Host "Starting Leggendo..." -ForegroundColor Cyan

# Start backend
$backendPath = Join-Path $PSScriptRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload" -WindowStyle Normal

# Wait for backend to start
Start-Sleep -Seconds 2

# Start frontend
$frontendPath = Join-Path $PSScriptRoot "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal

# Wait for frontend to start
Start-Sleep -Seconds 3

# Open browser
Start-Process "http://localhost:5173"

Write-Host "Leggendo is running. Close the two terminal windows to stop." -ForegroundColor Green
