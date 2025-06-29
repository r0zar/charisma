import { listVaults } from '@/lib/pool-service';

/**
 * LP token dependency information
 */
export interface LpDependency {
    contractId: string;
    symbol: string;
    level: number;
    tokenA: {
        contractId: string;
        symbol: string;
        isLpToken: boolean;
    };
    tokenB: {
        contractId: string;
        symbol: string;
        isLpToken: boolean;
    };
    dependencies: string[]; // Contract IDs of LP tokens this depends on
}

/**
 * LP dependency graph for ordered processing
 */
export class LpDependencyGraph {
    private dependencies = new Map<string, LpDependency>();
    private levels = new Map<number, string[]>(); // level -> array of contract IDs
    private lpTokenContracts = new Set<string>();

    /**
     * Build the dependency graph from vault data
     */
    async buildGraph(): Promise<void> {
        const allVaults = await listVaults();
        console.log(`[LpDependencyGraph] Analyzing ${allVaults.length} pool vaults`);

        // First pass: identify all LP token contracts
        this.lpTokenContracts = new Set(allVaults.map(vault => vault.contractId));
        console.log(`[LpDependencyGraph] Identified ${this.lpTokenContracts.size} LP token contracts`);

        // Second pass: analyze dependencies
        for (const vault of allVaults) {
            if (vault.tokenA && vault.tokenB) {
                const tokenAIsLp = this.lpTokenContracts.has(vault.tokenA.contractId);
                const tokenBIsLp = this.lpTokenContracts.has(vault.tokenB.contractId);
                
                const dependencies: string[] = [];
                if (tokenAIsLp) dependencies.push(vault.tokenA.contractId);
                if (tokenBIsLp) dependencies.push(vault.tokenB.contractId);

                this.dependencies.set(vault.contractId, {
                    contractId: vault.contractId,
                    symbol: vault.symbol,
                    level: 0, // Will calculate later
                    tokenA: {
                        contractId: vault.tokenA.contractId,
                        symbol: vault.tokenA.symbol,
                        isLpToken: tokenAIsLp
                    },
                    tokenB: {
                        contractId: vault.tokenB.contractId,
                        symbol: vault.tokenB.symbol,
                        isLpToken: tokenBIsLp
                    },
                    dependencies
                });
            }
        }

        // Third pass: calculate dependency levels
        this.calculateLevels();
        console.log(`[LpDependencyGraph] Calculated dependency levels for ${this.dependencies.size} LP tokens`);
    }

    /**
     * Calculate dependency levels using topological sorting
     */
    private calculateLevels(): void {
        // Calculate level for each LP token
        const calculateLevel = (contractId: string, visited = new Set<string>()): number => {
            if (visited.has(contractId)) {
                console.warn(`[LpDependencyGraph] Circular dependency detected: ${contractId}`);
                return -1; // Circular dependency
            }

            const dependency = this.dependencies.get(contractId);
            if (!dependency) {
                return 0; // Not an LP token
            }

            visited.add(contractId);

            let maxLevel = 0;
            for (const depId of dependency.dependencies) {
                const depLevel = calculateLevel(depId, visited);
                if (depLevel >= 0) {
                    maxLevel = Math.max(maxLevel, depLevel + 1);
                }
            }

            visited.delete(contractId);
            return maxLevel;
        };

        // Update levels and group by level
        this.levels.clear();
        this.dependencies.forEach((dependency, contractId) => {
            dependency.level = calculateLevel(contractId);
            
            if (!this.levels.has(dependency.level)) {
                this.levels.set(dependency.level, []);
            }
            this.levels.get(dependency.level)!.push(contractId);
        });

        // Sort levels
        const sortedLevels = Array.from(this.levels.keys()).sort((a, b) => a - b);
        console.log(`[LpDependencyGraph] Found ${sortedLevels.length} dependency levels: [${sortedLevels.join(', ')}]`);
        
        sortedLevels.forEach(level => {
            const tokens = this.levels.get(level)!;
            console.log(`[LpDependencyGraph] Level ${level}: ${tokens.length} tokens`);
        });
    }

    /**
     * Get LP tokens in processing order (level 0 first, then level 1, etc.)
     */
    getProcessingOrder(): string[] {
        const order: string[] = [];
        const sortedLevels = Array.from(this.levels.keys()).sort((a, b) => a - b);
        
        for (const level of sortedLevels) {
            const tokensAtLevel = this.levels.get(level) || [];
            order.push(...tokensAtLevel);
        }
        
        return order;
    }

    /**
     * Get LP tokens at a specific dependency level
     */
    getTokensAtLevel(level: number): string[] {
        return this.levels.get(level) || [];
    }

    /**
     * Get dependency info for a specific LP token
     */
    getDependency(contractId: string): LpDependency | undefined {
        return this.dependencies.get(contractId);
    }

    /**
     * Check if a contract ID is an LP token
     */
    isLpToken(contractId: string): boolean {
        return this.lpTokenContracts.has(contractId);
    }

    /**
     * Get all dependency levels
     */
    getLevels(): number[] {
        return Array.from(this.levels.keys()).sort((a, b) => a - b);
    }

    /**
     * Get stats about the dependency graph
     */
    getStats(): {
        totalLpTokens: number;
        levelCount: number;
        levelDistribution: Record<number, number>;
        circularDependencies: string[];
    } {
        const levelDistribution: Record<number, number> = {};
        this.levels.forEach((tokens, level) => {
            levelDistribution[level] = tokens.length;
        });

        // Find circular dependencies (level -1)
        const circularDependencies: string[] = [];
        this.dependencies.forEach((dep, contractId) => {
            if (dep.level === -1) {
                circularDependencies.push(contractId);
            }
        });

        return {
            totalLpTokens: this.dependencies.size,
            levelCount: this.levels.size,
            levelDistribution,
            circularDependencies
        };
    }
}

// Singleton instance for reuse
let dependencyGraphInstance: LpDependencyGraph | null = null;

/**
 * Get the LP dependency graph instance (builds it if needed)
 */
export const getLpDependencyGraph = async (): Promise<LpDependencyGraph> => {
    if (!dependencyGraphInstance) {
        dependencyGraphInstance = new LpDependencyGraph();
        await dependencyGraphInstance.buildGraph();
    }
    return dependencyGraphInstance;
};

/**
 * Reset the dependency graph (for testing or when vault data changes)
 */
export const resetLpDependencyGraph = (): void => {
    dependencyGraphInstance = null;
};