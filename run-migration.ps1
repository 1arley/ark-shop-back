# Carrega variáveis do .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        $line = $_.Trim()
        if ($line -ne '' -and !$line.StartsWith('#')) {
            $key, $value = $line -split '=', 2
            $value = $value.Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Roda a migration
Write-Host "Running Prisma migration on production database..." -ForegroundColor Green
npx prisma migrate deploy

# Verifica o status
Write-Host "`nChecking migration status..." -ForegroundColor Green
npx prisma migrate status
