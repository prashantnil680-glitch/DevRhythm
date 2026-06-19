/**
 * src/utils/cppErrorAnalyzer.js
 *
 * Analyzes C++ compiler error messages to detect common C++17 features
 * and provide user‑friendly hints about the C++14 limitation.
 */

/**
 * Analyzes a raw C++ compiler error message and returns a structured analysis.
 *
 * @param {string} errorMessage - The raw stderr from the compiler.
 * @returns {Object} - { originalError, hint, isCpp17Error }
 */
function analyzeCppError(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return { originalError: errorMessage, hint: null, isCpp17Error: false };
  }

  const normalized = errorMessage.trim();
  const patterns = [
    {
      regex: /expected unqualified-id before '\['/,
      feature: 'structured binding',
      hint: 'Structured bindings (auto [a, b] = ...) are a C++17 feature and are not supported in this environment. Please rewrite using explicit variable declarations (e.g., auto a = pair.first; auto b = pair.second;).'
    },
    {
      regex: /expected primary-expression before 'constexpr'/,
      feature: 'if constexpr',
      hint: 'if constexpr is a C++17 feature and is not supported in this environment. Please use regular if statements or template specialization instead.'
    },
    {
      regex: /expected '\)' before '\.\.\.'/,
      feature: 'fold expression',
      hint: 'Fold expressions (e.g., ( ... op ... )) are a C++17 feature and are not supported in this environment. Please use explicit recursion or loops instead.'
    },
    {
      regex: /'optional' is not a member of 'std'/,
      feature: 'std::optional',
      hint: 'std::optional is a C++17 feature and is not supported in this environment. Please use boost::optional or a custom nullable type if needed.'
    },
    {
      regex: /'variant' is not a member of 'std'/,
      feature: 'std::variant',
      hint: 'std::variant is a C++17 feature and is not supported in this environment. Please use boost::variant or a custom union/struct approach.'
    }
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(normalized)) {
      return {
        originalError: errorMessage,
        hint: pattern.hint,
        isCpp17Error: true
      };
    }
  }

  // If no specific pattern matches, return a generic C++17 hint if error contains typical C++17-related keywords
  const genericKeywords = ['structured binding', 'if constexpr', 'fold expression', 'constexpr if', 'std::optional', 'std::variant'];
  const lower = normalized.toLowerCase();
  const hasGeneric = genericKeywords.some(keyword => lower.includes(keyword));
  if (hasGeneric) {
    return {
      originalError: errorMessage,
      hint: 'This error may be caused by using a C++17 feature that is not supported in this environment. Please ensure your code is compatible with C++14.',
      isCpp17Error: true
    };
  }

  return { originalError: errorMessage, hint: null, isCpp17Error: false };
}

module.exports = { analyzeCppError };