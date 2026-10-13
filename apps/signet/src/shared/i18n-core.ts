/**
 * Blaze Wallet's words in nine languages (translations spec). Looks up locales/{folder}/messages.json (Chrome's
 * format), fills in $1…$9 ($$ is a dollar sign) and picks plural forms. No DOM and no storage, so the background
 * service worker imports it too, in English only, to word WalletError.message. Pages use ./i18n.
 */
import de from "../../locales/de/messages.json"
import en from "../../locales/en/messages.json"
import es from "../../locales/es/messages.json"
import fr from "../../locales/fr/messages.json"
import ja from "../../locales/ja/messages.json"
import ko from "../../locales/ko/messages.json"
import pt_BR from "../../locales/pt_BR/messages.json"
import tr from "../../locales/tr/messages.json"
import zh_CN from "../../locales/zh_CN/messages.json"

/** Every language, in the picker's order, each named in its own language */
export const LANGUAGES = [
  { folder: "en", name: "English", locale: "en" },
  { folder: "ko", name: "한국어", locale: "ko" },
  { folder: "zh_CN", name: "简体中文", locale: "zh-CN" },
  { folder: "es", name: "Español", locale: "es" },
  { folder: "fr", name: "Français", locale: "fr" },
  { folder: "de", name: "Deutsch", locale: "de" },
  { folder: "tr", name: "Türkçe", locale: "tr" },
  { folder: "ja", name: "日本語", locale: "ja" },
  { folder: "pt_BR", name: "Português (Brasil)", locale: "pt-BR" },
] as const

export type Folder = (typeof LANGUAGES)[number]["folder"]
export type Fill = string | number

type Messages = Record<string, { message: string }>
const MESSAGES: Record<Folder, Messages> = { en, ko, zh_CN, es, fr, de, tr, ja, pt_BR }

/** The BCP 47 tag for Intl formatting */
export const localeOf = (folder: Folder) => LANGUAGES.find(language => language.folder === folder)!.locale

/**
 * The folder for a browser language, in Chrome's own order: the exact language (zh-CN → zh_CN), then its base
 * language when there's a folder for it (es-419 → es), otherwise English. So zh-TW and pt-PT start in English.
 */
export function match(uiLanguage: string): Folder {
  const tag = uiLanguage.replace(/-/g, "_").toLowerCase()
  const exact = LANGUAGES.find(language => language.folder.toLowerCase() === tag)
  if (exact) return exact.folder
  return LANGUAGES.find(language => language.folder === tag.split("_")[0])?.folder ?? "en"
}

/** A message with its $1…$9 filled in. A key a language doesn't have is a bug: check-locales stops it shipping. */
export function format(folder: Folder, key: string, fills: Fill[] = []): string {
  const entry = MESSAGES[folder][key]
  if (!entry) throw new Error(`Blaze Wallet has no ${folder} message "${key}"`)
  return entry.message.replace(/\$(\$|[1-9])/g, (_, slot: string) => {
    if (slot === "$") return "$"
    const fill = fills[Number(slot) - 1]
    if (fill === undefined) throw new Error(`Message "${key}" needs $${slot}`)
    return String(fill)
  })
}

/** The key of a counted phrase's form: `key_one`, `key_many`… as `count` needs in this language, else `key_other` */
export function pluralKey(folder: Folder, key: string, count: number): string {
  const form = new Intl.PluralRules(localeOf(folder)).select(count)
  return MESSAGES[folder][`${key}_${form}`] ? `${key}_${form}` : `${key}_other`
}

/** A counted phrase in its right form, filled in */
export const plural = (folder: Folder, key: string, count: number, fills: Fill[] = []) => format(folder, pluralKey(folder, key, count), fills)
