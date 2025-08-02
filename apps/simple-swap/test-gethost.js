// Test getHostUrl to see what it returns
import { getHostUrl } from '../../modules/discovery/src/index.js';

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('getHostUrl("swap"):', getHostUrl('swap'));
console.log('typeof window:', typeof window);