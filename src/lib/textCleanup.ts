/**
 * Utility to clean up text outputs from AI (Gemini).
 * - Converts <BR>, <br>, <BR/>, <br/> to actual newlines
 * - Removes loose/unwanted '*' characters that clutter the text, while maintaining Markdown formatting
 * - Standardizes bullet points
 */
export function cleanAiOutputText(text: string): string {
  if (!text) return "";
  
  let cleaned = text;

  // 1. Convert <br> / <BR> and variants to actual newlines
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // 2. Fix the * (asterisks) issues:
  // Sometimes Gemini outputs lists like "* item" or "** item" or " * item".
  // Let's normalize stray spaces around bullet lists
  cleaned = cleaned.replace(/^\s*[•*]\s+/gm, "- ");

  // Also, sometimes Gemini uses single asterisks for emphasis, e.g. *texto*.
  // Or it produces lone asterisks due to syntax issues. Let's remove lone asterisks that aren't starting a bullet point or aren't part of a bold double asterisk block (**).
  // For instance, let's replace stray asterisks (lone * surrounded by spaces) with bullet characters or remove them.
  cleaned = cleaned.replace(/\s\*\s/g, " ");

  // Sometimes there are double bold markers inside headings, like "### **Assunto**". Let's clean that up to be standard heading
  cleaned = cleaned.replace(/^#+\s*\*\*([^\*]+)\*\*/gm, (match, p1) => {
    const headingHashes = match.split("**")[0];
    return headingHashes + p1;
  });

  return cleaned;
}

/**
 * Strips all markdown asterisks (** or *) from a string to render as completely clean plain text.
 */
export function stripMarkdownAsterisks(text: string): string {
  if (!text) return "";
  let cleaned = text;

  // Convert <br> variants to actual newlines
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // Remove double asterisks (used for bolding) but keep the content
  cleaned = cleaned.replace(/\*\*([\s\S]*?)\*\*/g, "$1");

  // Remove single asterisks (used for italics/emphasis) but keep the content
  cleaned = cleaned.replace(/\*([\s\S]*?)\*/g, "$1");

  // Normalize list bullet indicators (e.g. "* item" -> "- item")
  cleaned = cleaned.replace(/^\s*\*\s+/gm, "- ");

  // Remove any remaining loose asterisks that might be left over
  cleaned = cleaned.replace(/\*/g, "");

  return cleaned;
}
