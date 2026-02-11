/**
 * Human-like Scrolling
 * 
 * Implements human-like scrolling behavior to trigger lazy loading
 */

import { CONFIG } from '../config.js';

/**
 * Scroll the feed slowly like a human would
 * WHY: Triggers lazy loading and avoids detection
 * STABLE: Scrolling behavior is independent of UI changes
 */
export async function scrollFeed(page, config = CONFIG) {
  console.log('[SCROLL] Starting human-like scrolling...');

  const scrollConfig = config.scroll || CONFIG.scroll;

  for (let i = 0; i < scrollConfig.maxAttempts; i++) {
    // Random delay between scrolls (human-like)
    const delay = Math.floor(
      Math.random() * (scrollConfig.delayMaxMs - scrollConfig.delayMinMs) +
      scrollConfig.delayMinMs
    );

    await page.waitForTimeout(delay);

    // Scroll incrementally
    await page.evaluate((increment) => {
      window.scrollBy({
        top: increment,
        behavior: 'smooth'
      });
    }, scrollConfig.incrementPx);

    // Pause after scroll
    await page.waitForTimeout(scrollConfig.pauseBetweenScrollsMs);

    // Check if we've reached the bottom
    const isAtBottom = await page.evaluate(() => {
      return window.innerHeight + window.scrollY >= document.body.scrollHeight - 100;
    });

    if (isAtBottom) {
      console.log('[SCROLL] Reached bottom of page');
      break;
    }
  }

  console.log('[SCROLL] Scrolling complete');
}
