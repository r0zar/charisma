import { Header } from "@/components/header"
import { BlazeSignerInterface } from "../../components/blaze-signer/blaze-signer-interface"

export default function SignerLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            <BlazeSignerInterface />
            {/* We render the children but they're hidden - this is just for Next.js routing to work */}
            <div style={{ display: 'none' }}>{children}</div>
        </>
    )
} 