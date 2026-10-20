/**
 * Helper to localize caregiver relationship metadata (e.g. Grandson -> पोता / பேரன் / మనవడు)
 */

export const getLocalizedRelation = (
  relation: string | undefined | null,
  t: (key: string, params?: Record<string, string | number>) => string
): string => {
  if (!relation) return t('relation.caregiver') || 'Caregiver';
  const clean = relation.toLowerCase().trim();
  const withUnderscore = clean.replace(/[\s-]+/g, '_');
  
  // Try relation.family_caregiver or relation.grandson
  const key1 = `relation.${withUnderscore}`;
  const trans1 = t(key1);
  if (trans1 && trans1 !== key1) return trans1;

  // Try direct relation.grandson
  const key2 = `relation.${clean}`;
  const trans2 = t(key2);
  if (trans2 && trans2 !== key2) return trans2;

  return relation;
};

