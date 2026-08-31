$ErrorActionPreference = "Stop"

Write-Output "Testing Google Trends RSS..."
$google = Invoke-WebRequest -Uri "https://trends.google.com/trending/rss?geo=GR" -TimeoutSec 30
if ($google.StatusCode -ne 200) { throw "Google Trends returned HTTP $($google.StatusCode)" }
[xml]$googleXml = $google.Content
$googleItems = @($googleXml.rss.channel.item)
if ($googleItems.Count -lt 1) { throw "Google Trends returned no items" }
"PASS Google Trends: HTTP $($google.StatusCode), items=$($googleItems.Count)"
$googleItems | Select-Object -First 3 title, link | Format-Table -AutoSize

Write-Output "Testing GDELT..."
$gdeltUrl = "https://api.gdeltproject.org/api/v2/doc/doc?query=technology&mode=timelinevol&format=json&timespan=7d"
try {
  $gdelt = Invoke-WebRequest -Uri $gdeltUrl -TimeoutSec 30
  if ($gdelt.StatusCode -ne 200) { throw "GDELT returned HTTP $($gdelt.StatusCode)" }
  $gdeltData = $gdelt.Content | ConvertFrom-Json
  $points = @($gdeltData.timeline)
  if ($points.Count -lt 1) { throw "GDELT returned no timeline points" }
  "PASS GDELT: HTTP $($gdelt.StatusCode), points=$($points.Count)"
} catch {
  "WARN GDELT unavailable: $($_.Exception.Message)"
}
