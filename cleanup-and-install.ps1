# PowerShell script to clean up and reinstall dependencies properly

Write-Host "🧹 Cleaning up previous installations..." -ForegroundColor Yellow

# Remove all node_modules directories
Get-ChildItem -Path . -Name "node_modules" -Recurse -Directory | ForEach-Object {
    $path = Join-Path $PWD $_
    Write-Host "Removing: $path" -ForegroundColor Red
    Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
}

# Remove package-lock.json files (npm artifacts)
Get-ChildItem -Path . -Name "package-lock.json" -Recurse -File | ForEach-Object {
    $path = Join-Path $PWD $_
    Write-Host "Removing: $path" -ForegroundColor Red
    Remove-Item $path -Force -ErrorAction SilentlyContinue
}

# Remove pnpm-lock.yaml to start fresh
if (Test-Path "pnpm-lock.yaml") {
    Write-Host "Removing pnpm-lock.yaml" -ForegroundColor Red
    Remove-Item "pnpm-lock.yaml" -Force
}

Write-Host "✅ Cleanup completed!" -ForegroundColor Green

# Update pnpm to latest version
Write-Host "📦 Updating pnpm to latest version..." -ForegroundColor Yellow
npm install -g pnpm@latest

# Install dependencies
Write-Host "🚀 Installing dependencies with pnpm..." -ForegroundColor Yellow
pnpm install

Write-Host "🎉 Installation completed!" -ForegroundColor Green