import { getContractInterface } from '@repo/polyglot';

const contractId = process.argv[2] || 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-ormm';
const [contractAddress, contractName] = contractId.split('.');

async function testContractInterface() {
    try {
        console.log(`Testing contract interface for ${contractId}...`);
        const contractInterface = await getContractInterface(contractAddress, contractName);
        
        console.log('Contract interface keys:', Object.keys(contractInterface || {}));
        
        if (contractInterface && contractInterface.fungible_tokens) {
            console.log('Fungible tokens:', JSON.stringify(contractInterface.fungible_tokens, null, 2));
        } else {
            console.log('No fungible_tokens found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testContractInterface();