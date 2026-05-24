$ErrorActionPreference = "Stop"

$workspaceRoot = "c:\Users\choud\Desktop\busyHubCRM\BuzyHubMain"
$busyfieldRoot = "c:\Users\choud\Desktop\busyHubCRM\BuzyHubMain\busyfield-apk"
$apksDir = "c:\Users\choud\Desktop\busyHubCRM\apks"

if (-not (Test-Path $apksDir)) {
    New-Item -ItemType Directory -Force -Path $apksDir | Out-Null
}

Write-Host "Building BuzyHubMain..."
Set-Location $workspaceRoot
npm run build
npx cap sync android
Set-Location "$workspaceRoot\android"
.\gradlew clean assembleDebug

Write-Host "Copying BuzyHubMain APK..."
Copy-Item "$workspaceRoot\android\app\build\outputs\apk\debug\app-debug.apk" -Destination "$apksDir\BuzyHubMain.apk" -Force

Write-Host "Building busyfield-apk..."
Set-Location $busyfieldRoot
npm run build
npx cap sync android
Set-Location "$busyfieldRoot\android"
.\gradlew clean assembleDebug

Write-Host "Copying busyfield-apk APK..."
Copy-Item "$busyfieldRoot\android\app\build\outputs\apk\debug\app-debug.apk" -Destination "$apksDir\busyfield.apk" -Force

Write-Host "All done! APKs saved to $apksDir"
