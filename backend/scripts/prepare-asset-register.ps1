param(
  [string]$WorkbookPath = 'C:\Users\Tony Ephraim\Downloads\Copy of Office Inventory Data.xlsx',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
$tsxPath = Join-Path $backendPath 'node_modules\.bin\tsx.cmd'

if (-not (Test-Path -LiteralPath $WorkbookPath -PathType Leaf)) {
  throw "Asset register workbook was not found: $WorkbookPath"
}
if (-not (Test-Path -LiteralPath $tsxPath -PathType Leaf)) {
  throw 'Backend dependencies are missing. Run npm.cmd install in the backend directory first.'
}
if ($Apply -and $env:ASSET_REGISTER_TARGET -ne 'development') {
  throw 'Writes are disabled unless ASSET_REGISTER_TARGET is explicitly set to development.'
}
if ($Apply -and $env:ASSET_REGISTER_CONFIRM -ne 'IMPORT_TO_NON_PRODUCTION') {
  throw 'Writes require ASSET_REGISTER_CONFIRM=IMPORT_TO_NON_PRODUCTION.'
}
if ($Apply -and [string]::IsNullOrWhiteSpace($env:ASSET_REGISTER_DATABASE_URL)) {
  throw 'Writes require ASSET_REGISTER_DATABASE_URL to point to a separate development/staging database.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $WorkbookPath).Path)
$tempJson = Join-Path $env:TEMP ("jhub-asset-register-{0}.json" -f [guid]::NewGuid())

function Read-ZipEntryText([string]$name) {
  $entry = $archive.GetEntry($name)
  if (-not $entry) {
    throw "Workbook is missing the required entry '$name'."
  }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

try {
  [xml]$workbook = Read-ZipEntryText 'xl/workbook.xml'
  [xml]$relationships = Read-ZipEntryText 'xl/_rels/workbook.xml.rels'
  [xml]$sharedStrings = Read-ZipEntryText 'xl/sharedStrings.xml'

  $workbookNs = [System.Xml.XmlNamespaceManager]::new($workbook.NameTable)
  $workbookNs.AddNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
  $workbookNs.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $relationshipNs = [System.Xml.XmlNamespaceManager]::new($relationships.NameTable)
  $relationshipNs.AddNamespace('p', 'http://schemas.openxmlformats.org/package/2006/relationships')

  $sheet = $workbook.SelectSingleNode('/m:workbook/m:sheets/m:sheet[1]', $workbookNs)
  if (-not $sheet) {
    throw 'The workbook contains no worksheets.'
  }
  $relationshipId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $relationship = $relationships.SelectSingleNode("/p:Relationships/p:Relationship[@Id='$relationshipId']", $relationshipNs)
  if (-not $relationship) {
    throw 'The first worksheet relationship could not be resolved.'
  }
  $target = $relationship.GetAttribute('Target')
  if ($target.StartsWith('/')) {
    $worksheetEntry = $target.TrimStart('/')
  } else {
    $worksheetEntry = 'xl/' + $target.Replace('\', '/')
  }

  $strings = [System.Collections.Generic.List[string]]::new()
  foreach ($sharedItem in $sharedStrings.SelectNodes('//*[local-name()="si"]')) {
    $parts = foreach ($textNode in $sharedItem.SelectNodes('.//*[local-name()="t"]')) { $textNode.InnerText }
    $strings.Add(($parts -join ''))
  }

  [xml]$worksheet = Read-ZipEntryText $worksheetEntry
  $worksheetRows = $worksheet.SelectNodes('//*[local-name()="sheetData"]/*[local-name()="row"]')
  $rowsByNumber = @{}
  $lastDataRow = 2

  foreach ($worksheetRow in $worksheetRows) {
    $rowNumber = [int]$worksheetRow.GetAttribute('r')
    if ($rowNumber -lt 2) { continue }
    $cells = @{ A = ''; B = ''; C = ''; D = '' }
    foreach ($cell in $worksheetRow.SelectNodes('./*[local-name()="c"]')) {
      if ($cell.GetAttribute('r') -notmatch '^([A-D])\d+$') { continue }
      $column = $Matches[1]
      $valueNode = $cell.SelectSingleNode('./*[local-name()="v"]')
      $value = if ($valueNode) { $valueNode.InnerText } else { '' }
      if ($cell.GetAttribute('t') -eq 's' -and $value -ne '') {
        $value = $strings[[int]$value]
      } elseif ($cell.GetAttribute('t') -eq 'inlineStr') {
        $parts = foreach ($textNode in $cell.SelectNodes('.//*[local-name()="t"]')) { $textNode.InnerText }
        $value = $parts -join ''
      }
      $cells[$column] = [string]$value
    }
    $rowsByNumber[$rowNumber] = $cells
    if ($rowNumber -ge 3 -and ($cells.Values -join '').Trim()) {
      $lastDataRow = [Math]::Max($lastDataRow, $rowNumber)
    }
  }

  $expectedHeaders = @('ITEM', 'DESCRIPTION', 'QUANTITY', 'CATEGORY')
  $headerRow = $rowsByNumber[2]
  $actualHeaders = if ($headerRow) {
    @($headerRow.A.Trim().ToUpperInvariant(), $headerRow.B.Trim().ToUpperInvariant(), $headerRow.C.Trim().ToUpperInvariant(), $headerRow.D.Trim().ToUpperInvariant()) -join '|'
  } else {
    ''
  }
  if ($actualHeaders -cne ($expectedHeaders -join '|')) {
    throw 'The first worksheet headers do not match ITEM, DESCRIPTION, QUANTITY, CATEGORY in columns A-D.'
  }

  $sourceRows = [System.Collections.Generic.List[object]]::new()
  $blankRows = 0
  for ($rowNumber = 3; $rowNumber -le $lastDataRow; $rowNumber++) {
    $cells = $rowsByNumber[$rowNumber]
    if (-not $cells) { $cells = @{ A = ''; B = ''; C = ''; D = '' } }
    if (-not (($cells.Values -join '').Trim())) {
      $blankRows++
      continue
    }
    $sourceRows.Add([pscustomobject]@{
      row = $rowNumber
      item = $cells.A
      description = $cells.B
      quantity = $cells.C
      category = $cells.D
    })
  }

  $payload = [pscustomobject]@{
    workbook = [System.IO.Path]::GetFileName($WorkbookPath)
    sheet = $sheet.GetAttribute('name')
    blankRows = $blankRows
    rows = $sourceRows
  }
  $json = ConvertTo-Json -InputObject $payload -Depth 6
  [System.IO.File]::WriteAllText($tempJson, $json, [System.Text.UTF8Encoding]::new($false))

  $arguments = @($tsxPath, (Join-Path $backendPath 'prisma\import-asset-register.ts'), '--input', $tempJson)
  if ($Apply) { $arguments += '--apply' } else { $arguments += '--dry-run' }
  Push-Location $backendPath
  try {
    & $arguments[0] $arguments[1..($arguments.Length - 1)]
    if ($LASTEXITCODE -ne 0) {
      throw "Asset import command failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
} finally {
  if (Test-Path -LiteralPath $tempJson) {
    Remove-Item -LiteralPath $tempJson
  }
  $archive.Dispose()
}
