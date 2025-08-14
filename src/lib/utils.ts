import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Builds a dynamic process link by replacing <processo> placeholder with the process number
 * @param orgaoLinkDinamico - The dynamic link template from the organization
 * @param processoNumero - The process number to substitute
 * @returns The final URL string or null if invalid inputs
 */
export function buildProcessoLink(orgaoLinkDinamico?: string | null, processoNumero?: string | null): string | null {
  // Return null if either parameter is missing or empty
  if (!orgaoLinkDinamico?.trim() || !processoNumero?.trim()) {
    return null;
  }

  // Sanitize process number - keep only A-Z, a-z, 0-9, /, -, ., and spaces
  const sanitizedProcessNumber = processoNumero.trim().replace(/[^A-Za-z0-9\/\-\.\s]/g, '');
  
  // Replace all occurrences of <processo> with encoded process number
  let finalLink = orgaoLinkDinamico.replace(/<processo>/g, encodeURIComponent(sanitizedProcessNumber));
  
  // Validate and add protocol if missing
  if (!finalLink.match(/^https?:\/\//)) {
    finalLink = `https://${finalLink}`;
  }
  
  return finalLink;
}
