# Leggendo backend setup
# Run from the project root: .\config.ps1
# Safe to re-run — only installs/downloads what is missing.

Set-Location -Path $PSScriptRoot
Set-Location -Path "backend"

# Create the venv if it does not already exist
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

# Call pip and python via their full venv paths — avoids PowerShell activation quirks
$pip    = ".\venv\Scripts\pip.exe"
$python = ".\venv\Scripts\python.exe"

Write-Host "Installing / updating dependencies..."
& $pip install --upgrade pip --quiet
& $pip install -r requirements.txt

# ---------------------------------------------------------------------------
# spaCy models — EN, IT, DE, FR, ES (all compatible with spaCy 3.7+)
# Turkish uses zeyrek instead (installed via requirements.txt, no model needed).
# To add a language: add its model here and in SPACY_MODELS in main.py.
# ---------------------------------------------------------------------------
$spacyModels = @(
    "en_core_web_sm"    # English
    "it_core_news_sm"   # Italian
    "de_core_news_sm"   # German
    "fr_core_news_sm"   # French
    "es_core_news_sm"   # Spanish
)

foreach ($model in $spacyModels) {
    Write-Host -NoNewline "Checking spaCy model: $model ... "
    & $python -c "import spacy; spacy.load('$model')" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "already installed."
    } else {
        Write-Host "downloading..."
        & $python -m spacy download $model
    }
}

Write-Host ""
Write-Host "Setup complete."
Write-Host "To start the backend, run:"
Write-Host "  cd backend"
Write-Host "  .\venv\Scripts\uvicorn.exe main:app --reload --port 8000"
