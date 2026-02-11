/**
 * File Utilities
 * 
 * Handles file I/O operations
 */

import { writeFile, mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { CONFIG } from '../config.js';

/**
 * Save feed items to JSON file
 * WHY: Persist extracted data for later analysis
 * STABLE: File I/O is independent of extraction logic
 */
export async function saveToFile(items, filename, outputDir = CONFIG.output.dir) {
  try {
    // Create output directory if it doesn't exist
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const filepath = join(outputDir, filename);
    const data = {
      extracted_at: new Date().toISOString(),
      total_items: items.length,
      items: items
    };

    await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[SAVE] Saved ${items.length} items to ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('[ERROR] Failed to save file:', error.message);
    throw error;
  }
}

/**
 * Write debug log entry to file (NDJSON format)
 * WHY: Debug logging needs to persist to file for analysis
 * STABLE: File I/O is independent of extraction logic
 */
const DEBUG_LOG_PATH = join(process.cwd(), '.cursor', 'debug.log');

export async function writeDebugLog(entry) {
  try {
    // Ensure directory exists
    const logDir = dirname(DEBUG_LOG_PATH);
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true });
      console.log(`[DEBUG] Created log directory: ${logDir}`);
    }
    
    // Write NDJSON line (one JSON object per line)
    const logLine = JSON.stringify(entry) + '\n';
    await appendFile(DEBUG_LOG_PATH, logLine, 'utf-8');
    
    // Debug: Log first few writes to console to verify it's working
    if (!writeDebugLog._loggedFirst) {
      console.log(`[DEBUG] ✅ First debug log written to: ${DEBUG_LOG_PATH}`);
      writeDebugLog._loggedFirst = true;
    }
  } catch (error) {
    // Don't silent fail - log to console so we know there's an issue
    console.error(`[DEBUG ERROR] ❌ Failed to write debug log to ${DEBUG_LOG_PATH}: ${error.message}`);
    console.error(`[DEBUG ERROR] Full path: ${DEBUG_LOG_PATH}`);
    console.error(`[DEBUG ERROR] CWD: ${process.cwd()}`);
    console.error(`[DEBUG ERROR] Stack:`, error.stack);
  }
}
