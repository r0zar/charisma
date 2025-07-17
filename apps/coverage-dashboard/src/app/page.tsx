'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import Link from 'next/link';
import { ExternalLink, FileText, Activity, Clock, Shield, Zap, TrendingUp, Code2 } from 'lucide-react';

interface CoveragePackage {
  name: string;
  path: string;
  jsonPath: string;
  htmlPath: string;
  hasData: boolean;
  lastUpdated?: string;
}

interface CoverageSummary {
  statements: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  lines: { total: number; covered: number; pct: number };
}

interface AggregatedCoverage {
  packages: CoveragePackage[];
  totalPackages: number;
  packagesWithData: number;
  overallSummary: CoverageSummary;
  lastUpdated: string;
}

export default function CoverageDashboard() {
  const [data, setData] = useState<AggregatedCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCoverageData();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchCoverageData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchCoverageData = async () => {
    try {
      const response = await fetch('/api/coverage');
      if (!response.ok) throw new Error('Failed to fetch coverage data');
      
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (pct: number) => `${pct.toFixed(1)}%`;
  
  const getCoverageColor = (pct: number) => {
    if (pct >= 80) return 'text-green-400';
    if (pct >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-muted rounded-lg w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-card border rounded-xl shadow-sm"></div>
              ))}
            </div>
            <div className="h-64 bg-card border rounded-xl shadow-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-destructive/50 bg-destructive/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Error Loading Coverage Data
              </CardTitle>
              <CardDescription className="text-destructive/80">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchCoverageData} variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section - Gaming Card Style */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-green-500/5" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl" />
          
          <div className="relative p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
              
              {/* Title and Description */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 border-4 border-slate-600/50 shadow-lg flex items-center justify-center">
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -right-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-2 py-1 text-xs font-medium">
                      <Activity className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-white">Coverage Dashboard</h1>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Code2 className="w-3 h-3 mr-1" />
                      Runtime Analysis
                    </Badge>
                  </div>
                  <p className="text-slate-400 font-medium">Real-time code coverage monitoring across all packages</p>
                </div>
              </div>

              {/* Key Stats Bar */}
              <div className="flex-1 lg:ml-auto">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="text-2xl font-bold text-green-400">{data.packagesWithData}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Active</div>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="text-2xl font-bold text-blue-400">{data.totalPackages}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Total</div>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="text-2xl font-bold text-purple-400">{formatPercentage(data.overallSummary.statements.pct)}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Coverage</div>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="text-2xl font-bold text-yellow-400 uppercase">LIVE</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Status</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Statements</CardTitle>
              <FileText className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getCoverageColor(data.overallSummary.statements.pct)}`}>
                {formatPercentage(data.overallSummary.statements.pct)}
              </div>
              <p className="text-xs text-slate-400">
                {data.overallSummary.statements.covered} of {data.overallSummary.statements.total}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Branches</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getCoverageColor(data.overallSummary.branches.pct)}`}>
                {formatPercentage(data.overallSummary.branches.pct)}
              </div>
              <p className="text-xs text-slate-400">
                {data.overallSummary.branches.covered} of {data.overallSummary.branches.total}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Functions</CardTitle>
              <Code2 className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getCoverageColor(data.overallSummary.functions.pct)}`}>
                {formatPercentage(data.overallSummary.functions.pct)}
              </div>
              <p className="text-xs text-slate-400">
                {data.overallSummary.functions.covered} of {data.overallSummary.functions.total}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Lines</CardTitle>
              <FileText className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getCoverageColor(data.overallSummary.lines.pct)}`}>
                {formatPercentage(data.overallSummary.lines.pct)}
              </div>
              <p className="text-xs text-slate-400">
                {data.overallSummary.lines.covered} of {data.overallSummary.lines.total}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Package Status */}
        <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-400" />
              Package Status
            </CardTitle>
            <CardDescription className="text-slate-400">
              {data.packagesWithData} of {data.totalPackages} packages have coverage data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.packages.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2 text-slate-200">No Coverage Packages Found</p>
                  <p className="text-sm">Coverage data will appear here when packages are instrumented and exercised.</p>
                </div>
              ) : (
                data.packages.map((pkg) => (
                  <PackageCard key={pkg.name} package={pkg} />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/30">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Last updated: {new Date(data.lastUpdated).toLocaleString()}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchCoverageData}
            className="border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-slate-200"
          >
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

function PackageCard({ package: pkg }: { package: CoveragePackage }) {
  const [summary, setSummary] = useState<CoverageSummary | null>(null);

  useEffect(() => {
    if (pkg.hasData) {
      fetch(`/api/coverage/${encodeURIComponent(pkg.name)}`)
        .then(res => res.json())
        .then(data => setSummary(data.summary))
        .catch(console.error);
    }
  }, [pkg.name, pkg.hasData]);

  const formatPercentage = (pct: number) => `${pct.toFixed(1)}%`;
  
  const getCoverageBadge = (pct: number) => {
    if (pct >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (pct >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0"></div>
        <div>
          <h3 className="font-medium text-slate-200">{pkg.name}</h3>
          <p className="text-sm text-slate-400">
            {pkg.hasData ? (
              <>
                Last updated: {pkg.lastUpdated ? new Date(pkg.lastUpdated).toLocaleString() : 'Unknown'}
              </>
            ) : (
              'No coverage data'
            )}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {pkg.hasData && summary && (
          <div className="grid grid-cols-4 gap-2 text-xs">
            <Badge variant="outline" className={getCoverageBadge(summary.statements.pct)}>
              S: {formatPercentage(summary.statements.pct)}
            </Badge>
            <Badge variant="outline" className={getCoverageBadge(summary.branches.pct)}>
              B: {formatPercentage(summary.branches.pct)}
            </Badge>
            <Badge variant="outline" className={getCoverageBadge(summary.functions.pct)}>
              F: {formatPercentage(summary.functions.pct)}
            </Badge>
            <Badge variant="outline" className={getCoverageBadge(summary.lines.pct)}>
              L: {formatPercentage(summary.lines.pct)}
            </Badge>
          </div>
        )}
        
        <div className="flex gap-2">
          <Link href={`/${pkg.name}`}>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-slate-200">
              View Details
            </Button>
          </Link>
          {pkg.hasData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/coverage/files/${pkg.name}/index.html`, '_blank')}
              className="border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-slate-200"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}