/**
 * CLI Entry Point
 * 
 * Command-line interface for Threads Feed Extractor
 */

import { extractFeedData } from './extractor.js';
import { CONFIG } from './config.js';
import { filterPosts } from './filters/post-filter.js';
import { saveToFile } from './utils/file-utils.js';

/**
 * Main CLI function
 */
async function main() {
  console.log('[START] Threads Feed Extractor');
  console.log('[INFO] This is a READ-ONLY tool for learning purposes\n');

  try {
    // Extract all feed data
    const allItems = await extractFeedData({
      maxItems: CONFIG.extraction.maxItems
    });

    // Apply filters
    const filterCriteria = CONFIG.filter;
    const filteredItems = filterPosts(allItems, filterCriteria);

    // Save all items to JSON
    await saveToFile(allItems, CONFIG.output.filename);

    // Save filtered items if filters were applied
    const hasActiveFilters = Object.keys(filterCriteria).some(key => filterCriteria[key] !== null && filterCriteria[key] !== undefined);
    if (hasActiveFilters) {
      await saveToFile(filteredItems, CONFIG.output.filenameFiltered);
      console.log(`[FILTER] Applied filters: ${JSON.stringify(filterCriteria)}`);
      console.log(`[FILTER] Filtered from ${allItems.length} to ${filteredItems.length} items`);
    }

    // Print first 10 items
    console.log('\n[RESULTS] First 10 feed items:\n');
    const itemsToPrint = filteredItems.slice(0, 10);
    console.log(JSON.stringify(itemsToPrint, null, 2));

    // Print summary
    console.log(`\n[SUMMARY] Total items extracted: ${allItems.length}`);
    if (hasActiveFilters) {
      console.log(`[SUMMARY] Items after filtering: ${filteredItems.length}`);
    }
    
    // Print media statistics
    const itemsWithMedia = allItems.filter(item => item.media_urls && item.media_urls.length > 0);
    console.log(`[SUMMARY] Items with media: ${itemsWithMedia.length}`);
    
    // Print timestamp statistics
    const itemsWithTimestamp = allItems.filter(item => item.timestamp);
    console.log(`[SUMMARY] Items with timestamp: ${itemsWithTimestamp.length}`);

  } catch (error) {
    console.error('[ERROR]', error);
    throw error;
  }
}

// Run main function
// This script is designed to be executed directly, not imported
main().catch(console.error);
