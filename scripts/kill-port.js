#!/usr/bin/env node

/**
 * Kill process using a specific port
 * Usage: node scripts/kill-port.js [port]
 * Default port: 3000
 */

import { execSync } from 'child_process';

const port = process.argv[2] || '3000';

console.log(`[KILL-PORT] Looking for process using port ${port}...`);

try {
  // Try to find process using lsof (Linux/Mac/WSL)
  try {
    const lsofOutput = execSync(`lsof -i :${port} -t`, { encoding: 'utf-8' }).trim();
    const pids = lsofOutput.split('\n').filter(pid => pid.trim());
    
    if (pids.length === 0) {
      console.log(`[KILL-PORT] No process found using port ${port}`);
      process.exit(0);
    }
    
    console.log(`[KILL-PORT] Found process(es): ${pids.join(', ')}`);
    
    for (const pid of pids) {
      try {
        execSync(`kill ${pid}`, { stdio: 'inherit' });
        console.log(`[KILL-PORT] ✓ Killed process ${pid}`);
      } catch (err) {
        console.error(`[KILL-PORT] ✗ Failed to kill process ${pid}:`, err.message);
        // Try force kill
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'inherit' });
          console.log(`[KILL-PORT] ✓ Force killed process ${pid}`);
        } catch (err2) {
          console.error(`[KILL-PORT] ✗ Failed to force kill process ${pid}:`, err2.message);
        }
      }
    }
    
    console.log(`[KILL-PORT] Done!`);
  } catch (err) {
    // lsof not available or no process found
    if (err.message.includes('Command failed')) {
      console.log(`[KILL-PORT] No process found using port ${port} (or lsof not available)`);
      console.log(`[KILL-PORT] You can try manually:`);
      console.log(`[KILL-PORT]   Linux/WSL: kill $(lsof -t -i:${port})`);
      console.log(`[KILL-PORT]   Windows: netstat -ano | findstr :${port}`);
      process.exit(0);
    } else {
      throw err;
    }
  }
} catch (err) {
  console.error(`[KILL-PORT] Error:`, err.message);
  console.error(`[KILL-PORT] Manual steps:`);
  console.error(`[KILL-PORT]   Linux/WSL: kill $(lsof -t -i:${port})`);
  console.error(`[KILL-PORT]   Windows: netstat -ano | findstr :${port}`);
  process.exit(1);
}
