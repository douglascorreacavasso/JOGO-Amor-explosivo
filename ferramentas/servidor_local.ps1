# servidor_local.ps1 — servidor de arquivos do jogo Amor Explosivo para quem BAIXOU o projeto (sem instalar nada: não precisa de Python).
# Chamado pelo INICIAR_JOGO.bat. Abre o navegador sozinho; o index.html decide se é celular ou computador.
# Por que precisa de servidor: abrindo o index.html direto (file://), o navegador bloqueia a leitura dos arquivos do jogo
# (o pré-carregamento com %). Este servidor só atende este computador (127.0.0.1).
# Autoria: copiado do LAB_Arch-Neural-v15 (infraestrutura do Claude, 16/11/2026), a pedido do autor.
param([int]$Porta = 0, [switch]$SemAbrir)

$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$tipos = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.md'='text/plain; charset=utf-8';
  '.txt'='text/plain; charset=utf-8'; '.gz'='application/gzip'; '.png'='image/png'; '.jpg'='image/jpeg';
  '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.webp'='image/webp';
  '.woff'='font/woff'; '.woff2'='font/woff2'; '.mp3'='audio/mpeg'; '.wav'='audio/wav'
}

# acha uma porta livre (8080..8099) se nenhuma foi pedida
$ouvinte = $null
$portas = if($Porta -gt 0){ @($Porta) } else { 8080..8099 }
foreach($p in $portas){
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://127.0.0.1:$p/")
    $l.Start()
    $ouvinte = $l; $Porta = $p; break
  } catch { }
}
if(-not $ouvinte){ Write-Host 'Nenhuma porta livre entre 8080 e 8099. Feche outro servidor e tente de novo.'; exit 1 }

$url = "http://127.0.0.1:$Porta/index.html"
Write-Host ''
Write-Host "  Amor Explosivo rodando em $url"
Write-Host '  Deixe esta janela aberta enquanto joga. Para fechar: feche esta janela (ou Ctrl+C).'
Write-Host ''
if(-not $SemAbrir){ Start-Process $url }

try {
  while($ouvinte.IsListening){
    $ctx = $ouvinte.GetContext()
    $res = $ctx.Response
    try {
      $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if([string]::IsNullOrEmpty($caminho)){ $caminho = 'index.html' }
      $arq = [System.IO.Path]::GetFullPath((Join-Path $raiz $caminho))
      if(-not $arq.StartsWith($raiz, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $arq -PathType Leaf)){
        $res.StatusCode = 404
        $b = [Text.Encoding]::UTF8.GetBytes('não encontrado')
        $res.OutputStream.Write($b, 0, $b.Length)
      } else {
        $ext = [System.IO.Path]::GetExtension($arq).ToLower()
        $res.ContentType = if($tipos.ContainsKey($ext)){ $tipos[$ext] } else { 'application/octet-stream' }
        $res.AddHeader('Cache-Control', 'no-cache')
        $fs = [System.IO.File]::OpenRead($arq)
        try { $res.ContentLength64 = $fs.Length; $fs.CopyTo($res.OutputStream) } finally { $fs.Dispose() }
      }
    } catch {
      try { $res.StatusCode = 500 } catch { }
    } finally {
      try { $res.OutputStream.Close() } catch { }
    }
  }
} finally {
  $ouvinte.Stop()
}
