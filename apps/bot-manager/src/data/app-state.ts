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
    "timestamp": "2025-07-10T22:07:16.084Z"
  },
  "user": {
    "settings": {
      "general": {
        "isDarkMode": true,
        "compactMode": true,
        "autoRefresh": true
      },
      "network": {
        "network": "mainnet",
        "rpcEndpoint": "https://stacks-node-api.mainnet.stacks.co"
      },
      "botDefaults": {
        "defaultStrategy": "yield-farming"
      },
      "notifications": {
        "trade": true,
        "error": true,
        "status": true,
        "performance": true,
        "security": true
      },
      "notificationChannel": "webhook",
      "security": {
        "apiKey": "sk-3242895322b30655bd9021cc560b45ad288edc0f",
        "autoLockTimeout": "60",
        "requireConfirmation": false
      },
      "advanced": {
        "debugMode": true,
        "performanceMonitoring": true
      }
    },
    "wallet": {
      "isConnected": true,
      "address": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
      "network": "mainnet",
      "balance": {
        "stx": 1899.054355281207,
        "tokens": [
          {
            "contractId": "SPP0T3FJM4CPINQ0V61FEZQVB6YF83P9PMQ7J00W.cha",
            "symbol": "CHA",
            "name": "Charisma",
            "balance": 1545,
            "decimals": 6,
            "usdValue": 0.008496909632949173
          },
          {
            "contractId": "SPQ7M0ETSL4H6YIJQA4U7DRQNV8EK61AXZHXNILF.welsh",
            "symbol": "WELSH",
            "name": "Welsh",
            "balance": 353,
            "decimals": 6,
            "usdValue": 0.002877776657683794
          }
        ]
      },
      "transactions": [
        {
          "txId": "0x20068d10bcd2b896645edc7837d163c9fc895a81424dd5d1ca4fad5424fa32c8",
          "timestamp": "2025-07-10T19:12:16.085Z",
          "type": "receive",
          "amount": 51.89236111111111,
          "token": "LEO",
          "status": "pending",
          "fee": 0.007494174382716051
        },
        {
          "txId": "0x8fe3a497f0d4f2cdec07bf30191c157f38c17e7aba7b1634cb9295c41323cb1e",
          "timestamp": "2025-07-09T21:46:16.085Z",
          "type": "receive",
          "amount": 63.703832304526756,
          "token": "ALEX",
          "status": "pending",
          "fee": 0.0017481095679012346
        },
        {
          "txId": "0xf5f8b45e7d2e6f07c46f1bfcc2dffbceb836c71c021520b60b59a60ffc18466f",
          "timestamp": "2025-07-09T17:01:16.085Z",
          "type": "deploy",
          "amount": 84.78317901234567,
          "token": "STX",
          "status": "pending",
          "fee": 0.003343827160493827
        },
        {
          "txId": "0x2860c027e0060e0862102f38a5a9ce20cc79d7dd8f104164306e6f9d7ac47bd8",
          "timestamp": "2025-07-09T14:29:16.085Z",
          "type": "contract-call",
          "amount": 196.26971879286694,
          "token": "PEPE",
          "status": "pending",
          "fee": 0.0031895833333333333,
          "memo": "Trading profit"
        },
        {
          "txId": "0x2bceeff749c344276889ad21f93255fc0a49c58b52eafac682cc09004862bab1",
          "timestamp": "2025-07-09T09:48:16.085Z",
          "type": "deploy",
          "amount": 45.547625171467764,
          "token": "USDA",
          "status": "pending",
          "fee": 0.009869560185185186
        },
        {
          "txId": "0xc0c06a65334ef820a4dfdde16e906bfcdc66dcc95766eb76ee6715c9b3ac4c14",
          "timestamp": "2025-07-09T02:59:16.085Z",
          "type": "receive",
          "amount": 89.684670781893,
          "token": "LEO",
          "status": "confirmed",
          "fee": 0.00788155864197531,
          "blockHeight": 927881
        },
        {
          "txId": "0xac98543351c4b886c7807aa00183b580f65c523adbcd92953656d103e9f47891",
          "timestamp": "2025-07-08T18:07:16.085Z",
          "type": "deploy",
          "amount": 73.75604423868313,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.00891871141975309
        },
        {
          "txId": "0x6dbf276cb34fcf875ecb6199c5c46512d8191801f90ca46b5418b34490483283",
          "timestamp": "2025-07-08T10:02:16.085Z",
          "type": "contract-call",
          "amount": 79.16332304526749,
          "token": "LEO",
          "status": "pending",
          "fee": 0.005355401234567902,
          "memo": "Yield farming reward"
        },
        {
          "txId": "0x8ab8a09f64f4e01ea3b21c126cc2a65167a4d96f63270f46b2be84dea092d14b",
          "timestamp": "2025-07-08T09:05:16.085Z",
          "type": "deploy",
          "amount": 159.53540809327848,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.0014217592592592593,
          "blockHeight": 168476
        },
        {
          "txId": "0x5ee679faa6d827aa074c564c8d00fb5f1e6919b4fd0e69fc7661bad4029e6fa0",
          "timestamp": "2025-07-08T08:52:16.085Z",
          "type": "deploy",
          "amount": 174.53798010973935,
          "token": "LISA",
          "status": "pending",
          "fee": 0.005521296296296297
        },
        {
          "txId": "0x8ce0013d488d58315d3412c5341f3bafbdf5ea22682ad4c8e4088c7f22f90e78",
          "timestamp": "2025-07-08T07:52:16.085Z",
          "type": "send",
          "amount": 71.24339849108367,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.0018876543209876543
        },
        {
          "txId": "0x48b70d3930922723a979d59653adc04ce08b87e21d6c0aec4f9c4c85ee835445",
          "timestamp": "2025-07-08T04:48:16.085Z",
          "type": "send",
          "amount": 196.36908436213992,
          "token": "CHA",
          "status": "pending",
          "fee": 0.0030183641975308644,
          "memo": "Bot funding"
        },
        {
          "txId": "0xc18db41ede29bdef7406150c4cb525e61616399b427a8b000e3ba64bf0778630",
          "timestamp": "2025-07-07T03:00:16.085Z",
          "type": "send",
          "amount": 169.9191100823045,
          "token": "PEPE",
          "status": "confirmed",
          "fee": 0.0015293595679012348,
          "blockHeight": 347523,
          "memo": "Trading profit"
        },
        {
          "txId": "0xcd8452811e7cedaec348b89bf6825a5d7146b2dac36ae427bb23c70bdce9bd35",
          "timestamp": "2025-07-06T19:11:16.085Z",
          "type": "deploy",
          "amount": 186.1898148148148,
          "token": "ALEX",
          "status": "failed",
          "fee": 0.0012306327160493827
        },
        {
          "txId": "0x3f6c1cb1385196d48d0485f580a0ee4f8bbfc88ccc3ef75af731cf6a7271ca3c",
          "timestamp": "2025-07-05T14:30:16.085Z",
          "type": "contract-call",
          "amount": 141.45576131687244,
          "token": "USDA",
          "status": "pending",
          "fee": 0.005722762345679013
        },
        {
          "txId": "0x9e361785673691d56218c4e25eab0bbabd2180529c16ddbec184dfd6cd44bced",
          "timestamp": "2025-07-05T09:00:16.085Z",
          "type": "receive",
          "amount": 79.02323388203018,
          "token": "STX",
          "status": "failed",
          "fee": 0.007367283950617285
        },
        {
          "txId": "0x1161a633de007a77683ca213aeb37735f1d936c17f0777cdee6a193fdfc94f3a",
          "timestamp": "2025-07-04T22:46:16.085Z",
          "type": "deploy",
          "amount": 21.253557956104252,
          "token": "ALEX",
          "status": "failed",
          "fee": 0.005255825617283951
        },
        {
          "txId": "0xdb6a216aa8b86b390052737d86ab643c360cc86bc8919dffec13e61d41f28b7d",
          "timestamp": "2025-07-04T21:53:16.085Z",
          "type": "contract-call",
          "amount": 99.93072702331962,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.005570601851851853
        },
        {
          "txId": "0x8fec79de01b9f4ce0f568acf4aa95f0461f50c26059430e404f2d9b0a239edb5",
          "timestamp": "2025-07-04T21:36:16.085Z",
          "type": "send",
          "amount": 80.78900891632374,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.009636111111111113,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0xc8d83a8ff111a09b3c911c0f97d9d11818f5584eb3aea08f6f849eff5e559456",
          "timestamp": "2025-07-04T12:01:16.085Z",
          "type": "receive",
          "amount": 31.90929355281207,
          "token": "LISA",
          "status": "failed",
          "fee": 0.0071077932098765435,
          "memo": "Trading profit"
        },
        {
          "txId": "0x0e865740318343d3776aa25afcf2804e396fa6ad4c87a27c299e45efa71d0141",
          "timestamp": "2025-07-04T11:11:16.085Z",
          "type": "receive",
          "amount": 60.13563100137175,
          "token": "CHA",
          "status": "pending",
          "fee": 0.009667052469135805,
          "memo": "Trading profit"
        },
        {
          "txId": "0xb56164660fe043abd6b29a8b08326689c8ac9db2a18844cbbed45067b8a5f644",
          "timestamp": "2025-07-03T21:11:16.085Z",
          "type": "deploy",
          "amount": 31.893818587105624,
          "token": "LEO",
          "status": "confirmed",
          "fee": 0.00816724537037037,
          "blockHeight": 245108
        },
        {
          "txId": "0x5db0c768ef96156234998de859b706ab24f5c44af8396e661fd5a3edf5f6f703",
          "timestamp": "2025-07-03T13:55:16.085Z",
          "type": "deploy",
          "amount": 149.0946930727023,
          "token": "DIKO",
          "status": "confirmed",
          "fee": 0.005691087962962964,
          "blockHeight": 271103
        },
        {
          "txId": "0xe3d1dbed6bb7fc31817588bebfb7841d1259e61e708fe2413df11f4583213e0b",
          "timestamp": "2025-07-03T05:38:16.085Z",
          "type": "contract-call",
          "amount": 189.9811814128944,
          "token": "LISA",
          "status": "pending",
          "fee": 0.002664853395061729
        }
      ],
      "connectionMethod": "hiro"
    },
    "preferences": {
      "sidebarCollapsed": false,
      "theme": "light",
      "skin": "forest",
      "language": "es",
      "timezone": "America/Los_Angeles",
      "dateFormat": "ISO",
      "numberFormat": "EU"
    }
  },
  "bots": {
    "list": [
      {
        "id": "SP395B5MZ93VATE5KV6GVQ6VAP9N0FWY3ND2RJ1RY",
        "name": "Parasect",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-05T20:46:16.453Z",
        "lastActive": "2025-07-10T06:21:16.453Z",
        "encryptedWallet": "49749ed8e19b37fc5ba9d5906baac9024f174dc7cf926030d8260fbeda14cdddc134f10085477e818792ed8ae40d19b6bd402e729f161f2fbbe11af41323427f7b49f53baad983d9a160a63babc7419a",
        "walletIv": "3df3c0822894622056cfe93790942572",
        "publicKey": "03387b5af3c587bbffb5638ec391257948afe10b532dad20b23305497b6b18ee8c",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/47.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP3GMN0SH7G303HZAQG51ZYVMAYNNBFE8GB07V2KV",
        "name": "Omanyte",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-05T14:40:16.550Z",
        "lastActive": "2025-07-10T14:18:16.550Z",
        "encryptedWallet": "0f9933636078251167be721da69bcecfefa767be19745d7c99d1b7c82814ed9de17344091db42440fad667fbaa9e29c7b558c296de446a0980ee7fa01d25991bf4bb11809c4676e16474dc8b1bc47e68",
        "walletIv": "ecb6af6f084d3d9732052b3c8daa4e9e",
        "publicKey": "02950e7aed7b94c1f5c2116bd5df7deef3a5670218335335e03636e5f0bb54dd0e",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/138.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP32JMY5YNZEMZPTF1KPZYB38PETW774XQ3BP3K3D",
        "name": "Magnemite",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-05T20:17:16.641Z",
        "lastActive": "2025-07-08T23:02:16.641Z",
        "encryptedWallet": "33c993ec46d0dd1be4f8da88f5ca0286caba7128ea11e83e50181d8653a2e8cf9df42be29898d377ffe8dd67c5ea4a39f3d7e5eae75a0c0dbae37b89171b1948a096013457399b32673d053fc1a4ff74",
        "walletIv": "39038524f5a143db155b726f403c9c76",
        "publicKey": "0374eacf8a0beb8832e5723deb8c6be2b43614c3dca4757c472a166becfe2e5d92",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/81.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SPK2K9H9DRG2C50KGARFJZT9TZFR4PFA7SWS0ZAS",
        "name": "Kakuna",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-04T23:49:16.733Z",
        "lastActive": "2025-07-09T17:50:16.733Z",
        "encryptedWallet": "70b2eca86fb3b638329035279cdca04c5e18993d0ecf65e4bc402487b4ef5ce0523372167b784d2e25368bec1481b59d14089b01b0c1f11a1a0150b9a2c852f00eb62e4596be7fdd49af4fdd942a81e1",
        "walletIv": "7e3f2982bdffe061e5944dec4c10115b",
        "publicKey": "02693dc3a661ea7997a16441b4ca523901ff4f7ffb65488a17ed386ddd3951fe6b",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/14.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP12WAGTKRMMZC1M3Y7X4CGC2NET2ST75M4BHYA7R",
        "name": "Jolteon",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "setup",
        "ownerId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-10T20:23:16.836Z",
        "lastActive": "2025-07-10T13:17:16.836Z",
        "encryptedWallet": "0c7053603b37dc3625ef2ee99fa8da78f7787894a84377c199aa0eb42bc0b2c9b85f48fc2efce93a1d5147b49e97de3d043774c358053c055723b07108684e2b39b070aaf37877ce5e3ed25b17343d50",
        "walletIv": "07684eeb8415062c5753ec9132ed62c8",
        "publicKey": "03a835daa0cfc57a88645a8b41fbe01a0c2345cdbe5e23235947dfb0ea3619f5b3",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/135.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      }
    ],
    "stats": {
      "totalBots": 5,
      "activeBots": 0,
      "pausedBots": 0,
      "errorBots": 0
    },
    "activities": []
  },
  "notifications": [
    {
      "id": "notification-110119",
      "type": "success",
      "title": "LP tokens staked",
      "message": "Successfully swapped 100 STX for ALEX",
      "timestamp": "2025-07-09T03:17:16.837Z",
      "read": true,
      "persistent": true,
      "actionUrl": "http://localhost:3420/market"
    },
    {
      "id": "notification-163514",
      "type": "success",
      "title": "LP tokens staked",
      "message": "Successfully swapped 100 STX for ALEX",
      "timestamp": "2025-07-08T04:11:16.837Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-609332",
      "type": "info",
      "title": "Price alert triggered",
      "message": "WELSH token now available for trading",
      "timestamp": "2025-07-07T19:26:16.837Z",
      "read": false,
      "persistent": false,
      "actionUrl": "http://localhost:3420/settings"
    },
    {
      "id": "notification-285081",
      "type": "info",
      "title": "Price alert triggered",
      "message": "STX price increased by 15% in last hour",
      "timestamp": "2025-07-07T18:53:16.837Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-619579",
      "type": "error",
      "title": "Network connection lost",
      "message": "Smart contract rejected the transaction",
      "timestamp": "2025-07-07T16:11:16.837Z",
      "read": false,
      "persistent": false,
      "actionUrl": "http://localhost:3420/market"
    },
    {
      "id": "notification-971643",
      "type": "error",
      "title": "Bot execution failed",
      "message": "Unable to connect to RPC endpoint",
      "timestamp": "2025-07-07T14:13:16.837Z",
      "read": false,
      "persistent": false,
      "actionUrl": "http://localhost:3420/bots"
    },
    {
      "id": "notification-666446",
      "type": "warning",
      "title": "High slippage detected",
      "message": "Your bot has not made a profit in 24 hours",
      "timestamp": "2025-07-07T13:09:16.837Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-723468",
      "type": "warning",
      "title": "Bot performance declining",
      "message": "Network gas prices are 50% above normal",
      "timestamp": "2025-07-07T11:36:16.837Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-799602",
      "type": "info",
      "title": "Market volatility increased",
      "message": "New STX-ALEX pool offers 25% APR",
      "timestamp": "2025-07-07T04:19:16.837Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-848695",
      "type": "error",
      "title": "Insufficient balance",
      "message": "Bot encountered an error and has been paused",
      "timestamp": "2025-07-06T23:17:16.837Z",
      "read": true,
      "persistent": false,
      "actionUrl": "http://localhost:3420/analytics"
    },
    {
      "id": "notification-805655",
      "type": "success",
      "title": "LP tokens staked",
      "message": "Collected 5.2 CHA tokens in farming rewards",
      "timestamp": "2025-07-06T20:39:16.837Z",
      "read": false,
      "persistent": true,
      "actionUrl": "http://localhost:3420/analytics"
    },
    {
      "id": "notification-127943",
      "type": "success",
      "title": "Settings updated",
      "message": "Successfully swapped 100 STX for ALEX",
      "timestamp": "2025-07-06T17:37:16.837Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-823634",
      "type": "success",
      "title": "Yield harvested",
      "message": "Notification preferences have been saved",
      "timestamp": "2025-07-05T19:07:16.837Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-773198",
      "type": "info",
      "title": "Market volatility increased",
      "message": "New STX-ALEX pool offers 25% APR",
      "timestamp": "2025-07-04T20:27:16.837Z",
      "read": true,
      "persistent": true
    },
    {
      "id": "notification-247658",
      "type": "info",
      "title": "New farming opportunity available",
      "message": "Maintenance window: 2 AM - 4 AM UTC",
      "timestamp": "2025-07-04T12:30:16.837Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-739479",
      "type": "info",
      "title": "Price alert triggered",
      "message": "Bitcoin price movement may affect STX",
      "timestamp": "2025-07-04T03:40:16.837Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-799803",
      "type": "error",
      "title": "Transaction reverted",
      "message": "Wallet balance too low to execute trade",
      "timestamp": "2025-07-04T00:07:16.837Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-442885",
      "type": "error",
      "title": "Network connection lost",
      "message": "Bot encountered an error and has been paused",
      "timestamp": "2025-07-03T14:27:16.837Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-274355",
      "type": "error",
      "title": "Bot execution failed",
      "message": "Smart contract rejected the transaction",
      "timestamp": "2025-07-03T13:27:16.837Z",
      "read": false,
      "persistent": false
    }
  ]
} as const;
