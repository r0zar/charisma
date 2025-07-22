import { TreeNode } from './types';

function getSimpleTokenName(contractId: string): string {
  const parts = contractId.split('.');
  if (parts.length === 2) {
    const tokenName = parts[1];
    if (tokenName.includes('-token')) {
      return tokenName.replace('-token', '').toUpperCase();
    } else if (tokenName.includes('coin')) {
      return tokenName.replace('coin', '').toUpperCase();
    } else if (tokenName === 'arkadiko-token') {
      return 'DIKO';
    } else if (tokenName === 'alex-token') {
      return 'ALEX';
    } else if (tokenName === 'charisma-token') {
      return 'CHA';
    } else if (tokenName === 'welshcorgicoin-token') {
      return 'WELSH';
    } else if (tokenName === 'sbtc-token') {
      return 'SBTC';
    }
    return tokenName.toUpperCase().slice(0, 10);
  }
  return contractId.slice(0, 10);
}

function buildSectionTree(sectionData: any, sectionName: string, rootData: any): { [key: string]: TreeNode } {
  const children: { [key: string]: TreeNode } = {};
  
  if (sectionData && typeof sectionData === 'object') {
    Object.entries(sectionData).forEach(([key, value]) => {
      // Skip metadata fields
      if (['lastUpdated', 'source', 'addressCount', 'contractCount', 'tokenCount', 'seriesCount'].includes(key)) {
        return;
      }
      
      if (sectionName === 'addresses' && key.match(/^S[PTM]/)) {
        children[`${key}.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(rootData.lastUpdated),
          path: `addresses/${key}`
        };
      } else if (sectionName === 'contracts' && key.includes('.')) {
        const contractName = key.split('.')[1] || key;
        children[`${contractName}.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(rootData.lastUpdated),
          path: `contracts/${key}`
        };
      } else if (sectionName === 'prices' && key.includes('.') && value && typeof value === 'object') {
        const simpleName = getSimpleTokenName(key);
        children[`${simpleName}.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(sectionData.lastUpdated || rootData.lastUpdated),
          path: `prices/${key}`
        };
      } else if (sectionName === 'price-series' && key.includes('.') && value && typeof value === 'object') {
        const simpleName = getSimpleTokenName(key);
        children[`${simpleName}-series.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(sectionData.lastUpdated || rootData.lastUpdated),
          path: `price-series/${key}`
        };
      } else if (sectionName === 'balances') {
        children[`${key}.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(sectionData.lastUpdated || rootData.lastUpdated),
          path: `balances/${key}`
        };
      } else if (sectionName === 'balance-series') {
        children[`${key}.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(sectionData.lastUpdated || rootData.lastUpdated),
          path: `balance-series/${key}`
        };
      } else if (sectionName === 'discovered') {
        children[`${key}.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(sectionData.lastUpdated || rootData.lastUpdated),
          path: `discovered/${key}`
        };
      }
    });
  }
  
  return children;
}

export async function buildTreeFromV1Data(rootData: any): Promise<{ [key: string]: TreeNode }> {
  const tree: { [key: string]: TreeNode } = {};
  
  // Add the v1 metadata file directly at the top level
  tree['v1'] = {
    type: 'file',
    size: JSON.stringify(rootData).length,
    lastModified: new Date(rootData.lastUpdated || Date.now()),
    path: ''
  };
  
  // Build section trees
  const sections = ['addresses', 'contracts', 'prices', 'price-series', 'balances', 'balance-series', 'discovered'];
  
  sections.forEach(section => {
    const sectionKey = section === 'price-series' ? 'price-series' : 
                       section === 'balance-series' ? 'balance-series' : section;
    const sectionData = rootData[sectionKey];
    
    tree[section] = {
      type: 'directory',
      children: buildSectionTree(sectionData, section, rootData)
    };
  });

  // Add metadata as a direct file item
  tree.metadata = {
    type: 'file',
    size: JSON.stringify(rootData.metadata || {}).length,
    lastModified: new Date(rootData.lastUpdated),
    path: 'metadata'
  };
  
  return tree;
}