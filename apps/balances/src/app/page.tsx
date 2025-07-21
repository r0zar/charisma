import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Wallet, Camera } from "lucide-react"

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Balance Collection Service</h1>
        <p className="text-muted-foreground">
          Track and manage Stacks blockchain balances with automated collection and historical snapshots
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Dashboard</span>
              </CardTitle>
              <CardDescription>
                View balance collection activity and service metrics
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/collection">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wallet className="h-5 w-5" />
                <span>Collection</span>
              </CardTitle>
              <CardDescription>
                Start new balance collection runs and manage addresses
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/snapshots">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Camera className="h-5 w-5" />
                <span>Snapshots</span>
              </CardTitle>
              <CardDescription>
                Browse and manage historical balance snapshots
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Service Overview */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Service Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Automated Collection</h3>
            </div>
            <div>
              <div className="text-2xl font-bold mb-2">Real-time</div>
              <p className="text-xs text-muted-foreground">
                Continuously track balances across multiple addresses and contracts
              </p>
            </div>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Compressed Storage</h3>
            </div>
            <div>
              <div className="text-2xl font-bold mb-2">Efficient</div>
              <p className="text-xs text-muted-foreground">
                Snapshots stored with high compression ratios for cost optimization
              </p>
            </div>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Performance Monitoring</h3>
            </div>
            <div>
              <div className="text-2xl font-bold mb-2">Analytics</div>
              <p className="text-xs text-muted-foreground">
                Track collection performance and identify trends over time
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}