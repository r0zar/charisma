// Discover token relationships by analyzing contract source code and vault configurations
import { analyzeContract } from '../src/lib/contract-analysis';
import { getAllVaultData } from '../src/lib/pool-service';

interface TokenRelationship {
    sourceContract: string;
    targetContract: string;
    relationshipType: 'vault-engine' | 'vault-base-token' | 'engine-token' | 'trait-implementation' | 'cross-reference';
    confidence: 'high' | 'medium' | 'low';
    evidenceType: 'source-code' | 'vault-config';
    evidence: string[];
    metadata?: {
        vaultName?: string;
        engineType?: string;
        baseToken?: string;
    };
}

interface RelationshipGraph {
    nodes: Array<{
        contractId: string;
        type: 'vault' | 'engine' | 'token' | 'trait' | 'unknown';
        name?: string;
        isEnergyRelated: boolean;
    }>;
    edges: TokenRelationship[];
    clusters: Array<{
        type: 'energy-system' | 'token-ecosystem' | 'trait-network';
        contracts: string[];
        description: string;
    }>;
}

async function discoverTokenRelationships() {
    console.log('🔍 Discovering Token Relationships in Energy System');
    console.log('');

    try {
        // Step 1: Get all vault configurations
        console.log('📊 Fetching vault configurations...');
        const allVaults = await getAllVaultData();
        const energyVaults = allVaults.filter(vault => vault.type === 'ENERGY');
        
        console.log(`  Found ${allVaults.length} total vaults, ${energyVaults.length} energy vaults`);
        
        // Step 2: Analyze energy vault contracts and their relationships
        console.log('');
        console.log('🔬 Analyzing energy vault contracts...');
        
        const relationships: TokenRelationship[] = [];
        const contractNodes = new Set<string>();
        
        for (const vault of energyVaults) {
            console.log(`  📋 Analyzing vault: ${vault.name} (${vault.contractId})`);
            
            // Add vault to nodes
            contractNodes.add(vault.contractId);
            
            // Analyze vault contract source code
            const vaultAnalysis = await analyzeContract(vault.contractId);
            if (vaultAnalysis) {
                console.log(`    ✅ Contract analysis successful`);
                console.log(`    🔗 Found ${vaultAnalysis.relationships.length} source code relationships`);
                
                // Process each relationship from source code
                for (const rel of vaultAnalysis.relationships) {
                    contractNodes.add(rel.targetContract);
                    
                    let relationshipType: TokenRelationship['relationshipType'];
                    let confidence: TokenRelationship['confidence'] = 'medium';
                    
                    // Determine relationship type based on patterns
                    if (rel.relationshipType === 'contract-call' && rel.targetContract.includes('hold-to-earn')) {
                        relationshipType = 'vault-engine';
                        confidence = 'high';
                    } else if (rel.relationshipType === 'trait-impl') {
                        relationshipType = 'trait-implementation';
                        confidence = 'high';
                    } else if (rel.relationshipType === 'direct-reference') {
                        relationshipType = 'cross-reference';
                        confidence = 'low';
                    } else {
                        relationshipType = 'cross-reference';
                    }
                    
                    relationships.push({
                        sourceContract: vault.contractId,
                        targetContract: rel.targetContract,
                        relationshipType,
                        confidence,
                        evidenceType: 'source-code',
                        evidence: [rel.extractedFrom],
                        metadata: {
                            vaultName: vault.name,
                            engineType: rel.targetContract.includes('hold-to-earn') ? 'hold-to-earn' : undefined
                        }
                    });
                    
                    console.log(`      - ${relationshipType}: ${rel.targetContract} (${confidence})`);
                }
            } else {
                console.log(`    ❌ Failed to analyze contract`);
            }
            
            // Add vault configuration relationships
            if (vault.engineContractId) {
                contractNodes.add(vault.engineContractId);
                
                relationships.push({
                    sourceContract: vault.contractId,
                    targetContract: vault.engineContractId,
                    relationshipType: 'vault-engine',
                    confidence: 'high',
                    evidenceType: 'vault-config',
                    evidence: [`Vault configuration: engine = ${vault.engineContractId}`],
                    metadata: {
                        vaultName: vault.name,
                        engineType: 'configured-engine'
                    }
                });
                
                console.log(`    📝 Config relationship: engine = ${vault.engineContractId}`);
            }
            
            if (vault.base) {
                contractNodes.add(vault.base);
                
                relationships.push({
                    sourceContract: vault.contractId,
                    targetContract: vault.base,
                    relationshipType: 'vault-base-token',
                    confidence: 'high',
                    evidenceType: 'vault-config',
                    evidence: [`Vault configuration: base = ${vault.base}`],
                    metadata: {
                        vaultName: vault.name,
                        baseToken: vault.base
                    }
                });
                
                console.log(`    📝 Config relationship: base = ${vault.base}`);
            }
        }
        
        // Step 3: Analyze discovered engine contracts
        console.log('');
        console.log('🎯 Analyzing discovered engine contracts...');
        
        const engineContracts = relationships
            .filter(rel => rel.relationshipType === 'vault-engine')
            .map(rel => rel.targetContract);
        
        const uniqueEngines = [...new Set(engineContracts)];
        
        for (const engineContract of uniqueEngines) {
            console.log(`  📋 Analyzing engine: ${engineContract}`);
            
            const engineAnalysis = await analyzeContract(engineContract);
            if (engineAnalysis) {
                console.log(`    ✅ Engine analysis successful`);
                console.log(`    🔗 Found ${engineAnalysis.relationships.length} relationships`);
                
                // Process top engine relationships to avoid spam
                const topRelationships = engineAnalysis.relationships.slice(0, 3);
                for (const rel of topRelationships) {
                    contractNodes.add(rel.targetContract);
                    
                    let relationshipType: TokenRelationship['relationshipType'] = 'cross-reference';
                    if (rel.targetContract.includes('token') || rel.targetContract.includes('pool')) {
                        relationshipType = 'engine-token';
                    }
                    
                    relationships.push({
                        sourceContract: engineContract,
                        targetContract: rel.targetContract,
                        relationshipType,
                        confidence: 'medium',
                        evidenceType: 'source-code',
                        evidence: [rel.extractedFrom],
                        metadata: {
                            engineType: 'hold-to-earn'
                        }
                    });
                    
                    console.log(`      - ${relationshipType}: ${rel.targetContract}`);
                }
                
                if (engineAnalysis.relationships.length > 3) {
                    console.log(`      ... and ${engineAnalysis.relationships.length - 3} more relationships`);
                }
            }
        }
        
        // Step 4: Build relationship graph
        console.log('');
        console.log('🏗️ Building relationship graph...');
        
        const graph: RelationshipGraph = {
            nodes: [],
            edges: relationships,
            clusters: []
        };
        
        // Create nodes
        for (const contractId of contractNodes) {
            const isEnergyVault = energyVaults.some(v => v.contractId === contractId);
            const isEngine = relationships.some(r => r.relationshipType === 'vault-engine' && r.targetContract === contractId);
            const isTrait = contractId.includes('trait');
            const isToken = contractId.includes('token') || contractId.includes('pool');
            
            let type: 'vault' | 'engine' | 'token' | 'trait' | 'unknown' = 'unknown';
            if (isEnergyVault) type = 'vault';
            else if (isEngine) type = 'engine';
            else if (isTrait) type = 'trait';
            else if (isToken) type = 'token';
            
            const vaultInfo = energyVaults.find(v => v.contractId === contractId);
            
            graph.nodes.push({
                contractId,
                type,
                name: vaultInfo?.name,
                isEnergyRelated: isEnergyVault || isEngine || 
                    relationships.some(r => 
                        (r.sourceContract === contractId || r.targetContract === contractId) && 
                        ['vault-engine', 'vault-base-token', 'engine-token'].includes(r.relationshipType)
                    )
            });
        }
        
        // Create clusters
        const energySystemContracts = graph.nodes
            .filter(node => node.isEnergyRelated)
            .map(node => node.contractId);
        
        if (energySystemContracts.length > 0) {
            graph.clusters.push({
                type: 'energy-system',
                contracts: energySystemContracts,
                description: `Energy system cluster with ${energySystemContracts.length} contracts`
            });
        }
        
        // Generate comprehensive report
        generateRelationshipReport(graph);
        
    } catch (error) {
        console.error('❌ Error during token relationship discovery:', error);
        process.exit(1);
    }
}

function generateRelationshipReport(graph: RelationshipGraph) {
    console.log('📊 TOKEN RELATIONSHIP DISCOVERY REPORT');
    console.log(''.padEnd(60, '='));
    console.log('');
    
    // Graph statistics
    const totalNodes = graph.nodes.length;
    const totalEdges = graph.edges.length;
    const energyNodes = graph.nodes.filter(n => n.isEnergyRelated).length;
    
    console.log('📈 Graph Statistics:');
    console.log(`  Total contracts discovered: ${totalNodes}`);
    console.log(`  Total relationships found: ${totalEdges}`);
    console.log(`  Energy-related contracts: ${energyNodes}`);
    console.log(`  Network clusters: ${graph.clusters.length}`);
    console.log('');
    
    // Node analysis
    console.log('🗂️ Contract Types:');
    const nodeTypes = graph.nodes.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    Object.entries(nodeTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
    console.log('');
    
    // Relationship analysis
    console.log('🔗 Relationship Types:');
    const relationshipTypes = graph.edges.reduce((acc, edge) => {
        acc[edge.relationshipType] = (acc[edge.relationshipType] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    Object.entries(relationshipTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
    console.log('');
    
    // High-confidence relationships
    console.log('⭐ High-Confidence Relationships:');
    const highConfidenceRels = graph.edges.filter(edge => edge.confidence === 'high');
    highConfidenceRels.forEach(rel => {
        console.log(`  ${rel.relationshipType}: ${rel.sourceContract} → ${rel.targetContract}`);
        if (rel.metadata?.vaultName) {
            console.log(`    Vault: ${rel.metadata.vaultName}`);
        }
        console.log(`    Evidence: ${rel.evidence[0]}`);
        console.log('');
    });
    
    // Energy system architecture
    console.log('⚡ Energy System Architecture:');
    const vaultNodes = graph.nodes.filter(n => n.type === 'vault');
    const engineNodes = graph.nodes.filter(n => n.type === 'engine');
    const tokenNodes = graph.nodes.filter(n => n.type === 'token');
    
    console.log(`  Vaults (${vaultNodes.length}):`);
    vaultNodes.forEach(vault => {
        console.log(`    - ${vault.contractId}${vault.name ? ` (${vault.name})` : ''}`);
        
        const vaultRels = graph.edges.filter(e => e.sourceContract === vault.contractId);
        vaultRels.forEach(rel => {
            console.log(`      → ${rel.relationshipType}: ${rel.targetContract}`);
        });
    });
    
    console.log(`  Engines (${engineNodes.length}):`);
    engineNodes.forEach(engine => {
        console.log(`    - ${engine.contractId}`);
        
        const engineUsers = graph.edges.filter(e => 
            e.targetContract === engine.contractId && e.relationshipType === 'vault-engine'
        );
        engineUsers.forEach(rel => {
            const vaultNode = graph.nodes.find(n => n.contractId === rel.sourceContract);
            console.log(`      ← Used by: ${rel.sourceContract}${vaultNode?.name ? ` (${vaultNode.name})` : ''}`);
        });
    });
    
    if (tokenNodes.length > 0) {
        console.log(`  Tokens (${tokenNodes.length}):`);
        tokenNodes.forEach(token => {
            console.log(`    - ${token.contractId}`);
        });
    }
    
    console.log('');
    console.log('✨ Token relationship discovery complete!');
}

// Run the discovery
discoverTokenRelationships().catch(console.error);