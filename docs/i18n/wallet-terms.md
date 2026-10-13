# Blaze Wallet terms

The words that must never drift between the Chrome extension (`apps/signet/locales`) and the iOS app (`apps/blaze-ios/BlazeWallet/Localizable.xcstrings`). Every translation in both apps uses these. Rules and languages: `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`.

**Never translated:**
- Blaze Wallet, Blaze, Charisma, Charisma Swap, Stacks, STX
- Bitcoin and RPG in the theme names
- seed words (always the English BIP39 list)
- token names and symbols, addresses, txids

**Apple's own words:** Face ID, passcode and Settings use Apple's wording in each language. Note: Simplified Chinese calls Face ID 面容 ID.

| English | 한국어 (ko) | 简体中文 (zh-Hans / zh_CN) | Español (es) | Français (fr) | Deutsch (de) | Türkçe (tr) | 日本語 (ja) | Português (Brasil) (pt-BR / pt_BR) |
|---|---|---|---|---|---|---|---|---|
| wallet | 지갑 | 钱包 | billetera | portefeuille | Wallet | cüzdan | ウォレット | carteira |
| seed phrase | 시드 문구 | 助记词 | frase semilla | phrase de récupération | Seed-Phrase | kurtarma ifadesi | シードフレーズ | frase de recuperação |
| (seed) words | 단어 | 单词 | palabras | mots | Wörter | kelimeler | 単語 | palavras |
| account | 계정 | 账户 | cuenta | compte | Konto | hesap | アカウント | conta |
| active | 사용 중 | 使用中 | activa | actif | aktiv | etkin | 使用中 | ativa |
| use (switch to an account) | 사용 | 使用 | usar | utiliser | verwenden | kullan | 使用 | usar |
| unlink | 연결 해제 | 取消关联 | desvincular | dissocier | trennen | bağlantıyı kaldır | リンク解除 | desvincular |
| lock | 잠금 | 锁定 | bloquear | verrouiller | sperren | kilitle | ロック | bloquear |
| unlock | 잠금 해제 | 解锁 | desbloquear | déverrouiller | entsperren | kilidi aç | ロック解除 | desbloquear |
| auto-lock | 자동 잠금 | 自动锁定 | bloqueo automático | verrouillage automatique | automatische Sperre | otomatik kilit | 自動ロック | bloqueio automático |
| network fee | 네트워크 수수료 | 网络手续费 | comisión de red | frais de réseau | Netzwerkgebühr | ağ ücreti | ネットワーク手数料 | taxa de rede |
| recipient | 받는 사람 | 收款人 | destinatario | destinataire | Empfänger | alıcı | 受取人 | destinatário |
| amount (of a token) | 수량 | 数量 | cantidad | montant | Betrag | miktar | 数量 | quantidade |
| send | 보내기 | 发送 | enviar | envoyer | senden | gönder | 送金 | enviar |
| receive | 받기 | 收款 | recibir | recevoir | empfangen | al | 受け取る | receber |
| balance | 잔액 | 余额 | saldo | solde | Guthaben | bakiye | 残高 | saldo |
| Standard (the on-chain balance) | 일반 | 标准 | Estándar | Standard | Standard | Standart | スタンダード | Padrão |
| on Blaze | Blaze에 | 在 Blaze 上 | en Blaze | sur Blaze | auf Blaze | Blaze'de | Blaze 上 | no Blaze |
| token | 토큰 | 代币 | token | jeton | Token | token | トークン | token |
| token list | 토큰 목록 | 代币列表 | lista de tokens | liste de jetons | Token-Liste | token listesi | トークンリスト | lista de tokens |
| unlisted | 목록에 없음 | 未收录 | no listado | non listé | nicht gelistet | listede yok | 未掲載 | não listado |
| subnet | 서브넷 | 子网 | subred | sous-réseau | Subnetz | alt ağ | サブネット | sub-rede |
| explorer | 탐색기 | 区块浏览器 | explorador | explorateur | Explorer | blok gezgini | エクスプローラー | explorador |
| Exactly this amount, nothing else | 정확히 이 수량만, 그 이상은 없음 | 只转出这个数量，不多不少 | Exactamente esta cantidad, nada más | Exactement ce montant, rien de plus | Genau dieser Betrag, sonst nichts | Tam olarak bu miktar, fazlası değil | この数量だけ、それ以上は送られません | Exatamente esta quantidade, nada mais |
| funds | 자금 | 资金 | fondos | fonds | Guthaben | fonlar | 資金 | fundos |
| Vault (the settings card) | 보관함 | 保险库 | Bóveda | Coffre-fort | Tresor | Kasa | 保管庫 | Cofre |
| Theme | 테마 | 主题 | Tema | Thème | Design | Tema | テーマ | Tema |
| Live (Status: everything answered) | 정상 | 在线 | En línea | En ligne | Online | Çevrimiçi | 正常 | Online |
| Face ID (Apple) | Face ID | 面容 ID | Face ID | Face ID | Face ID | Face ID | Face ID | Face ID |
| passcode (Apple) | 암호 | 密码 | código | code | Code | parola | パスコード | código |
| Settings (Apple) | 설정 | 设置 | Ajustes | Réglages | Einstellungen | Ayarlar | 設定 | Ajustes |
| System (theme) | 시스템 | 跟随系统 | Sistema | Système | System | Sistem | システム | Sistema |
| Light · Bitcoin | 라이트 · Bitcoin | 浅色 · Bitcoin | Claro · Bitcoin | Clair · Bitcoin | Hell · Bitcoin | Açık · Bitcoin | ライト · Bitcoin | Claro · Bitcoin |
| Dark · RPG | 다크 · RPG | 深色 · RPG | Oscuro · RPG | Sombre · RPG | Dunkel · RPG | Koyu · RPG | ダーク · RPG | Escuro · RPG |

**Tone:** plain and calm, as in English. How each language addresses the person:

| Language | Address |
|---|---|
| Spanish | tú |
| German | du |
| Portuguese (Brazil) | você |
| French | vous |
| Turkish | polite siz forms ("girin", "kontrol edin") |
| Korean | polite -요 / -습니다 endings |
| Japanese | です / ます |
| Chinese | neutral |

**Platform words.** When a platform has its own word for something, each app follows its own platform:

| Example | iOS app (Apple's iOS terms) | Extension (Chrome's and the web's) |
|---|---|---|
| "Copy" in Chinese | 拷贝 | 复制 |
| "Done" in Spanish | OK | Listo |
| "Done" in Portuguese | OK | Concluído |

**Shared phrases:** where the extension says the same thing as the iOS app (the seed-word warnings, the send review, the unlink dialogs, the errors), use the iOS app's translation word for word.

**Grammar, per language:**
- **Korean:** never attach a particle straight to a fill-in (`%@` or `$1`), because the right particle depends on the word that fills it.
- **Simplified Chinese:** full-width punctuation (，。：). "Live" (Status) is 在线.
- **Spanish:** Latin American verbs (ingresa, agrega, revisa).
- **Turkish:**
  - the plural of token is "tokenlar"
  - no suffix attached to a fill-in or a brand name: reword instead ("Stacks ağında")
  - the seed warning says "kontrolünü ele geçirir", not "kontrol eder", which also means "checks"
- **Japanese:**
  - a half-width space between Latin text or numbers and Japanese ("Blaze 上", "24 単語"); full-width （）「」：？
  - the vault's "Keys" is 秘密鍵, because plain 鍵 can mean "lock"
  - tokens are counted with 種類
  - "Live" (Status) is 正常
- **Korean and Japanese:** "controls your funds" is "can move your funds at will" (자금을 마음대로 움직일 수 있습니다 / 資金を自由に動かせます).
- **French:** the curly apostrophe (’), and a non-breaking space before : ; ? ! and inside « ».
- **German:** a non-breaking space before a trailing "…" ("Wird geprüft …").
- **Brazilian Portuguese:** "a Blaze Wallet" and "da Charisma" (both feminine); "Charisma Swap" with no article.
