import { type AppState } from '@/schemas/app-state.schema';

/**
 * Generated application state data
 * Created with proper TypeScript types for compile-time safety
 */
export const appState: AppState = {
  "metadata": {
    "environment": "development",
    "loadingConfig": "static",
    "apiBaseUrl": "http://localhost:3420/api/v1",
    "apiTimeout": 30000,
    "cacheEnabled": true,
    "cacheTtl": 300000,
    "debugDataLoading": false,
    "logDataSources": false,
    "featureFlags": {
      "enableApiMetadata": false,
      "enableApiUser": false,
      "enableApiBots": false,
      "enableApiMarket": false,
      "enableApiNotifications": false
    },
    "isServer": false,
    "isClient": false,
    "timestamp": "2025-07-10T22:00:42.898Z"
  },
  "user": {
    "settings": {
      "general": {
        "isDarkMode": true,
        "compactMode": true,
        "autoRefresh": true
      },
      "network": {
        "network": "testnet",
        "rpcEndpoint": "https://stacks-node-api.mainnet.stacks.co"
      },
      "botDefaults": {
        "defaultStrategy": "arbitrage"
      },
      "notifications": {
        "trade": true,
        "error": true,
        "status": false,
        "performance": false,
        "security": true
      },
      "notificationChannel": "disabled",
      "security": {
        "apiKey": "sk-de332782f341a045ce9e6de492c30700b97f4d87",
        "autoLockTimeout": "30",
        "requireConfirmation": false
      },
      "advanced": {
        "debugMode": false,
        "performanceMonitoring": true
      }
    },
    "wallet": {
      "isConnected": true,
      "address": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
      "network": "mainnet",
      "balance": {
        "stx": 1845.0874485596707,
        "tokens": [
          {
            "contractId": "SPY5KIU8W82KOGXMSEHJDN2BLUMP8ODOY2LT5EQ2.lisa",
            "symbol": "LISA",
            "name": "Lisa",
            "balance": 1212,
            "decimals": 6,
            "usdValue": 0.006364462413640974
          },
          {
            "contractId": "SPC93BQ0UWFB6R7ZEVQTRTEBPJWRPYG9W5N5AB4A.stx",
            "symbol": "STX",
            "name": "Stacks",
            "balance": 577,
            "decimals": 6,
            "usdValue": 0.0035812654895060665
          },
          {
            "contractId": "SP0VJWIMPI8TCSPDPR1DDS90ZQ128WG71J0TS3OL.diko",
            "symbol": "DIKO",
            "name": "Diko",
            "balance": 1207,
            "decimals": 6,
            "usdValue": 0.010530404096266977
          },
          {
            "contractId": "SPRBI6WGI9N8SGQVBEZNOHV0TERFNDO190ZUUVJL.stx",
            "symbol": "STX",
            "name": "Stacks",
            "balance": 787,
            "decimals": 6,
            "usdValue": 0.0014345328222343681
          },
          {
            "contractId": "SP9XHLFHJQ1J7M0BLDFE1ZHFF7Y400IB2ZJH03QZ.lisa",
            "symbol": "LISA",
            "name": "Lisa",
            "balance": 1364,
            "decimals": 6,
            "usdValue": 0.005282972653276437
          },
          {
            "contractId": "SPUAEVFPX1LDJJOCW7V4EIMOQTGX45HY6VPXGUVO.alex",
            "symbol": "ALEX",
            "name": "Alex",
            "balance": 691,
            "decimals": 8,
            "usdValue": 0.000052372493387311285
          }
        ]
      },
      "transactions": [
        {
          "txId": "0xe3441d9ba381ae8448815cb7785015dbd6d60d433044ec970616437828970f66",
          "timestamp": "2025-07-10T05:28:42.900Z",
          "type": "send",
          "amount": 191.2028892318244,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.001444945987654321,
          "memo": "Yield farming reward"
        },
        {
          "txId": "0xcc170370423b11f905065fb6b4ea9340d0024f8657d751d97da6ed57abd7f9c6",
          "timestamp": "2025-07-09T21:31:42.900Z",
          "type": "send",
          "amount": 14.835519547325102,
          "token": "LEO",
          "status": "failed",
          "fee": 0.005544405864197531
        },
        {
          "txId": "0xae0a9fa5c0ae3eda8eae9c734a4cd2875ff29c0b36ddb6e5bfb364696af85e1e",
          "timestamp": "2025-07-08T22:23:42.900Z",
          "type": "receive",
          "amount": 187.27794924554183,
          "token": "CHA",
          "status": "pending",
          "fee": 0.008208101851851852
        },
        {
          "txId": "0x3d6285b91260f5a9e4676c6632b13bceecb98f4425aa3ef4860f6d861bd3f1aa",
          "timestamp": "2025-07-08T21:07:42.900Z",
          "type": "contract-call",
          "amount": 125.96124828532236,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.0026184413580246915
        },
        {
          "txId": "0xed6d0a66204622b379986bc80b7eb9c250712148759faa0b40dd78aa141102d6",
          "timestamp": "2025-07-08T13:00:42.899Z",
          "type": "send",
          "amount": 58.22080761316872,
          "token": "LISA",
          "status": "pending",
          "fee": 0.00765505401234568
        },
        {
          "txId": "0x1de9b63d06b18a111678804b3d87963e9c4ab1f5cf2b0759b1065de96921f865",
          "timestamp": "2025-07-08T00:55:42.899Z",
          "type": "receive",
          "amount": 18.589420438957475,
          "token": "PEPE",
          "status": "confirmed",
          "fee": 0.002912037037037037,
          "blockHeight": 275837
        },
        {
          "txId": "0x67fb6ab0ebe245dad55b1b8849065073fe933e3a95c01fbd9ff23fff28813607",
          "timestamp": "2025-07-07T21:33:42.900Z",
          "type": "receive",
          "amount": 196.0840192043896,
          "token": "WELSH",
          "status": "failed",
          "fee": 0.00690300925925926
        },
        {
          "txId": "0xe09c8f813a1a7ed600ddc5b6226d81b4f3d6c8ecdcb27ff6e90f8b92e2d0217f",
          "timestamp": "2025-07-07T18:24:42.900Z",
          "type": "receive",
          "amount": 65.14381858710561,
          "token": "PEPE",
          "status": "confirmed",
          "fee": 0.00974224537037037,
          "blockHeight": 852608
        },
        {
          "txId": "0x3d5a5242179793c14665cec51f75590419478c1115dab2e965513781534584fe",
          "timestamp": "2025-07-07T16:47:42.900Z",
          "type": "send",
          "amount": 97.78540809327846,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.0074967592592592594,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0xd73601992bad498bda5daaef09ee30b39d02b11ccc67a0a11c9f29146d87b431",
          "timestamp": "2025-07-07T07:55:42.900Z",
          "type": "deploy",
          "amount": 22.847479423868315,
          "token": "ALEX",
          "status": "confirmed",
          "fee": 0.004132253086419754,
          "blockHeight": 298784
        },
        {
          "txId": "0xc639523f32aecd77f7b64e947fece94dc62d9532c49d7504baf4415205d3aafc",
          "timestamp": "2025-07-07T05:00:42.899Z",
          "type": "deploy",
          "amount": 20.982338820301784,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.0020346450617283953
        },
        {
          "txId": "0x0b90ecfc21b0f2df81732ea6a4447309a63fca994e5a5416ff6bcc0fe4e5ef54",
          "timestamp": "2025-07-07T02:52:42.900Z",
          "type": "contract-call",
          "amount": 125.21844993141289,
          "token": "CHA",
          "status": "failed",
          "fee": 0.008472145061728397,
          "memo": "Bot funding"
        },
        {
          "txId": "0xa8ab670020d102b97712be9f6582ae606be96abfb5b7d369bd0c49b1afbaf912",
          "timestamp": "2025-07-06T23:43:42.900Z",
          "type": "send",
          "amount": 23.033179012345677,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.009418827160493828
        },
        {
          "txId": "0xdb1373da92b9a0bb15b3d2eb575c71d36f1c8a8032c3f417e30112402c772e8b",
          "timestamp": "2025-07-06T21:11:42.900Z",
          "type": "deploy",
          "amount": 134.51971879286694,
          "token": "LISA",
          "status": "failed",
          "fee": 0.009264583333333333,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0x78eae2930ac0408d5fc4b81384d231d65f2ffe75235398904a00de182021223e",
          "timestamp": "2025-07-06T08:07:42.900Z",
          "type": "contract-call",
          "amount": 182.34469307270234,
          "token": "LEO",
          "status": "failed",
          "fee": 0.007266087962962964
        },
        {
          "txId": "0x4b788bf55d6db48e4dee2170e8bb5cf7813670d853b9072918620ee16e258931",
          "timestamp": "2025-07-05T13:51:42.900Z",
          "type": "send",
          "amount": 187.76744684499315,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.0026433256172839507,
          "blockHeight": 547345,
          "memo": "Bot funding"
        },
        {
          "txId": "0xda056f91a1274fe7f5292b4d85c245d80163574f0b68d0525f1acf7342a729de",
          "timestamp": "2025-07-05T10:36:42.900Z",
          "type": "receive",
          "amount": 73.13623113854595,
          "token": "ROOS",
          "status": "failed",
          "fee": 0.007773611111111111
        },
        {
          "txId": "0xd8d3094f47e6214c06c328ef7940b7aaeae19b6bb492297612689b439e68a9f0",
          "timestamp": "2025-07-04T18:20:42.899Z",
          "type": "receive",
          "amount": 42.89000342935528,
          "token": "DIKO",
          "status": "confirmed",
          "fee": 0.004711265432098766,
          "blockHeight": 638167
        },
        {
          "txId": "0xf147b8bed2293b4534def44ceb24a8c83cbcba8fbf166514331113740a201084",
          "timestamp": "2025-07-04T06:21:42.900Z",
          "type": "deploy",
          "amount": 97.46857853223594,
          "token": "STX",
          "status": "pending",
          "fee": 0.005977121913580247
        },
        {
          "txId": "0xbc72b3b2ab93a64e05feb25dee3ae2dc2df81ed0f608a810e1eadb2ded7d1104",
          "timestamp": "2025-07-03T21:00:42.899Z",
          "type": "deploy",
          "amount": 57.81275720164609,
          "token": "LISA",
          "status": "confirmed",
          "fee": 0.009538503086419754,
          "blockHeight": 351909
        },
        {
          "txId": "0x9d21e0c051896d1275cbba0a3e9eae2bf484c831139abaa1c7b582c3a70bd5c5",
          "timestamp": "2025-07-03T14:39:42.900Z",
          "type": "deploy",
          "amount": 118.75805898491085,
          "token": "DIKO",
          "status": "pending",
          "fee": 0.0045550154320987656,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0xd7c38f6e8cffe3b0f1bba4db3cbde0bb21877d6505f8cdc061800c3e132fa3cc",
          "timestamp": "2025-07-03T14:20:42.900Z",
          "type": "contract-call",
          "amount": 107.00604423868313,
          "token": "LEO",
          "status": "pending",
          "fee": 0.0014937114197530865
        },
        {
          "txId": "0xfce21fbf63eb0439773fb737a7235391f23e626a3f6ed1a90daad4720d24247d",
          "timestamp": "2025-07-03T04:07:42.900Z",
          "type": "receive",
          "amount": 183.97933813443072,
          "token": "LEO",
          "status": "confirmed",
          "fee": 0.004301851851851852,
          "blockHeight": 542596,
          "memo": "Bot funding"
        },
        {
          "txId": "0xd549479f74cc01c47e628ea12609cc82a812fdb2ebab8caa027ba557c5220fee",
          "timestamp": "2025-07-03T03:27:42.899Z",
          "type": "deploy",
          "amount": 105.68904320987654,
          "token": "CHA",
          "status": "failed",
          "fee": 0.004500771604938272,
          "memo": "Bot funding"
        },
        {
          "txId": "0xfcfcb8df490953e81aaf31403777e04011414054c67d94b63b3966d0752ba2a0",
          "timestamp": "2025-07-03T01:53:42.900Z",
          "type": "receive",
          "amount": 86.6556498628258,
          "token": "LISA",
          "status": "confirmed",
          "fee": 0.0011501157407407408,
          "blockHeight": 412839,
          "memo": "Trading profit"
        }
      ],
      "connectionMethod": "xverse"
    },
    "preferences": {
      "sidebarCollapsed": false,
      "theme": "light",
      "skin": "forest",
      "language": "zh",
      "timezone": "Europe/London",
      "dateFormat": "EU",
      "numberFormat": "US"
    }
  },
  "bots": {
    "list": [
      {
        "id": "SP336P4RGTYM3VSWF3XC1R2NM73EYTKYPSZDA59B9",
        "name": "Machoke",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-09T19:10:43.469Z",
        "lastActive": "2025-07-10T08:05:43.469Z",
        "encryptedWallet": "300abe7d42a32c1a69fcd21ac51bc06d4b69ef74a5e74dc3e676b6aff8be2bc0c29abd30159898bad8bd61365116665c555cfb64819de8198aeb124cb332cdb82de0fb1376308124cf96a1b6db6fef81",
        "walletIv": "ea9e46ba87315eb25dede6f3fe46329e",
        "publicKey": "02af23d51e94e50169b836a46e199c617349cb2959d876f3aa02ce4979bd75f195",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/67.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP1GX0JMADJA5WHS52M46ED2F79Z7ZSH3PZHKSFW4",
        "name": "Nidoking",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-08T09:27:43.563Z",
        "lastActive": "2025-07-10T09:58:43.563Z",
        "encryptedWallet": "26d55b82d684bdde5291546f4a807c2b2f7d6f2f3fe9751bde0719fc086bc003572d9e8b9a74b1dfa9f3c949898cfa5dbf384ad7156cfdb47c5ac682eefe0c22aaf6d2cdc5ace3e53c56385853ba4973",
        "walletIv": "59c33dc71bdd58d2d10af004a0736d01",
        "publicKey": "02e151e0fb1ec2fac9f6e000955243619121d0efd91bb76602a5122d933f4f872d",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/34.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP1GNZEEKFRAGK0P482BXVPNAZVBBMFEB6M1A2606",
        "name": "Butterfree",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-04T05:03:43.657Z",
        "lastActive": "2025-07-09T21:54:43.657Z",
        "encryptedWallet": "78598394a500d64474a5ad20ca28825744b525ec9cc9e44ce02934624b0a9a1438a173a2bb339a6450c050ecee0218525b61975fdb1048905cae5bc281e828f9043cedd3d28bb2a1817d107b8d0b3bd2",
        "walletIv": "5563cf56a6b29c245666c45fcb38c167",
        "publicKey": "027602923ef5a55c31bbe0dee599af0400a8686455698470ce2f4b4e1da01d1d66",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/12.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP17X947CDGXJPAK5S2XW8ZE5M2MF25YRVP889Q7T",
        "name": "Exeggcute",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-10T07:26:43.747Z",
        "lastActive": "2025-07-09T18:26:43.747Z",
        "encryptedWallet": "54e1f3f7394396eba2999f7df3ceaceffad50d2102bbaa9d0d8879b30d88a633672917a2284b508cdd0f697b271110fa226f274c672d57cde8bfbbf0bd035eab9a76382f4795b27267bc68941c48da08",
        "walletIv": "13544d5acca7791f5bb81c01b4222b28",
        "publicKey": "02c4778bd5849e9b429089a26e5e545c6511b520d2d6fa3f07ddf6ba11f6bbe9b4",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/102.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP188525BTPCY1JPSAKJZS39FBV0JCXRTXDXNFR1B",
        "name": "Machoke",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-05T12:36:43.835Z",
        "lastActive": "2025-07-09T21:03:43.835Z",
        "encryptedWallet": "1721fd1462f8c3f395f5db93773d9ee56a15a5487a62fbf0c07162452a81ff3292b2c2448e765bd11cbf02a824037b4f1c307fa40b0dba944a488dafb308e5d1dc22fb6d9af9cb92449e0b58403d5647",
        "walletIv": "12e81f127c0a1dbd53b648adaf2f69d8",
        "publicKey": "02861ee90b6f470e241918529dd6a137392015f39872fa7e0d8948a92c588ca744",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/67.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP2KQFQ4VDV6K9SFFDRN3YGW976STT5FZ8KRFT72S",
        "name": "Beedrill",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-06T16:36:43.920Z",
        "lastActive": "2025-07-10T15:35:43.920Z",
        "encryptedWallet": "f6f57218c47e0d0b06091bd44ac1495e8d451cc8ef5efe4fa01410a4ed2b7ab69baad963788390fcb1af796a09cc1f958d0b40cd9f6d930086be1a371b2d9aed684f67e55bb0885f0e0bc7cf6263cdce",
        "walletIv": "b05140bbcac35f1a85fdf51262f26428",
        "publicKey": "03cfd3bd08fbcbf73a9f221420b243c2952980b4d61d1f135f363118cf334e70f9",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/15.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP18VZZSY7DZK1SR54RP29MPTB0YM9YAP7KZG4AS0",
        "name": "Eevee",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-09T21:19:44.006Z",
        "lastActive": "2025-07-10T21:00:44.006Z",
        "encryptedWallet": "9e3055078cd59771cca1aed29e172c205af86eb8f956492571a018710f78957fe980ec735c6457f94ee9d356a545d105ee46613c29a36482d413f3d1b9c96cc2caf7a22f40a00376834b607611157b24",
        "walletIv": "574eee4e8d3f9e4e8c90c0ceae9ee9e2",
        "publicKey": "030bfcf15bcd25b16c65d73a6e606a8d85d4d33af19b2681ae3d6f4d85e4516f47",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP30YXWNRDTE46G2RHD8B8E5H26VKHEVWTEGKTJNK",
        "name": "Alakazam",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-05T14:33:44.094Z",
        "lastActive": "2025-07-08T23:33:44.094Z",
        "encryptedWallet": "643f4f2ab066e299c21488b630bb5a0371bf840c4c87c9e0f78426ddae0934256c37991f141b335079952317134fe510a172057a19e9884eb0a3ba56c9faed0eb46243480804e8804005d7fceaca903a",
        "walletIv": "6665ba8bfdc34a33620deb7126aa4f34",
        "publicKey": "0233a6ec96d2cc51b7ea828ffa7b930faba047ac167d9c3cc33b3ae34a3e4d3a6e",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/65.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SPY2YXD0SX6JEQK3ANZZX2C46T4EWMSP8ZCHPYKD",
        "name": "Golduck",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-10T05:28:44.181Z",
        "lastActive": "2025-07-09T01:10:44.181Z",
        "encryptedWallet": "f59a7d03dcd33d63a0f0ce572b1a3f5800e6f98e1c373d4b47000787124d112375fad0fe76ffa6ad0e6d40d26f4cbf57b660cc071b6cabf6577f1d555c59e2f6e9ec3f757de253aad2fee50094cebab8",
        "walletIv": "8ef5b79fa5b265790d4357bf0f12e3cc",
        "publicKey": "03ae2906702ef82906ba3e7d4c2585b45a89436167c794c7332a3f5eee9eaaa6ad",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/55.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SPZ6AM4XRK6EK7KVD5H6EHH31N9GAHW3R81T7RZR",
        "name": "Victreebel",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-07T04:24:44.268Z",
        "lastActive": "2025-07-10T04:19:44.268Z",
        "encryptedWallet": "ac5fe041408335b7f7f2e33f0194a6111c9afa6eeee7f83cf7f85b7292db36edd15fd4f326120ea5d699aa6f6619e6d5fd46edbfe0bb23f2793302714919222f36540ddec41e1e5b319aebbf00bbd0c8",
        "walletIv": "ce25e6afdf746743494c9c1efe93ec06",
        "publicKey": "02ac0456860249e6dcbe6728b59cd093600141f67123122a27d1396610956d30bf",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/71.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP1632PATQRA3PP88WCX071AYPJRX62BHQAVRAY4K",
        "name": "Haunter",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-05T03:55:44.354Z",
        "lastActive": "2025-07-10T03:00:44.354Z",
        "encryptedWallet": "e82129104d73dd39c80cb65c0f131d489dc8d3cb68240a834dbde49a25f4a2dbe5acf1a53abe3b1be92e6d10d4c7f40819b209d47affc89a47593b5650a84a69fe320ebe86c477b40139316581e0ad63",
        "walletIv": "e249a6cee0f8d9acecb124cf55330310",
        "publicKey": "03fabdca0ec6bbb9df343b59c88aa4d62f85f139cb5904ba41cd4e95685c706294",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/93.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP9TWBJ5NF9R316R3D32YQ9BDSKC9KPN9R6W3G6X",
        "name": "Vileplume",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-06T13:16:44.441Z",
        "lastActive": "2025-07-10T20:16:44.441Z",
        "encryptedWallet": "0b7f1087cceb8dfdbc1433f66ba9424771b01d3fdb81a91a30b07ada73acfc22fc775ff439175f3817aa8277b913ae9f59fbb3a67a42a0aed02ed4266aa1c2e3b5ff722b800b89b9f5307009fc8ec6fc",
        "walletIv": "20870a435fd65fc22987c3fed6562366",
        "publicKey": "03dfc08a0764de7f6392655522dd383499d860a9bb00dbc2134d3985d701620132",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/45.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP3ZY7A98CJ99SN12R1KR8A4NDFTAT0MYFQKCJB3R",
        "name": "Lapras",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-03T17:15:44.528Z",
        "lastActive": "2025-07-10T08:00:44.528Z",
        "encryptedWallet": "76506f47bcd9ecfec9c5bfb145e3a85b6bbc010a21cedd0a0957a5c27876de373607ad44a0b2531722062620e9a87fd7c7b2526e7e4d9ae8db60495b301c4864b8a04a53152673b0dfe024632104919b",
        "walletIv": "9aa5812f6799eea955d823c2561daaea",
        "publicKey": "021e72af0a6585833fd40c61d26988377f76f6bf9ac2684b7e363c9d37280fa56b",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/131.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP2G0JJBYJK87BDBRB6DGJJRDDE6FK8D6EZMH7NDG",
        "name": "Poliwrath",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-09T21:13:44.614Z",
        "lastActive": "2025-07-09T00:01:44.614Z",
        "encryptedWallet": "0b850f828f47ffdd9d00d9ecdc51ba238bfe6276e7a0c25fec8dd00ac14be3fe173ea750c70c134712be2f4300da04c6eac5b64fad2fd751d9276ea0ec8c3e7fbae4618681e430051cb13a206c1f40bd",
        "walletIv": "5e7686abc780e29f5093687dcb0d5cee",
        "publicKey": "0336d41ec1a78f67b662ef3a9b4fbd4282aa8dfa02dcfca75086de8f2d65b997fd",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/62.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP3H7T4PKCQA0W8FR819KK1N85F9P5G9RBW7DM18Q",
        "name": "Parasect",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-05T03:34:44.702Z",
        "lastActive": "2025-07-09T11:28:44.702Z",
        "encryptedWallet": "46aea813165f89272a81ffa5502b028dd27da18faff39390e8e0cd7368f2365e202b382a0f073c737ab28486c50e7c6607a01198cfc8820d417d4905e8a3df59b6fd1a33f3ded5327c383d8d4b26c5cf",
        "walletIv": "2cefa5656de8b064c2a4a18c6dc31884",
        "publicKey": "0311dc9d12f1a724e7c0d7ce66b1c252f4320248b74d9071ae71f3f61baf8b01cf",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/47.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP3VW9KE5MHH840KJ3KDFN694QV05059855SMWK3H",
        "name": "Tentacool",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-05T01:29:44.788Z",
        "lastActive": "2025-07-08T21:40:44.788Z",
        "encryptedWallet": "addaa709b78a4d508e9a7293dded182afe59af5fe30ada6b601d36d1c2443743b23a3424b8f8432b2e4163723204ac90474fade9d1ad3cb79c2631f8ae8d8e64f2f267b95c48738ba2836a2553d6f511",
        "walletIv": "e910b5590642811c1d127cc76e9c7824",
        "publicKey": "0302c619d9bc7e80ddb91ff3a83db2107ab9bf04880cf98aff4c2629706a8c1e98",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/72.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP3Q4QP4K5FZHCCBN94EZAP93KTSR25D3P86RQ49A",
        "name": "Nidoking",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-07T06:06:44.874Z",
        "lastActive": "2025-07-10T04:11:44.874Z",
        "encryptedWallet": "b706080124f757b4675062382cf9bf6c3e87030ffbe4522bb39db2a48382d78e0454c6f5c73940f13c47104be06fcda74c698ebca1cacab191f45acb724315e86a125dd5057027dae951732c673ba2ed",
        "walletIv": "c9e320c7886a7f8747c1e44d5d8eed61",
        "publicKey": "021cea7611dfaceef035e6f3e0be7c533038317cf793e8a802748194db59101468",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/34.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP1JPJ0D0GGSXSVRMFF0YYDF4J2SVSN0WGEC828MD",
        "name": "Jynx",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-04T16:57:44.958Z",
        "lastActive": "2025-07-09T14:19:44.958Z",
        "encryptedWallet": "96559a116b9023f010aa1c1cfd48ce0ff4f85c7de014f99b33fd7e2fe2d6b6c129dd7b1d8d0e4cce6bc3bbd6a24c4c763ce9cfb357322736c14469080ea70fa7f556991c55a9b0be94705fc70775fa3a",
        "walletIv": "d3dcec469df23930e500d0d29db7fb8f",
        "publicKey": "02569e5e543fd9cff5d22f9f1b54df945b9dc29d9d36b06d7bc29e938d5b5544f6",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/124.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP68WM482B0VJNN3H2A9JZ9BYPVZ8R1T4VXGT261",
        "name": "Weezing",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-09T20:39:45.044Z",
        "lastActive": "2025-07-10T12:50:45.044Z",
        "encryptedWallet": "6bc98dacdc71dc5d240cb7e50230101c5d495be8f527b51c44575b3f3bf824ea97e84f71e851e9974634d9fece53cf7a883da6719e2c1dadcef4ae3cc898c469b3aabd1e55fab2614a6445ba0e6ff6c5",
        "walletIv": "4854b2e0f1ac480d2a55ce293c86d714",
        "publicKey": "02d09a1bce337dd75eb29c3f88c2b91c5c3c9985d2ba4aa6813308a852c18746a3",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/110.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP21XM22M1R4B5P6AVESPT97E4C9VB75T0T82CTF1",
        "name": "Tentacruel",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "setup",
        "ownerId": "SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N",
        "createdAt": "2025-07-02T22:07:45.130Z",
        "lastActive": "2025-07-09T04:03:45.130Z",
        "encryptedWallet": "c2aaeda66c474046256cea0321fc0b32be269c9e513b3ec8dd6cb91c78cc01930a65b182ad5fbc7f79596f23f7645c9c2a11a453ede21642e4534fa923c161595ba379209c1964159d3ef6b6c32164cd",
        "walletIv": "57429e497416e5678c70832556a41c68",
        "publicKey": "02f821f396bcdb34e6f61fd63e526d03068b3e191d82be741ca2b2fc9d159610fb",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/73.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      }
    ],
    "stats": {
      "totalBots": 20,
      "activeBots": 0,
      "pausedBots": 0,
      "errorBots": 0
    },
    "activities": []
  },
  "notifications": [
    {
      "id": "notification-135821",
      "type": "warning",
      "title": "Bot performance declining",
      "message": "Current slippage exceeds your tolerance of 1%",
      "timestamp": "2025-07-10T15:15:45.131Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-883854",
      "type": "warning",
      "title": "API rate limit approaching",
      "message": "Less than 10 STX remaining in wallet",
      "timestamp": "2025-07-09T11:00:45.131Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-123553",
      "type": "warning",
      "title": "Wallet balance low",
      "message": "Approaching 80% of hourly API limit",
      "timestamp": "2025-07-08T10:20:45.131Z",
      "read": true,
      "persistent": false,
      "actionUrl": "http://localhost:3420/wallet"
    },
    {
      "id": "notification-618240",
      "type": "success",
      "title": "Settings updated",
      "message": "Added 250 STX to liquidity pool",
      "timestamp": "2025-07-08T07:25:45.131Z",
      "read": false,
      "persistent": true
    },
    {
      "id": "notification-642843",
      "type": "success",
      "title": "Bot started successfully",
      "message": "Successfully swapped 100 STX for ALEX",
      "timestamp": "2025-07-07T01:11:45.131Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-141095",
      "type": "warning",
      "title": "API rate limit approaching",
      "message": "Approaching 80% of hourly API limit",
      "timestamp": "2025-07-06T17:44:45.131Z",
      "read": true,
      "persistent": true
    },
    {
      "id": "notification-467573",
      "type": "success",
      "title": "Settings updated",
      "message": "Your bot has been activated and is now running",
      "timestamp": "2025-07-06T16:17:45.131Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-985320",
      "type": "success",
      "title": "Yield harvested",
      "message": "Your bot has been activated and is now running",
      "timestamp": "2025-07-06T07:40:45.131Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-167507",
      "type": "warning",
      "title": "API rate limit approaching",
      "message": "Your bot has not made a profit in 24 hours",
      "timestamp": "2025-07-05T15:43:45.131Z",
      "read": true,
      "persistent": true
    },
    {
      "id": "notification-479494",
      "type": "error",
      "title": "Bot execution failed",
      "message": "Smart contract rejected the transaction",
      "timestamp": "2025-07-04T05:23:45.131Z",
      "read": true,
      "persistent": true
    },
    {
      "id": "notification-690270",
      "type": "error",
      "title": "Transaction reverted",
      "message": "Transaction failed due to insufficient gas",
      "timestamp": "2025-07-03T19:58:45.131Z",
      "read": true,
      "persistent": false,
      "actionUrl": "http://localhost:3420/market"
    },
    {
      "id": "notification-822384",
      "type": "success",
      "title": "LP tokens staked",
      "message": "Your bot has been activated and is now running",
      "timestamp": "2025-07-03T11:36:45.131Z",
      "read": false,
      "persistent": true
    }
  ]
} as const;
