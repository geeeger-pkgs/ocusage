<#
.SYNOPSIS
  Scan Trae process memory for SQLCipher 4 key candidates.

.DESCRIPTION
  Uses Windows API (kernel32) to read Trae process memory,
  search for hex patterns matching the database salt, and return
  candidate encryption keys as JSON. HMAC verification is done by
  the Node.js caller (trae-key-extract.mjs) for cross-platform
  cryptographic correctness.

.PARAMETER SaltHex
  Database salt (first 16 bytes of page 1) as hex string.
.PARAMETER ProcessName
  Target process name (default: "Trae.exe"; also tries "Trae CN.exe")
.PARAMETER TimeoutSeconds
  Maximum scan time (default: 60 seconds)

.OUTPUTS
  JSON: { success, candidates, salt }
#>

param(
  [Parameter(Mandatory)]
  [string]$SaltHex,

  [string]$ProcessName = "Trae.exe",

  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$MEM_COMMIT = 0x1000

# Readable memory protection flags
$READABLE = @(0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80)

# --- C# P/Invoke definitions ---
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class TraeMemScanner {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress,
    [Out] byte[] lpBuffer, int dwSize, out int lpNumberOfBytesRead);

  [StructLayout(LayoutKind.Sequential)]
  public struct MEMORY_BASIC_INFORMATION64 {
    public ulong BaseAddress;
    public ulong AllocationBase;
    public uint AllocationProtect;
    public uint _pad1;
    public ulong RegionSize;
    public uint State;
    public uint Protect;
    public uint Type;
    public uint _pad2;
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern int VirtualQueryEx(IntPtr hProcess, IntPtr lpAddress,
    out MEMORY_BASIC_INFORMATION64 lpBuffer, int dwLength);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr hObject);

  public const uint PROCESS_VM_READ = 0x0010;
  public const uint PROCESS_QUERY_INFORMATION = 0x0400;

  public static IntPtr OpenTraeProcess(int pid) {
    return OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, false, pid);
  }

  public static byte[] ReadMemory(IntPtr hProcess, ulong address, int size) {
    byte[] buf = new byte[size];
    int read;
    if (ReadProcessMemory(hProcess, new IntPtr((long)address), buf, size, out read))
      return buf;
    return null;
  }
}
"@

# --- Find Trae process with ai_agent.dll ---
function Find-TraeProcess {
  param([string]$processName)
  $nameOnly = $processName -replace '\.exe$', ''
  $procs = Get-Process -Name $nameOnly -ErrorAction SilentlyContinue
  if (-not $procs) { return $null }
  $procs = $procs | Sort-Object WorkingSet64 -Descending
  foreach ($p in $procs) {
    try {
      foreach ($mod in $p.Modules) {
        if ($mod.ModuleName -like "*ai_agent*") { return $p }
      }
    } catch { }
  }
  return $null
}

function Find-TraeProcessByTasklist {
  param([string]$processName)
  $imageName = $processName
  if (-not $imageName.EndsWith('.exe')) { $imageName += '.exe' }
  try {
    $output = & tasklist /FI "IMAGENAME eq $imageName" /M /FO CSV /NH 2>&1
    foreach ($line in $output) {
      if ($line -match 'ai_agent') {
        $parts = $line.Trim('"').Split('","')
        if ($parts.Length -ge 2) {
          $pid = [int]$parts[1]
          try { return (Get-Process -Id $pid -ErrorAction Stop) } catch { }
        }
      }
    }
  } catch { }
  return $null
}

# --- Main ---
$startTime = [DateTime]::Now
$saltHexLower = $SaltHex.ToLower()

# Step 1: Find process
$proc = Find-TraeProcess -processName $ProcessName
if (-not $proc) { $proc = Find-TraeProcessByTasklist -processName $ProcessName }
if (-not $proc) {
  foreach ($altName in @("Trae CN.exe", "Trae.exe")) {
    if ($altName -ne $ProcessName) {
      $proc = Find-TraeProcess -processName $altName
      if (-not $proc) { $proc = Find-TraeProcessByTasklist -processName $altName }
      if ($proc) { break }
    }
  }
}

if (-not $proc) {
  Write-Output '{ "success": false, "error": "Trae process with ai_agent.dll not found" }'
  exit 0
}

$traePid = $proc.Id

# Step 2: Open process
$hProcess = [TraeMemScanner]::OpenTraeProcess($traePid)
if ($hProcess -eq [IntPtr]::Zero) {
  Write-Output '{ "success": false, "error": "Cannot open process" }'
  exit 0
}

try {
  # Step 3: Enumerate memory regions
  $regions = New-Object System.Collections.ArrayList
  $addr = [UInt64]0
  $maxAddr = [UInt64]0x7FFFFFFFFFFF

  $mbi = New-Object TraeMemScanner+MEMORY_BASIC_INFORMATION64
  $mbiSize = [System.Runtime.InteropServices.Marshal]::SizeOf($mbi)

  while ($addr -lt $maxAddr) {
    $resultSize = [TraeMemScanner]::VirtualQueryEx($hProcess, [IntPtr]([Int64]$addr), [ref]$mbi, $mbiSize)
    if ($resultSize -eq 0) { break }
    if ($mbi.State -eq $MEM_COMMIT -and $READABLE -contains $mbi.Protect -and $mbi.RegionSize -gt 0 -and $mbi.RegionSize -lt 500MB) {
      [void]$regions.Add(@{ Base = $mbi.BaseAddress; Size = [UInt64]$mbi.RegionSize })
    }
    $next = $mbi.BaseAddress + $mbi.RegionSize
    if ($next -le $addr) { break }
    $addr = $next
  }

  # Step 4: Scan memory for hex patterns matching salt
  $foundCandidates = New-Object System.Collections.ArrayList
  $uniqueKeys = @{}  # deduplication hash
  $timeoutAt = $startTime.AddSeconds($TimeoutSeconds)

  for ($i = 0; $i -lt $regions.Count; $i++) {
    if ([DateTime]::Now -gt $timeoutAt) { break }

    $region = $regions[$i]
    $buf = [TraeMemScanner]::ReadMemory($hProcess, $region.Base, [Math]::Min([int]$region.Size, 10MB))
    if ($buf -eq $null) { continue }

    # Search for hex strings in ASCII content: x'...' or '...' or plain hex
    $text = [System.Text.Encoding]::ASCII.GetString($buf)
    $matches = [Regex]::Matches($text, "(?:x')?([0-9a-fA-F]{64,192})'?")

    foreach ($m in $matches) {
      $hexStr = $m.Groups[1].Value.ToLower()
      $hexLen = $hexStr.Length

      $encKeyHex = $null
      $matchedSalt = $null

      if ($hexLen -eq 96) {
        # 64-char key + 32-char salt
        $encKeyHex = $hexStr.Substring(0, 64)
        $matchedSalt = $hexStr.Substring(64)
      } elseif ($hexLen -eq 64) {
        # 64-char key only; compare salt from DB
        $encKeyHex = $hexStr
        $matchedSalt = $saltHexLower
      } elseif ($hexLen -gt 96 -and $hexLen % 2 -eq 0) {
        # Long hex string; take first 64 as key, last 32 as salt
        $encKeyHex = $hexStr.Substring(0, 64)
        $matchedSalt = $hexStr.Substring($hexLen - 32)
      } else { continue }

      if ($matchedSalt -eq $saltHexLower) {
        if (-not $uniqueKeys.ContainsKey($encKeyHex)) {
          $uniqueKeys[$encKeyHex] = $true
          [void]$foundCandidates.Add($encKeyHex)
        }
      }
    }
  }

  # Output results
  $result = @{
    success = $true
    candidates = @($foundCandidates)
    salt = $SaltHex.ToLower()
  }
  Write-Output ($result | ConvertTo-Json -Compress)
} finally {
  [TraeMemScanner]::CloseHandle($hProcess) | Out-Null
}
