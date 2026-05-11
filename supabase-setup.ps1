# Supabase Setup Script for Windows PowerShell
# Run this to set up Supabase CLI and link your project

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supabase Setup - D'Ark Games Store" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (Test-Path ".env") {
    Write-Host "✓ .env file found" -ForegroundColor Green
} else {
    Write-Host "✗ .env file not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "To complete Supabase CLI setup, you need to:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Install Supabase CLI:" -ForegroundColor Yellow
Write-Host "   Option A (Recommended): Use Chrome/Edge to install:" -ForegroundColor White
Write-Host "   - Visit: https://supabase.com/dashboard/org/beqrwcxgtcqizzbdldpr/settings/tokens" -ForegroundColor Gray
Write-Host "   - Or install via npm (not recommended for global): npm install -g supabase" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Get your Access Token:" -ForegroundColor Yellow
Write-Host "   - Go to: https://supabase.com/dashboard/settings/tokens" -ForegroundColor White
Write-Host "   - Create a new token or copy existing one" -ForegroundColor White
Write-Host ""
Write-Host "3. Set environment variable (one-time):" -ForegroundColor Yellow
Write-Host "   \$env:SUPABASE_ACCESS_TOKEN='your-token-here'" -ForegroundColor White
Write-Host ""
Write-Host "4. Link project:" -ForegroundColor Yellow
Write-Host "   npx supabase link --project-ref beqrwcxgtcqizzbdldpr" -ForegroundColor White
Write-Host ""
Write-Host "5. Push migrations:" -ForegroundColor Yellow
Write-Host "   npx supabase db push" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get token from user
$token = Read-Host "Enter your Supabase Access Token (or press Enter to skip)"

if ($token) {
    # Set token as environment variable for this session
    $env:SUPABASE_ACCESS_TOKEN = $token
    
    Write-Host ""
    Write-Host "Linking project..." -ForegroundColor Cyan
    
    # Link project
    npx supabase@latest link --project-ref beqrwcxgtcqizzbdldpr
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Project linked successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Now pushing database schema..." -ForegroundColor Cyan
        
        # Push database
        npx supabase@latest db push
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database pushed successfully!" -ForegroundColor Green
        } else {
            Write-Host "✗ Database push failed" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Project link failed" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped. You can run this script again later." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Set SUPABASE_ACCESS_TOKEN in your .env file:" -ForegroundColor Cyan
    Write-Host "SUPABASE_ACCESS_TOKEN=your-token-here" -ForegroundColor Gray
}
