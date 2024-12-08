// Smart filter utility to detect and parse different types of input

/**
 * Detects the type of input and returns appropriate filter parameters
 * @param {string} input - The search input
 * @returns {Object} Filter parameters object
 */
export function parseSmartFilter(input) {
  if (!input) return null;

  // Normalize input
  const normalizedInput = input.trim();

  // Check for phone number (any sequence of digits)
  const phonePattern = /^\d+$/;
  if (phonePattern.test(normalizedInput)) {
    return {
      mobile_no: ['LIKE', `%${normalizedInput}%`]
    };
  }

  // Check for email (contains @)
  if (normalizedInput.includes('@')) {
    return {
      email: ['LIKE', `%${normalizedInput}%`]
    };
  }

  // Default to searching by lead name
  return {
    lead_name: ['LIKE', `%${normalizedInput}%`]
  };
}

/**
 * Converts smart filter parameters to the format expected by the filtering system
 * @param {Object} smartFilterParams - Parameters from parseSmartFilter
 * @returns {Object} Formatted filter parameters
 */
export function formatSmartFilterParams(smartFilterParams) {
  if (!smartFilterParams) return {};
  return smartFilterParams;
} 