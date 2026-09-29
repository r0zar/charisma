/**
 * Main content script for injecting the SignetApp into web pages
 */
import type { PlasmoCSConfig } from "plasmo"
import '../shared/styles/form-elements.css'
import { SignetProvider } from "~shared/context/SignetContext"
import { Notifications } from "./components/Notifications"

export const config: PlasmoCSConfig = {
  matches: [
    "https://bold-sheep-31.clerk.accounts.dev/*",
    "https://signet-omega.vercel.app/",
    "https://www.oppredict.com/*",
    "https://charisma.rocks/*"
  ],
  all_frames: true
}

/**
 * Main overlay component for the Chrome extension
 * We wrap SignetApp in a div with specific styles to ensure
 * no styles leak to webpage even without Shadow DOM
 */
const PlasmoOverlay = () => {
  return (
    <div id="signet-root" style={{
      all: 'initial',
      position: 'fixed',
      top: 12,
      left: 10,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none', // Allow clicks to pass through to the page
      zIndex: 999999,
      fontFamily: 'Inter, sans-serif',
      display: 'block',
      boxSizing: 'border-box',
      backgroundColor: 'transparent'
    }}>
      <SignetProvider>
        {/* The 3D notification cubes; the wallet itself lives in the side panel */}
        <Notifications />
      </SignetProvider>
    </div>
  )
}

export default PlasmoOverlay