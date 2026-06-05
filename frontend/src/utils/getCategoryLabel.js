import { FINANCE_CATEGORIES } from "../constants/financeCategories";

export function getFinanceCategoryLabel(value) {
  const found = FINANCE_CATEGORIES.find(
    (c) => c.value === String(value).toLowerCase()
  );

  if (!found) {
    return value?.replaceAll("_", " ") || "--";
  }

  return `${found.amharic} — ${found.english}`;
}