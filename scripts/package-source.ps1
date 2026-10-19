param([Parameter(Mandatory = $true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$archiveTarget = [IO.Path]::GetFullPath($OutputPath)
$archiveParent = Split-Path -Parent $archiveTarget
[IO.Directory]::CreateDirectory($archiveParent) | Out-Null
$rootNames = @('.gitignore', 'AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'eslint.config.mjs', 'playwright.config.ts')
$files = @($rootNames | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) })
foreach ($folder in @('src', 'public', 'scripts', 'tests')) {
  $files += Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -File -Recurse
}
$files += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'docs') -File
$files += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'docs/screenshots') -File -Filter 'studio-final-*.png'
$stream = [IO.File]::Open($archiveTarget, [IO.FileMode]::Create, [IO.FileAccess]::Write)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
  foreach ($file in $files) {
    $relative = [IO.Path]::GetRelativePath($projectRoot, $file.FullName).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, "deep/$relative", [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}
$check = [IO.Compression.ZipFile]::OpenRead($archiveTarget)
try {
  $bad = @($check.Entries | Where-Object { $_.FullName -match '(^|/)(node_modules|\.next|\.git|\.preview|test-results[^/]*|playwright-report)/|(^|/)\.env' })
  if ($bad.Count) { throw 'Unexpected generated or private files in source archive.' }
  [PSCustomObject]@{ Archive = $archiveTarget; Files = $check.Entries.Count; Bytes = (Get-Item -LiteralPath $archiveTarget).Length }
} finally { $check.Dispose() }
