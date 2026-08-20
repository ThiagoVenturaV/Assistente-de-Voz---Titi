param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('observe', 'invoke', 'capture', 'capture-desktop', 'click', 'focus', 'minimize', 'close')]
  [string]$Operation,

  [Parameter(Mandatory = $true)]
  [ValidateLength(1, 80)]
  [string]$Application,

  [ValidateLength(0, 120)]
  [string]$Target = '',

  [ValidateSet('', 'Button', 'CheckBox', 'Hyperlink', 'ListItem', 'MenuItem', 'RadioButton', 'TabItem')]
  [string]$ControlType = '',

  [ValidateLength(0, 160)]
  [string]$WindowTitle = '',

  [int]$ExpectedProcessId = 0,

  [long]$ExpectedWindowHandle = 0,

  [ValidateLength(0, 100)]
  [string]$ExpectedProcessName = '',

  [ValidateLength(0, 160)]
  [string]$ExpectedWindowTitle = '',

  [ValidateLength(0, 120)]
  [string]$ExpectedAutomationId = '',

  [ValidatePattern('^(|\d+(\.\d+){1,31})$')]
  [string]$ExpectedRuntimeId = '',

  [int]$ExpectedWidth = 0,

  [int]$ExpectedHeight = 0,

  [int]$X = -1,

  [int]$Y = -1
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TitiUiInput {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, UIntPtr wParam, IntPtr lParam);
}
'@

Set-StrictMode -Version Latest

$PostMessageClose = 0x0010
$WindowShowMinimized = 6
$ProtectedProcessNames = @(
  'titi', 'powershell', 'pwsh', 'cmd', 'conhost', 'windowsterminal', 'wt',
  'regedit', 'wscript', 'cscript', 'mshta', 'rundll32', 'taskmgr',
  'sechealthui', 'securityhealthsystray', 'credentialuibroker',
  '1password', 'bitwarden', 'keepass', 'keepassxc'
)
$ProtectedWindowNames = @(
  'windows security', 'seguranca do windows', 'task manager',
  'gerenciador de tarefas', 'credential manager', 'gerenciador de credenciais',
  '1password', 'bitwarden', 'keepass'
)

function Normalize-Label([string]$Value) {
  $formD = $Value.Normalize([Text.NormalizationForm]::FormD)
  $builder = [Text.StringBuilder]::new()
  foreach ($character in $formD.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($character)
    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append([char]::ToLowerInvariant($character))
    }
  }
  return ([regex]::Replace($builder.ToString(), '[^a-z0-9]+', ' ')).Trim()
}

function Safe-Text([string]$Value, [int]$Limit) {
  if ($null -eq $Value) { return '' }
  $cleaned = [regex]::Replace($Value, '[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]', ' ')
  $cleaned = [regex]::Replace($cleaned, '\s+', ' ').Trim()
  if ($cleaned.Length -gt $Limit) { return $cleaned.Substring(0, $Limit) }
  return $cleaned
}

function Test-IsWindowProtected($Window, $Process) {
  $processName = Normalize-Label $Process.ProcessName
  $windowName = Normalize-Label $Window.Current.Name
  if ($ProtectedProcessNames -contains $processName) { return $true }
  foreach ($protectedName in $ProtectedWindowNames) {
    if ($windowName -eq $protectedName -or $windowName.StartsWith("$protectedName ")) {
      return $true
    }
  }
  return $false
}

function Assert-WindowAllowed($Window, $Process) {
  if (Test-IsWindowProtected $Window $Process) {
    throw 'A janela resolvida é protegida e não pode ser observada ou controlada.'
  }
}

function Get-UsableRectangle($Element) {
  $rectangle = $Element.Current.BoundingRectangle
  $values = @(
    [double]$rectangle.Left,
    [double]$rectangle.Top,
    [double]$rectangle.Width,
    [double]$rectangle.Height
  )
  foreach ($value in $values) {
    if ([double]::IsNaN($value) -or [double]::IsInfinity($value)) { return $null }
  }
  if (
    $rectangle.Width -lt 100 -or $rectangle.Height -lt 100 -or
    $rectangle.Width -gt 10000 -or $rectangle.Height -gt 10000
  ) { return $null }
  return $rectangle
}

function Get-MatchingWindows {
  $wanted = Normalize-Label $Application
  $normalizedWantedWindowTitle = Normalize-Label $WindowTitle
  $usesExpectedIdentity = $ExpectedProcessId -gt 0 -or $ExpectedWindowHandle -gt 0
  if ($usesExpectedIdentity -and ($ExpectedProcessId -le 0 -or $ExpectedWindowHandle -le 0)) {
    throw 'A identidade esperada da janela está incompleta.'
  }
  if (($Operation -in @('invoke', 'click')) -and -not $usesExpectedIdentity) {
    throw 'A ação exige a identidade da janela observada.'
  }
  if ($Operation -eq 'invoke' -and [string]::IsNullOrWhiteSpace($ExpectedRuntimeId)) {
    throw 'A ação exige a identidade do controle observado.'
  }
  if ($Operation -eq 'click' -and ($ExpectedWidth -le 0 -or $ExpectedHeight -le 0)) {
    throw 'O clique exige as dimensões da janela capturada.'
  }
  $windows = [Windows.Automation.AutomationElement]::RootElement.FindAll(
    [Windows.Automation.TreeScope]::Children,
    [Windows.Automation.Condition]::TrueCondition
  )
  $matches = @()
  foreach ($window in $windows) {
    try {
      if ($window.Current.IsOffscreen) { continue }
      $process = Get-Process -Id $window.Current.ProcessId -ErrorAction Stop
      $processName = Normalize-Label $process.ProcessName
      $windowName = Normalize-Label $window.Current.Name
      $applicationMatches = $processName -eq $wanted -or $windowName -eq $wanted
      $titleMatches = [string]::IsNullOrWhiteSpace($normalizedWantedWindowTitle) -or $windowName -eq $normalizedWantedWindowTitle
      $identityMatches = -not $usesExpectedIdentity -or (
        $window.Current.ProcessId -eq $ExpectedProcessId -and
        [long]$window.Current.NativeWindowHandle -eq $ExpectedWindowHandle
      )
      if ($applicationMatches -and $titleMatches -and $identityMatches) {
        $rectangle = Get-UsableRectangle $window
        if ($null -eq $rectangle) { continue }
        $matches += [pscustomobject]@{ Element = $window; Process = $process; Bounds = $rectangle }
      }
    } catch {
      continue
    }
  }
  if ($matches.Count -gt 1) {
    $hints = $matches | Select-Object -First 8 | ForEach-Object { Safe-Text $_.Element.Current.Name 120 }
    $hintText = [string]::Join(' | ', $hints)
    throw "Há múltiplas janelas de $Application. Informe o título exato observado. Opções: $hintText"
  }
  $selected = $matches | Select-Object -First 1
  if ($null -eq $selected) { throw "Não encontrei uma janela visível de $Application." }
  Assert-WindowAllowed $selected.Element $selected.Process
  if ($usesExpectedIdentity) {
    if (
      (Normalize-Label $selected.Process.ProcessName) -ne (Normalize-Label $ExpectedProcessName) -or
      (Normalize-Label $selected.Element.Current.Name) -ne (Normalize-Label $ExpectedWindowTitle)
    ) {
      throw 'A identidade da janela mudou desde a observação; a ação foi bloqueada.'
    }
  }
  return $selected
}

function Convert-Control($Element) {
  $runtimeId = [string]::Join('.', @($Element.GetRuntimeId()))
  return [ordered]@{
    name = Safe-Text $Element.Current.Name 120
    controlType = $Element.Current.ControlType.ProgrammaticName.Replace('ControlType.', '')
    automationId = Safe-Text $Element.Current.AutomationId 120
    runtimeId = Safe-Text $runtimeId 180
    enabled = [bool]$Element.Current.IsEnabled
  }
}

function Get-InteractiveControls($Window) {
  $allowed = @('Button', 'CheckBox', 'Hyperlink', 'ListItem', 'MenuItem', 'RadioButton', 'TabItem')
  $descendants = $Window.FindAll(
    [Windows.Automation.TreeScope]::Descendants,
    [Windows.Automation.Condition]::TrueCondition
  )
  $result = [Collections.Generic.List[object]]::new()
  $seen = [Collections.Generic.HashSet[string]]::new()
  foreach ($element in $descendants) {
    try {
      if ($element.Current.IsOffscreen) { continue }
      $control = Convert-Control $element
      if (!$allowed.Contains($control.controlType) -or !$control.name) { continue }
      $key = "$(Normalize-Label $control.name)|$($control.controlType)|$($control.automationId)"
      if ($seen.Add($key)) { $result.Add([pscustomobject]@{ Element = $element; Control = $control }) }
      if ($result.Count -ge 120) { break }
    } catch {
      continue
    }
  }
  return $result
}

if ($Operation -eq 'capture-desktop') {
  $desktopWindows = [Windows.Automation.AutomationElement]::RootElement.FindAll(
    [Windows.Automation.TreeScope]::Children,
    [Windows.Automation.Condition]::TrueCondition
  )
  foreach ($desktopWindow in $desktopWindows) {
    if ($desktopWindow.Current.IsOffscreen) { continue }
    try {
      $desktopProcess = Get-Process -Id $desktopWindow.Current.ProcessId -ErrorAction Stop
      if (Test-IsWindowProtected $desktopWindow $desktopProcess) {
        throw 'A captura dos monitores foi bloqueada porque há uma janela protegida visível.'
      }
    } catch {
      if ($_.Exception.Message -like 'A captura dos monitores foi bloqueada*') { throw }
    }
  }
  $screens = @([Windows.Forms.Screen]::AllScreens)
  if ($screens.Count -eq 0 -or $screens.Count -gt 8) {
    throw 'O Windows retornou uma quantidade inválida de monitores.'
  }
  $captures = [Collections.Generic.List[object]]::new()
  for ($index = 0; $index -lt $screens.Count; $index += 1) {
    $screen = $screens[$index]
    $bounds = $screen.Bounds
    if ($bounds.Width -lt 100 -or $bounds.Height -lt 100 -or $bounds.Width -gt 10000 -or $bounds.Height -gt 10000) {
      throw "O monitor $($index + 1) retornou dimensões inválidas."
    }
    $sourceBitmap = [Drawing.Bitmap]::new($bounds.Width, $bounds.Height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $sourceGraphics = [Drawing.Graphics]::FromImage($sourceBitmap)
    $previewBitmap = $null
    $previewGraphics = $null
    $stream = [IO.MemoryStream]::new()
    try {
      $sourceGraphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
      $scale = [Math]::Min(1.0, 1920.0 / $bounds.Width)
      $previewWidth = [Math]::Max(1, [int][Math]::Round($bounds.Width * $scale))
      $previewHeight = [Math]::Max(1, [int][Math]::Round($bounds.Height * $scale))
      $previewBitmap = [Drawing.Bitmap]::new($previewWidth, $previewHeight, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
      $previewGraphics = [Drawing.Graphics]::FromImage($previewBitmap)
      $previewGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $previewGraphics.DrawImage($sourceBitmap, 0, 0, $previewWidth, $previewHeight)
      $previewBitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Jpeg)
      $captures.Add([ordered]@{
        index = $index
        primary = [bool]$screen.Primary
        left = $bounds.Left
        top = $bounds.Top
        width = $bounds.Width
        height = $bounds.Height
        imageWidth = $previewWidth
        imageHeight = $previewHeight
        imageBase64 = [Convert]::ToBase64String($stream.ToArray())
      })
    } finally {
      $stream.Dispose()
      if ($null -ne $previewGraphics) { $previewGraphics.Dispose() }
      if ($null -ne $previewBitmap) { $previewBitmap.Dispose() }
      $sourceGraphics.Dispose()
      $sourceBitmap.Dispose()
    }
  }
  [pscustomobject]@{
    screenCount = $captures.Count
    screens = @($captures)
  } | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

$selectedWindow = Get-MatchingWindows
$base = [ordered]@{
  application = Safe-Text $Application 80
  windowTitle = Safe-Text $selectedWindow.Element.Current.Name 160
  processName = Safe-Text $selectedWindow.Process.ProcessName 100
  processId = [int]$selectedWindow.Element.Current.ProcessId
  windowHandle = ([long]$selectedWindow.Element.Current.NativeWindowHandle).ToString([Globalization.CultureInfo]::InvariantCulture)
}

$rectangle = $selectedWindow.Bounds
$left = [int][Math]::Round($rectangle.Left)
$top = [int][Math]::Round($rectangle.Top)
$width = [int][Math]::Round($rectangle.Width)
$height = [int][Math]::Round($rectangle.Height)
if ($width -lt 100 -or $height -lt 100 -or $width -gt 10000 -or $height -gt 10000) {
  throw "A janela de $Application tem dimensões inválidas para automação visual."
}

if ($Operation -eq 'capture') {
  [void][TitiUiInput]::SetForegroundWindow([IntPtr]$selectedWindow.Element.Current.NativeWindowHandle)
  Start-Sleep -Milliseconds 180
  $bitmap = [Drawing.Bitmap]::new($width, $height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $stream = [IO.MemoryStream]::new()
  $focusBitmap = $null
  $focusGraphics = $null
  $focusStream = $null
  try {
    $graphics.CopyFromScreen($left, $top, 0, 0, [Drawing.Size]::new($width, $height))
    $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Jpeg)
    $focusSourceWidth = [Math]::Min(320, $width)
    $focusSourceHeight = [Math]::Min(120, $height)
    $focusLeft = [int][Math]::Floor(($width - $focusSourceWidth) / 2)
    $focusTop = $height - $focusSourceHeight
    $focusBitmap = [Drawing.Bitmap]::new(640, 240, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $focusGraphics = [Drawing.Graphics]::FromImage($focusBitmap)
    $focusGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $focusGraphics.DrawImage(
      $bitmap,
      [Drawing.Rectangle]::new(0, 0, 640, 240),
      [Drawing.Rectangle]::new($focusLeft, $focusTop, $focusSourceWidth, $focusSourceHeight),
      [Drawing.GraphicsUnit]::Pixel
    )
    $focusStream = [IO.MemoryStream]::new()
    $focusBitmap.Save($focusStream, [Drawing.Imaging.ImageFormat]::Jpeg)
    $base.width = $width
    $base.height = $height
    $base.imageBase64 = [Convert]::ToBase64String($stream.ToArray())
    $base.focusImageBase64 = [Convert]::ToBase64String($focusStream.ToArray())
    [pscustomobject]$base | ConvertTo-Json -Depth 5 -Compress
  } finally {
    if ($null -ne $focusStream) { $focusStream.Dispose() }
    if ($null -ne $focusGraphics) { $focusGraphics.Dispose() }
    if ($null -ne $focusBitmap) { $focusBitmap.Dispose() }
    $stream.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
  exit 0
}

if ($Operation -eq 'focus') {
  [void][TitiUiInput]::SetForegroundWindow([IntPtr]$selectedWindow.Element.Current.NativeWindowHandle)
  Start-Sleep -Milliseconds 80
  $base.action = 'focus'
  [pscustomobject]$base | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

if ($Operation -eq 'minimize') {
  if (-not [TitiUiInput]::ShowWindow([IntPtr]$selectedWindow.Element.Current.NativeWindowHandle, $WindowShowMinimized)) {
    throw "Não consegui minimizar a janela de $Application."
  }
  $base.action = 'minimize'
  [pscustomobject]$base | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

if ($Operation -eq 'close') {
  if (-not [TitiUiInput]::PostMessage([IntPtr]$selectedWindow.Element.Current.NativeWindowHandle, $PostMessageClose, [UIntPtr]::Zero, [IntPtr]::Zero)) {
    throw "Não consegui encerrar a janela de $Application."
  }
  $base.action = 'close'
  [pscustomobject]$base | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

if ($Operation -eq 'click') {
  if ($width -ne $ExpectedWidth -or $height -ne $ExpectedHeight) {
    throw 'As dimensões da janela mudaram desde a captura; o clique foi bloqueado.'
  }
  if ($X -lt 0 -or $Y -lt 0 -or $X -ge $width -or $Y -ge $height) {
    throw 'As coordenadas do clique estão fora da janela observada.'
  }
  $selectedHandle = [IntPtr]$selectedWindow.Element.Current.NativeWindowHandle
  if (
    [TitiUiInput]::GetForegroundWindow() -ne $selectedHandle -and
    -not [TitiUiInput]::SetForegroundWindow($selectedHandle)
  ) {
    throw 'Não foi possível manter a janela capturada em primeiro plano.'
  }
  Start-Sleep -Milliseconds 120
  if ([TitiUiInput]::GetForegroundWindow() -ne $selectedHandle) {
    throw 'Outra janela recebeu o foco antes do clique; a ação foi bloqueada.'
  }
  $latestRectangle = Get-UsableRectangle $selectedWindow.Element
  if (
    $null -eq $latestRectangle -or
    [int][Math]::Round($latestRectangle.Width) -ne $ExpectedWidth -or
    [int][Math]::Round($latestRectangle.Height) -ne $ExpectedHeight
  ) {
    throw 'A janela mudou antes do clique; a ação foi bloqueada.'
  }
  [void][TitiUiInput]::SetCursorPos(
    [int][Math]::Round($latestRectangle.Left) + $X,
    [int][Math]::Round($latestRectangle.Top) + $Y
  )
  [TitiUiInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [TitiUiInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  $base.clicked = $true
  $base.x = $X
  $base.y = $Y
  [pscustomobject]$base | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

$controls = @(Get-InteractiveControls $selectedWindow.Element)

if ($Operation -eq 'observe') {
  $base.controls = @($controls | ForEach-Object { $_.Control })
  [pscustomobject]$base | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Target)) { throw 'Informe o controle que deve ser acionado.' }
$wantedTarget = Normalize-Label $Target
$matches = @($controls | Where-Object {
  (Normalize-Label $_.Control.name) -eq $wantedTarget -and
  ([string]::IsNullOrWhiteSpace($ControlType) -or $_.Control.controlType -eq $ControlType) -and
  $_.Control.automationId -eq (Safe-Text $ExpectedAutomationId 120) -and
  $_.Control.runtimeId -eq $ExpectedRuntimeId
})
if ($matches.Count -eq 0) { throw "O controle ‘$Target’ não está visível em $Application." }
if ($matches.Count -gt 1) { throw "Há mais de um controle chamado ‘$Target’; a ação foi bloqueada por ambiguidade." }
if (!$matches[0].Control.enabled) { throw "O controle ‘$Target’ está desativado." }

$element = $matches[0].Element
$pattern = $null
if ($element.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
  ([Windows.Automation.InvokePattern]$pattern).Invoke()
} elseif ($element.TryGetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
  ([Windows.Automation.SelectionItemPattern]$pattern).Select()
} elseif ($element.TryGetCurrentPattern([Windows.Automation.TogglePattern]::Pattern, [ref]$pattern)) {
  ([Windows.Automation.TogglePattern]$pattern).Toggle()
} else {
  throw "O controle ‘$Target’ não oferece uma ação segura pela acessibilidade do Windows."
}

$base.invoked = $true
$base.control = $matches[0].Control
[pscustomobject]$base | ConvertTo-Json -Depth 5 -Compress
