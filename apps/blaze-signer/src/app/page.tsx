import type { Metadata } from "next"
import { BlazeSignerInterface } from '../components/blaze-signer/blaze-signer-interface'

// Keep global styles import if you have one, e.g., for fonts or resets
// import "../styles/globals.css"; // Make sure this path is correct

export const metadata: Metadata = {
  title: 'Blaze Signer',
  description: 'Test interface for the Blaze-signer smart contract',
}

export default function BlazeSignerPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <BlazeSignerInterface />
    </div>
  )
}
