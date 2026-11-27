'use strict';
const path = require('node:path');
const { access } = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);

const readSavedKey = Buffer.from(`
$ErrorActionPreference = 'Stop'
$secure = Microsoft.PowerShell.Security\\ConvertTo-SecureString -String ([IO.File]::ReadAllText($env:NETDOCTOR_GEMINI_KEY_FILE).Trim())
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
} finally { $secure.Dispose() }
`, 'utf16le').toString('base64');

async function backendEnvironment(env = process.env) {
  if (env.GEMINI_API_KEY?.trim() || process.platform !== 'win32') return env;
  const file = env.NETDOCTOR_GEMINI_KEY_FILE || path.join(__dirname, '..', '.env.gemini.dpapi');
  try {
    await access(file);
    const powershell = path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const loaderEnv = { ...env, NETDOCTOR_GEMINI_KEY_FILE: file };
    // Let Windows PowerShell select its own modules when launched from PowerShell 7.
    delete loaderEnv.PSModulePath;
    const result = await execute(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', readSavedKey], {
      env: loaderEnv, windowsHide: true, timeout: 8000, maxBuffer: 4096
    });
    const key = result.stdout.trim();
    if (key) return { ...env, GEMINI_API_KEY: key };
  } catch {
    // A missing or unreadable key must not block local diagnostics.
  }
  return env;
}

module.exports = { backendEnvironment };
