// Edit per integration. All scripts import from here.
export const WRAPPER_NAME = 'feeling-zesty';
export const DEPLOYER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
export const EXTERNAL_POOL = 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-zest-stx-v-2-bps-50'; // holds + sends tokens
// Opcode order: 0x00 = A -> B. Asset ids are '<contract>::<ft-name>' or 'STX'.
export const TOKEN_A = { contractId: 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.zest-token', asset: 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.zest-token::zest' };
export const TOKEN_B = { contractId: '.stx', asset: 'STX' };
export const WHALE = 'SP10CZ6NYSCNVMP9AAGQ2QBACX6Q6RYAP744RAVAP'; // real SP holder of both tokens, for fork tests
export const KEY_FILE = '/home/rozar/Documents/charisma/charisma/apps/simple-swap/.env.local'; // PRIVATE_KEY for DEPLOYER
export const CONTRACT_FILE = `/home/rozar/Documents/charisma/charisma/packages/clarity/contracts/vaults/${WRAPPER_NAME}.clar`;
export const readKey = async () => (await import('fs')).readFileSync(KEY_FILE, 'utf8').match(/^PRIVATE_KEY=["']?([0-9a-fA-F]{64,66})/m)[1];
