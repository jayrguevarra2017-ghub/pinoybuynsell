export const maxSuggestionPhotos = 3;
export const maxSuggestionPhotoBytes = 500 * 1024;

export function validateSuggestion(value) {
  if (!value || typeof value.title !== "string" || !value.title.trim() || value.title.length > 140
    || typeof value.description !== "string" || !value.description.trim() || value.description.length > 2500
    || !Array.isArray(value.uncertain_details) || value.uncertain_details.length > 8
    || value.uncertain_details.some(item => typeof item !== "string" || !item.trim() || item.length > 200)) return null;
  return { title: value.title.trim(), description: value.description.trim(), uncertain_details: value.uncertain_details.map(item => item.trim()) };
}
