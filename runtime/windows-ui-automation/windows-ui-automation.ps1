param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('observe', 'invoke', 'capture', 'click')]
  [string]$Operation,

  [Parameter(Mandatory = $true)]
  [ValidateLength(1, 80)]
  [string]$Application,

  [ValidateLength(0, 120)]
  [string]$Target = '',

  [ValidateSet('', 'Button', 'CheckBox', 'Hyperlink', 'ListItem', 'MenuItem', 'RadioButton', 'TabItem')]
  [string]$ControlType = '',

  [int]$X = -1,

  [int]$Y = -1
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TitiUiInput {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
'@

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

function Get-Window {
  $wanted = Normalize-Label $Application
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
      $allowsPartialMatch = $wanted.Length -ge 4
      if ($processName -eq $wanted -or $windowName -eq $wanted -or ($allowsPartialMatch -and ($processName.StartsWith($wanted) -or $windowName.Contains($wanted)))) {
        $score = 0
        if ($processName -eq $wanted) { $score += 20 }
        if ($windowName -eq $wanted) { $score += 10 }
        if ($window.Current.IsEnabled) { $score += 2 }
        $matches += [pscustomobject]@{ Element = $window; Process = $process; Score = $score }
      }
    } catch {
      continue
    }
  }
  $selected = $matches | Sort-Object Score -Descending | Select-Object -First 1
  if ($null -eq $selected) { throw "Não encontrei uma janela visível de $Application." }
  return $selected
}

function Convert-Control($Element) {
  return [ordered]@{
    name = Safe-Text $Element.Current.Name 120
    controlType = $Element.Current.ControlType.ProgrammaticName.Replace('ControlType.', '')
    automationId = Safe-Text $Element.Current.AutomationId 120
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

$selectedWindow = Get-Window
$base = [ordered]@{
  application = Safe-Text $Application 80
  windowTitle = Safe-Text $selectedWindow.Element.Current.Name 160
  processName = Safe-Text $selectedWindow.Process.ProcessName 100
}

$rectangle = $selectedWindow.Element.Current.BoundingRectangle
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

if ($Operation -eq 'click') {
  if ($X -lt 0 -or $Y -lt 0 -or $X -ge $width -or $Y -ge $height) {
    throw 'As coordenadas do clique estão fora da janela observada.'
  }
  [void][TitiUiInput]::SetForegroundWindow([IntPtr]$selectedWindow.Element.Current.NativeWindowHandle)
  Start-Sleep -Milliseconds 120
  [void][TitiUiInput]::SetCursorPos($left + $X, $top + $Y)
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
  ([string]::IsNullOrWhiteSpace($ControlType) -or $_.Control.controlType -eq $ControlType)
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
