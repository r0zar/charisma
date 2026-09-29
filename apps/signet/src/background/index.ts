import "@plasmohq/messaging/background"
import { startHub } from "@plasmohq/messaging/pub-sub"
import { SubnetRegistry } from "./lib/subnet-registry"
import * as wallet from "./lib/wallet"
import { listenForProviderRequests } from "./lib/provider"

// Initialize global subnet registry
export const subnetRegistry = new SubnetRegistry()

// Log initialization
console.log("Initializing Signet Subnet Registry background service")

// Set up wallet initialization listener
const initializeWalletConnection = async () => {
    try {
        // Check if wallet is already initialized
        const isInitialized = await wallet.checkWalletInitialized()

        if (isInitialized) {
            // Get current active account and update the subnet registry signer
            const currentAccount = await wallet.getCurrentAccount()

            if (currentAccount) {
                console.log(`Setting initial signer from active account: ${currentAccount.stxAddress}`)
                subnetRegistry.signer = currentAccount.stxAddress
            }
        }
    } catch (error) {
        console.error("Error initializing wallet connection:", error)
    }
}

// Standard wallet requests (connect, sign, ...) from web pages
listenForProviderRequests()

// Clicking the toolbar icon opens the wallet in the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// The old session code kept the password in plain text; remove it
wallet.removeLegacySession()

// Initialize wallet connection
initializeWalletConnection()

// Start message hub for communication
startHub()