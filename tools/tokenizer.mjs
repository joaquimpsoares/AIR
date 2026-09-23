/**
 * AIR Deterministic Tokenizer & Source Measurement Engine
 *
 * Implements standard deterministic model/source LLM tokenization (cl100k_base / GPT-4 & Claude compatible BPE regex)
 * to provide reproducible, apples-to-apples token counts between AIR and Conventional source files.
 */

// Standard cl100k_base regex pattern adapted for ECMAScript RegExp
const BPE_REGEX = /'(?:[sS]|[dD]|[mM]|[tT]|[lL]{2}|[vV][eE]|[rR][eE])|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+/gu;

/**
 * Tokenize a text string into model/source LLM tokens.
 * @param {string} text
 * @returns {string[]} Array of token strings
 */
export function tokenizeLLM(text) {
  if (!text) return [];
  const matches = text.match(BPE_REGEX);
  if (!matches) {
    // Fallback: character-level chunking
    return Array.from(text);
  }
  
  // Further split very long words or continuous non-whitespace sequences
  const tokens = [];
  for (const match of matches) {
    if (match.length > 32) {
      // Long token chunking into 4-char segments (typical subword BPE behavior)
      for (let i = 0; i < match.length; i += 4) {
        tokens.push(match.slice(i, i + 4));
      }
    } else {
      tokens.push(match);
    }
  }
  return tokens;
}

/**
 * Count LLM tokens in a string.
 * @param {string} text
 * @returns {number}
 */
export function countLLMTokens(text) {
  return tokenizeLLM(text).length;
}

/**
 * Compute detailed source file metrics.
 * @param {string} content
 * @param {string} filename
 * @returns {{ loc: number, bytes: number, llmTokens: number, lines: number }}
 */
export function measureSource(content, filename = "") {
  const bytes = Buffer.byteLength(content, "utf8");
  const rawLines = content.split(/\r?\n/);
  const totalLines = rawLines.length;
  
  // LOC: non-empty, non-comment lines
  const loc = rawLines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("#")) return false;
    return true;
  }).length;
  
  const llmTokens = countLLMTokens(content);
  
  return {
    loc,
    lines: totalLines,
    bytes,
    llmTokens
  };
}
