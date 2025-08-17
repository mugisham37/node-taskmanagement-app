# Task Management App - Development Environment Setup Script (PowerShell)
# This script sets up the complete development environment on Windows

param(
    [switch]$SkipDocker,
    [switch]$SkipDatabase,
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
}

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
}

function Test-NodeJs {
    Write-Status "Checking Node.js installation..."
    
    try {
        $nodeVersion = node --version
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        
        if ($versionNumber -lt 18) {
            Write-Error "Node.js version 18+ is required. Current version: $nodeVersion"
            exit 1
        }
        
        Write-Success "Node.js $nodeVersion is installed"
    }
    catch {
        Write-Error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    }
}

function Test-Pnpm {
    Write-Status "Checking pnpm installation..."
    
    try {
        $pnpmVersion = pnpm --version
        Write-Success "pnpm $pnpmVersion is available"
    }
    catch {
        Write-Warning "pnpm is not installed. Installing pnpm..."
        npm install -g pnpm
        Write-Success "pnpm installed successfully"
    }
}

function Test-Docker {
    if ($SkipDocker) {
        Write-Warning "Skipping Docker check as requested"
        return $false
    }
    
    Write-Status "Checking Docker installation..."
    
    try {
        docker --version | Out-Null
        docker info 2>$null | Out-Null
        Write-Success "Docker is installed and running"
        return $true
    }
    catch {
        Write-Warning "Docker is not available. Some features may not work."
        return $false
    }
}

function Install-Dependencies {
    Write-Status "Installing dependencies..."
    
    try {
        pnpm install
        Write-Success "Dependencies installed successfully"
    }
    catch {
        Write-Error "Failed to install dependencies: $_"
        exit 1
    }
}

function Setup-EnvironmentFiles {
    Write-Status "Setting up environment files..."
    
    # Root environment file
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
        } else {
            New-Item -ItemType File -Path ".env" -Force | Out-Null
        }
        Write-Success "Created root .env file"
    } else {
        Write-Warning "Root .env file already exists"
    }
    
    # API environment file
    $apiEnvPath = "apps/api/.env"
    if (-not (Test-Path $apiEnvPath)) {
        if (Test-Path "apps/api/.env.example") {
            Copy-Item "apps/api/.env.example" $apiEnvPath
        } else {
            "# API Environment Variables" | Out-File -FilePath $apiEnvPath -Encoding UTF8
        }
        Write-Success "Created API .env file"
    } else {
        Write-Warning "API .env file already exists"
    }
    
    # Web environment file
    $webEnvPath = "apps/web/.env.local"
    if (-not (Test-Path $webEnvPath)) {
        @"
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
"@ | Out-File -FilePath $webEnvPath -Encoding UTF8
        Write-Success "Created Web .env.local file"
    } else {
        Write-Warning "Web .env.local file already exists"
    }
    
    # Admin environment file
    $adminEnvPath = "apps/admin/.env.local"
    if (-not (Test-Path $adminEnvPath)) {
        @"
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
"@ | Out-File -FilePath $adminEnvPath -Encoding UTF8
        Write-Success "Created Admin .env.local file"
    } else {
        Write-Warning "Admin .env.local file already exists"
    }
}

function Setup-Database {
    param([bool]$DockerAvailable)
    
    if ($SkipDatabase) {
        Write-Warning "Skipping database setup as requested"
        return
    }
    
    Write-Status "Setting up database..."
    
    if ($DockerAvailable) {
        try {
            # Start PostgreSQL and Redis containers
            docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d postgres redis
            
            # Wait for database to be ready
            Write-Status "Waiting for database to be ready..."
            Start-Sleep -Seconds 10
            
            # Run migrations
            pnpm --filter @taskmanagement/database run migrate
            
            # Seed database
            pnpm --filter @taskmanagement/database run seed
            
            Write-Success "Database setup completed"
        }
        catch {
            Write-Warning "Database setup failed: $_"
            Write-Warning "Please setup database manually"
        }
    } else {
        Write-Warning "Docker not available. Please setup database manually."
        Write-Warning "Database URL should be: postgresql://taskmanagement:password@localhost:5432/taskmanagement"
    }
}

function Build-Packages {
    Write-Status "Building shared packages..."
    
    try {
        pnpm run build:packages
        Write-Success "Shared packages built successfully"
    }
    catch {
        Write-Error "Failed to build packages: $_"
        exit 1
    }
}

function Setup-GitHooks {
    Write-Status "Setting up Git hooks..."
    
    if (Test-Path ".git") {
        try {
            pnpm exec husky install
            pnpm exec husky add .husky/pre-commit "pnpm exec lint-staged"
            pnpm exec husky add .husky/commit-msg "pnpm exec commitlint --edit `$1"
            Write-Success "Git hooks setup completed"
        }
        catch {
            Write-Warning "Failed to setup Git hooks: $_"
        }
    } else {
        Write-Warning "Not a Git repository. Skipping Git hooks setup."
    }
}

function Test-Setup {
    Write-Status "Verifying setup..."
    
    # Check TypeScript compilation
    try {
        pnpm run type-check | Out-Null
        Write-Success "TypeScript compilation successful"
    }
    catch {
        Write-Error "TypeScript compilation failed"
        return $false
    }
    
    # Check linting
    try {
        pnpm run lint | Out-Null
        Write-Success "Linting passed"
    }
    catch {
        Write-Warning "Linting issues found. Run 'pnpm run lint:fix' to fix them."
    }
    
    # Check unit tests
    try {
        pnpm run test:unit | Out-Null
        Write-Success "Unit tests passed"
    }
    catch {
        Write-Warning "Some unit tests failed"
    }
    
    return $true
}

function Main {
    Write-Host "==========================================" -ForegroundColor $Colors.Cyan
    Write-Host "  Task Management App Setup" -ForegroundColor $Colors.Cyan
    Write-Host "==========================================" -ForegroundColor $Colors.Cyan
    
    Test-NodeJs
    Test-Pnpm
    $dockerAvailable = Test-Docker
    Install-Dependencies
    Setup-EnvironmentFiles
    Build-Packages
    Setup-Database -DockerAvailable $dockerAvailable
    Setup-GitHooks
    $setupSuccess = Test-Setup
    
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor $Colors.Cyan
    if ($setupSuccess) {
        Write-Success "Setup completed successfully! 🎉"
    } else {
        Write-Warning "Setup completed with warnings"
    }
    Write-Host "==========================================" -ForegroundColor $Colors.Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor $Colors.Blue
    Write-Host "1. Start the development servers:" -ForegroundColor $Colors.Blue
    Write-Host "   pnpm run dev" -ForegroundColor $Colors.Green
    Write-Host ""
    Write-Host "2. Open the applications:" -ForegroundColor $Colors.Blue
    Write-Host "   - API: http://localhost:4000" -ForegroundColor $Colors.Green
    Write-Host "   - Web: http://localhost:3000" -ForegroundColor $Colors.Green
    Write-Host "   - Admin: http://localhost:3001" -ForegroundColor $Colors.Green
    Write-Host ""
    Write-Host "3. View documentation:" -ForegroundColor $Colors.Blue
    Write-Host "   - API Docs: http://localhost:4000/docs" -ForegroundColor $Colors.Green
    Write-Host "   - Storybook: pnpm run storybook" -ForegroundColor $Colors.Green
    Write-Host ""
    Write-Host "Happy coding! 🚀" -ForegroundColor $Colors.Cyan
}

# Run main function
try {
    Main
}
catch {
    Write-Error "Setup failed: $_"
    exit 1
}