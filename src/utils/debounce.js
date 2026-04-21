/**
 * Debounce utility - delays function execution until after waitMs
 * Subsequent calls reset the timer (trailing edge)
 */

/**
 * Creates a debounced version of the provided function
 * @param {function} fn - Function to debounce
 * @param {number} delayMs - Delay in milliseconds
 * @returns {function} Debounced function with flush() method
 */
export function debounce(fn, delayMs) {
  if (typeof fn !== 'function') {
    return fn; // Return as-is for graceful handling
  }
  
  let timeoutId = null;
  
  const debouncedFn = function(...args) {
    // Clear existing timer
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    // Set new timer
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, delayMs);
  };
  
  // Add flush method to execute immediately
  debouncedFn.flush = function(...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      fn.apply(this, args);
    }
  };
  
  return debouncedFn;
}
