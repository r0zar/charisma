import { CoverageWatcher, CoveragePackage, CoverageSummary } from './coverage-watcher';

export interface AggregatedCoverage {
  packages: CoveragePackage[];
  totalPackages: number;
  packagesWithData: number;
  overallSummary: CoverageSummary;
  lastUpdated: Date;
}

export class CoverageAggregator {
  private watcher: CoverageWatcher;
  private updateListeners: ((data: AggregatedCoverage) => void)[] = [];

  constructor(rootDir?: string) {
    this.watcher = new CoverageWatcher(rootDir);
    this.watcher.onPackageUpdate(() => {
      this.notifyUpdateListeners();
    });
  }

  public getAggregatedData(): AggregatedCoverage {
    const packages = this.watcher.getPackages();
    const packagesWithData = packages.filter(pkg => pkg.hasData);
    
    return {
      packages,
      totalPackages: packages.length,
      packagesWithData: packagesWithData.length,
      overallSummary: this.calculateOverallSummary(packages),
      lastUpdated: this.getLastUpdateTime(packages)
    };
  }

  private calculateOverallSummary(packages: CoveragePackage[]): CoverageSummary {
    let totalStatements = 0, coveredStatements = 0;
    let totalBranches = 0, coveredBranches = 0;
    let totalFunctions = 0, coveredFunctions = 0;
    let totalLines = 0, coveredLines = 0;

    packages.forEach(pkg => {
      if (pkg.hasData) {
        const summary = this.watcher.getCoverageSummary(pkg.name);
        if (summary) {
          totalStatements += summary.statements.total;
          coveredStatements += summary.statements.covered;
          totalBranches += summary.branches.total;
          coveredBranches += summary.branches.covered;
          totalFunctions += summary.functions.total;
          coveredFunctions += summary.functions.covered;
          totalLines += summary.lines.total;
          coveredLines += summary.lines.covered;
        }
      }
    });

    return {
      statements: {
        total: totalStatements,
        covered: coveredStatements,
        pct: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0
      },
      branches: {
        total: totalBranches,
        covered: coveredBranches,
        pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0
      },
      functions: {
        total: totalFunctions,
        covered: coveredFunctions,
        pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0
      },
      lines: {
        total: totalLines,
        covered: coveredLines,
        pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
      }
    };
  }

  private getLastUpdateTime(packages: CoveragePackage[]): Date {
    const validPackages = packages.filter(pkg => pkg.hasData && pkg.lastUpdated);
    if (validPackages.length === 0) return new Date();
    
    return validPackages.reduce((latest, pkg) => {
      return pkg.lastUpdated && pkg.lastUpdated > latest ? pkg.lastUpdated : latest;
    }, new Date(0));
  }

  public getPackageSummary(packageName: string): CoverageSummary | null {
    return this.watcher.getCoverageSummary(packageName);
  }

  public getPackage(packageName: string): CoveragePackage | undefined {
    return this.watcher.getPackage(packageName);
  }

  public onUpdate(listener: (data: AggregatedCoverage) => void) {
    this.updateListeners.push(listener);
  }

  private notifyUpdateListeners() {
    const data = this.getAggregatedData();
    this.updateListeners.forEach(listener => listener(data));
  }

  public destroy() {
    this.watcher.destroy();
  }
}

// Singleton instance for use across the app
let aggregator: CoverageAggregator | null = null;

export function getCoverageAggregator(): CoverageAggregator {
  if (!aggregator) {
    // Resolve to the monorepo root
    const rootDir = process.cwd().includes('apps/coverage-dashboard') 
      ? process.cwd().replace('/apps/coverage-dashboard', '')
      : process.cwd();
    
    aggregator = new CoverageAggregator(rootDir);
  }
  return aggregator;
}