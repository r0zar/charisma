import "@plasmohq/messaging/background"
import { listenForProviderRequests } from "./lib/provider"

// Standard wallet requests (connect, sign, send) from web pages
listenForProviderRequests()

// Clicking the toolbar icon opens the wallet in the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
