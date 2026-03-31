const htmlLikePattern = /<[^>]*>/g;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeText(value: string) {
  return collapseWhitespace(value.replace(htmlLikePattern, ""));
}

export function sanitizeMultilineText(value: string) {
  return value
    .replace(htmlLikePattern, "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}
