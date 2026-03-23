param([int]$Port = 8080)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Listener = [System.Net.Sockets.TcpListener]::Create($Port)

function Get-ContentType([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.css'  { return 'text/css; charset=utf-8' }
    '.js'   { return 'application/javascript; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.png'  { return 'image/png' }
    '.jpg'  { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.svg'  { return 'image/svg+xml' }
    default { return 'application/octet-stream' }
  }
}

try {
  $Listener.Start()
  Write-Host "Serving $Root at http://0.0.0.0:$Port/"

  while ($true) {
    $client = $Listener.AcceptTcpClient()
    $reader = $null
    $stream = $null
    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { continue }

      while ($reader.ReadLine()) { }

      $parts = $requestLine -split ' '
      $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
      $pathOnly = ($rawPath -split '\?')[0]
      $decoded = [System.Uri]::UnescapeDataString($pathOnly)
      if ($decoded -eq '/' -or [string]::IsNullOrWhiteSpace($decoded)) { $decoded = '/index.html' }
      $relative = $decoded.TrimStart('/').Replace('/', '\\')
      $target = Join-Path $Root $relative

      $fullRoot = [IO.Path]::GetFullPath($Root)
      $fullTarget = [IO.Path]::GetFullPath($target)

      if ((-not (Test-Path $fullTarget -PathType Leaf)) -or (-not $fullTarget.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase))) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($body, 0, $body.Length)
        continue
      }

      $data = [IO.File]::ReadAllBytes($fullTarget)
      $contentType = Get-ContentType $fullTarget
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($data.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($data, 0, $data.Length)
    }
    finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Close()
    }
  }
}
finally {
  $Listener.Stop()
}
