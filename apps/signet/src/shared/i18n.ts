/**
 * Words for the wallet's own pages (side panel, approval window), in the language the person picked in the Vault
 * card, or Chrome's language when they left it on Automatic. The pick is saved in localStorage, like the theme:
 * every wallet page shares one origin, so one pick covers them all. Changing it reloads the page.
 */
import { LANGUAGES, format, localeOf, match, plural as pluralIn, pluralKey as pluralKeyIn, type Fill, type Folder } from "./i18n-core"

export { LANGUAGES, type Folder }

const STORAGE_KEY = "blaze-language"

export type LanguageChoice = "auto" | Folder

/** The saved pick; Automatic when there's none (or storage is blocked, as the theme does) */
export function readLanguage(): LanguageChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.some(language => language.folder === saved)) return saved as Folder
  } catch {
    // Storage blocked: Automatic
  }
  return "auto"
}

/** Saves a pick and reloads, so every word and number on the page changes together */
export function pickLanguage(choice: LanguageChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, choice)
  } finally {
    location.reload()
  }
}

const choice = readLanguage()
const chromeLanguage = chrome.i18n.getUILanguage()
export const folder: Folder = choice === "auto" ? match(chromeLanguage) : choice
/**
 * For every Intl formatter on the page: Chrome's own language when it's a variant of the page's (Latin American
 * Spanish writes 1,234.5 where Spain's writes 1.234,5), otherwise the page's language
 */
export const locale = chromeLanguage.split("-")[0].toLowerCase() === localeOf(folder).split("-")[0] ? chromeLanguage : localeOf(folder)
// Chinese and Japanese draw some shared characters differently: the page says which language its text is in
document.documentElement.lang = localeOf(folder)

/** A message in the page's language, with $1…$9 filled in */
export const t = (key: string, ...fills: Fill[]) => format(folder, key, fills)

/** A counted phrase in the page's language; `count` picks the plural form, `fills` fill it (count included) */
export const plural = (key: string, count: number, ...fills: Fill[]) => pluralIn(folder, key, count, fills)

/** The key of a counted phrase's right form, for components that take a key (RequestHeader) */
export const pluralKey = (key: string, count: number) => pluralKeyIn(folder, key, count)

/** A whole number in the page's language */
export const count = (value: number) => value.toLocaleString(locale)
