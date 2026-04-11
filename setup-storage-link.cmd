@echo off
REM Setup script to create storage symlink for Laravel file uploads
REM This script must be run from the project root directory
REM Requires Administrator privileges on Windows

cd /d "%~dp0"

echo Creating storage symlink...

REM Check if symlink already exists
if exist "public\storage" (
    echo Storage symlink already exists
    exit /b 0
)

REM Try using artisan command first
php artisan storage:link
if %errorlevel% equ 0 (
    echo Storage symlink created successfully via artisan
    exit /b 0
)

REM Fallback to mklink if artisan fails
echo Artisan command failed, attempting mklink...
mklink /D "public\storage" "storage\app\public"

if %errorlevel% equ 0 (
    echo Storage symlink created successfully via mklink
    exit /b 0
) else (
    echo Failed to create storage symlink
    echo Please run this script as Administrator
    exit /b 1
)
