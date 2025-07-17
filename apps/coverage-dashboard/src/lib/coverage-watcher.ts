import { watch } from 'chokidar';
import { existsSync, readFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export interface CoveragePackage {
  name: string;
  path: string;
  jsonPath: string;
  htmlPath: string;
  hasData: boolean;
  lastUpdated?: Date;
}

export interface CoverageSummary {
  statements: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  lines: { total: number; covered: number; pct: number };
}

export class CoverageWatcher {
  private watchers: Map<string, any> = new Map();
  private packages: Map<string, CoveragePackage> = new Map();
  private listeners: ((packages: CoveragePackage[]) => void)[] = [];
  private rootDir: string;
  private coverageDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.coverageDir = path.join(rootDir, 'coverage');
    this.initializePackages();
  }

  private initializePackages() {
    // Discover existing coverage packages
    this.discoverPackages();
    
    // Watch for new packages
    this.watchForNewPackages();
  }

  private discoverPackages() {
    const servicesDir = path.join(this.coverageDir, 'services');
    
    if (existsSync(servicesDir)) {
      const serviceDirs = readdirSync(servicesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const serviceName of serviceDirs) {
        const servicePath = path.join(servicesDir, serviceName);
        this.addPackage(`services/${serviceName}`, servicePath);
      }
    }
  }

  private addPackage(packageName: string, packagePath: string) {
    const jsonPath = path.join(packagePath, 'coverage-final.json');
    const htmlPath = path.join(packagePath, 'index.html');
    
    const pkg: CoveragePackage = {
      name: packageName,
      path: packagePath,
      jsonPath,
      htmlPath,
      hasData: existsSync(jsonPath),
      lastUpdated: existsSync(jsonPath) ? this.getFileModTime(jsonPath) : undefined
    };

    this.packages.set(packageName, pkg);
    this.watchPackage(pkg);
    this.notifyListeners();
  }

  private watchPackage(pkg: CoveragePackage) {
    if (this.watchers.has(pkg.name)) {
      this.watchers.get(pkg.name).close();
    }

    // Ensure the directory exists
    if (!existsSync(pkg.path)) {
      mkdirSync(pkg.path, { recursive: true });
    }

    const watcher = watch(pkg.path, {
      ignored: /node_modules/,
      persistent: true
    });

    watcher.on('change', (filePath) => {
      if (filePath.endsWith('coverage-final.json')) {
        console.log(`📊 Coverage data updated for ${pkg.name}`);
        pkg.hasData = true;
        pkg.lastUpdated = new Date();
        this.generateHtmlReport(pkg);
        this.notifyListeners();
      }
    });

    watcher.on('add', (filePath) => {
      if (filePath.endsWith('coverage-final.json')) {
        console.log(`📊 New coverage data detected for ${pkg.name}`);
        pkg.hasData = true;
        pkg.lastUpdated = new Date();
        this.generateHtmlReport(pkg);
        this.notifyListeners();
      }
    });

    this.watchers.set(pkg.name, watcher);
  }

  private watchForNewPackages() {
    const servicesWatcher = watch(path.join(this.coverageDir, 'services'), {
      ignored: /node_modules/,
      persistent: true,
      depth: 1
    });

    servicesWatcher.on('addDir', (dirPath) => {
      const packageName = `services/${path.basename(dirPath)}`;
      if (!this.packages.has(packageName)) {
        console.log(`🔍 New coverage package discovered: ${packageName}`);
        this.addPackage(packageName, dirPath);
      }
    });
  }

  private generateHtmlReport(pkg: CoveragePackage) {
    if (!existsSync(pkg.jsonPath)) return;

    console.log(`🔄 Generating HTML report for ${pkg.name}...`);
    
    // Find the source package directory to run c8 from
    const sourcePackagePath = this.findSourcePackagePath(pkg.name);
    
    if (!sourcePackagePath) {
      console.warn(`⚠️ Could not find source package for ${pkg.name}`);
      return;
    }

    const c8Process = spawn('npx', ['c8', 'report', '--reporter=html', '--reports-dir=' + pkg.path], {
      cwd: sourcePackagePath,
      stdio: 'inherit'
    });

    c8Process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ HTML report generated for ${pkg.name}`);
        pkg.hasData = existsSync(pkg.htmlPath);
        this.notifyListeners();
      } else {
        console.log(`❌ Failed to generate HTML report for ${pkg.name}`);
      }
    });
  }

  private findSourcePackagePath(packageName: string): string | null {
    // Map coverage package names to source package paths
    const pathMappings: Record<string, string> = {
      'services/prices': path.join(this.rootDir, 'services', 'prices'),
      // Add more mappings as needed
    };

    return pathMappings[packageName] || null;
  }

  private getFileModTime(filePath: string): Date {
    try {
      const stats = statSync(filePath);
      return stats.mtime;
    } catch {
      return new Date();
    }
  }

  public getPackages(): CoveragePackage[] {
    return Array.from(this.packages.values());
  }

  public getPackage(name: string): CoveragePackage | undefined {
    return this.packages.get(name);
  }

  public getCoverageSummary(packageName: string): CoverageSummary | null {
    const pkg = this.packages.get(packageName);
    if (!pkg || !existsSync(pkg.jsonPath)) return null;

    try {
      const coverageData = JSON.parse(readFileSync(pkg.jsonPath, 'utf8'));
      
      // Extract summary from c8/istanbuljs coverage format
      let totalStatements = 0, coveredStatements = 0;
      let totalBranches = 0, coveredBranches = 0;
      let totalFunctions = 0, coveredFunctions = 0;
      let totalLines = 0, coveredLines = 0;

      Object.values(coverageData).forEach((file: any) => {
        if (file.s) {
          totalStatements += Object.keys(file.s).length;
          coveredStatements += Object.values(file.s).filter((hits: any) => hits > 0).length;
        }
        if (file.b) {
          Object.values(file.b).forEach((branches: any) => {
            if (Array.isArray(branches)) {
              totalBranches += branches.length;
              coveredBranches += branches.filter((hits: any) => hits > 0).length;
            }
          });
        }
        if (file.f) {
          totalFunctions += Object.keys(file.f).length;
          coveredFunctions += Object.values(file.f).filter((hits: any) => hits > 0).length;
        }
        if (file.statementMap) {
          totalLines += Object.keys(file.statementMap).length;
          if (file.s) {
            coveredLines += Object.values(file.s).filter((hits: any) => hits > 0).length;
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
    } catch (error) {
      console.error(`Error reading coverage data for ${packageName}:`, error);
      return null;
    }
  }

  public onPackageUpdate(listener: (packages: CoveragePackage[]) => void) {
    this.listeners.push(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getPackages()));
  }

  public destroy() {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
  }
}