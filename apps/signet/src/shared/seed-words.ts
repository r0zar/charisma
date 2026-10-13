/**
 * Typed or pasted seed words, spelled the way the English BIP39 list spells them (translations spec, "Seed word
 * entry"): full-width letters and spaces become normal ones (NFKC, from Japanese, Chinese and Korean keyboards),
 * Turkish İ and ı become i, then lowercase without a locale (a Turkish locale turns I into ı) and single spaces.
 */
export const normalizeSeedWords = (text: string) =>
  text.normalize("NFKC").replace(/[İı]/g, "i").toLowerCase().trim().split(/\s+/).join(" ")
