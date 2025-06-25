// Check bonus limits from energetic-welsh contract
import { callReadOnly } from '@repo/polyglot';

async function checkBonusLimits() {
    console.log('🔍 Checking Energy Bonus Limits');
    console.log('='.repeat(50));

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-welsh';
    
    try {
        console.log('📋 Calling get-bonus-limits...');
        const limits = await callReadOnly(contractId, 'get-bonus-limits', []);
        
        console.log('✅ Bonus limits result:');
        console.log(JSON.stringify(limits, null, 2));
        
        console.log('\n📋 Calling individual bonus getters...');
        
        // Get individual bonus values
        const happyWelshBonus = await callReadOnly(contractId, 'get-happy-welsh-bonus', []);
        console.log('Happy Welsh bonus:', happyWelshBonus);
        
        const weirdWelshBonus = await callReadOnly(contractId, 'get-weird-welsh-bonus', []);
        console.log('Weird Welsh bonus:', weirdWelshBonus);
        
        const welshPunkBonus = await callReadOnly(contractId, 'get-welsh-punk-bonus', []);
        console.log('Welsh Punk bonus:', welshPunkBonus);
        
    } catch (error) {
        console.error('❌ Error checking bonus limits:', error);
    }
}

// Run the check
checkBonusLimits().catch(console.error);