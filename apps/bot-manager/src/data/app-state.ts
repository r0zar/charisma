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
    "timestamp": "2025-07-13T00:42:48.001Z"
  },
  "user": {
    "settings": {
      "general": {
        "isDarkMode": false,
        "compactMode": false,
        "autoRefresh": true
      },
      "network": {
        "network": "testnet",
        "rpcEndpoint": "https://stacks-node-api.mainnet.stacks.co"
      },
      "botDefaults": {
        "defaultStrategy": "yield-farming"
      },
      "notifications": {
        "trade": true,
        "error": true,
        "status": false,
        "performance": true,
        "security": true
      },
      "notificationChannel": "webhook",
      "security": {
        "apiKey": "sk-31b6860e49a973e109e604eaadd6b20ddea67a30",
        "autoLockTimeout": "never",
        "requireConfirmation": true
      },
      "advanced": {
        "debugMode": false,
        "performanceMonitoring": true
      }
    },
    "wallet": {
      "isConnected": true,
      "address": "SPN94WUCRGSLJTVIVYSEASRAXEDLQY96GA5A51V7",
      "network": "mainnet",
      "balance": {
        "stx": 12586.106824417011,
        "tokens": [
          {
            "contractId": "SPOL8WFZ0BJFMCKSTT8ENDFGMEMEPM4RT6YN1RJ2.usda",
            "symbol": "USDA",
            "name": "USD Alex",
            "balance": 18679,
            "decimals": 8,
            "usdValue": 0.001045935081456449
          },
          {
            "contractId": "SPR5ESPI2ZI1ER2DPLAR0MBSQUB3Q02D938JLO7Z.leo",
            "symbol": "LEO",
            "name": "Leo",
            "balance": 14898,
            "decimals": 8,
            "usdValue": 0.0002618823673281406
          },
          {
            "contractId": "SP3G3VWNXEQOETJAAXJJ8J0XP5EFB16YBBHLABBI.lisa",
            "symbol": "LISA",
            "name": "Lisa",
            "balance": 13985,
            "decimals": 6,
            "usdValue": 0.12124519147203883
          },
          {
            "contractId": "SPJRESBV0Z8L6Y0BFMS2V296JHZL3NOJM88AMM4A.leo",
            "symbol": "LEO",
            "name": "Leo",
            "balance": 8963,
            "decimals": 8,
            "usdValue": 0.00006251556273212977
          },
          {
            "contractId": "SP0U4VL3141ZWC3AERQOGNJJGGGKSNEZHDGEWMTD.welsh",
            "symbol": "WELSH",
            "name": "Welsh",
            "balance": 13260,
            "decimals": 6,
            "usdValue": 0.11987188932701814
          },
          {
            "contractId": "SPPSXG7TJSDFXYH306NYV170P600AAEX9AKC3KY7.alex",
            "symbol": "ALEX",
            "name": "Alex",
            "balance": 5824,
            "decimals": 8,
            "usdValue": 0.00023452797744841677
          }
        ]
      },
      "transactions": [
        {
          "txId": "0x115bd735c10cc4c99403b8c678c3e5467068e5f49399b4bdc7063aa53f50b994",
          "timestamp": "2025-07-06T09:42:48.003Z",
          "type": "send",
          "amount": 970.2387688614541,
          "token": "DIKO",
          "status": "pending",
          "fee": 0.0023171682098765433
        },
        {
          "txId": "0xf1dad38ed1cfad2b8ba31e6be60fa6aa54b14541e22c2d7c856bd7d553475138",
          "timestamp": "2025-07-05T18:32:48.003Z",
          "type": "send",
          "amount": 456.6490912208505,
          "token": "ALEX",
          "status": "failed",
          "fee": 0.0042084490740740745
        },
        {
          "txId": "0xe597295a7d4967679572dd83e10248f84c3a0df1cc667526681fcd6713f4cae7",
          "timestamp": "2025-07-01T02:42:48.003Z",
          "type": "receive",
          "amount": 119.20524691358025,
          "token": "DIKO",
          "status": "confirmed",
          "fee": 0.008059104938271607,
          "blockHeight": 463692
        },
        {
          "txId": "0xfa4afba6b55b121654a3a34b9fc2955ac8983b0b8a76cfce816abbb141a74cba",
          "timestamp": "2025-06-29T23:46:48.003Z",
          "type": "contract-call",
          "amount": 1838.042266803841,
          "token": "USDA",
          "status": "pending",
          "fee": 0.006816705246913581
        },
        {
          "txId": "0x7710f154bce7c3abad1943779be9bdaec3b2a955ddc0e56278d9c6185530e3e0",
          "timestamp": "2025-06-25T13:19:48.003Z",
          "type": "receive",
          "amount": 225.45310356652948,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.003029976851851852,
          "blockHeight": 171658
        },
        {
          "txId": "0xda88b9fef6a065247d758777934403f5c1751f6424277155834e7c9730b09a9c",
          "timestamp": "2025-06-12T16:25:48.003Z",
          "type": "receive",
          "amount": 1227.8562242798353,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.009713387345679014,
          "blockHeight": 111759
        },
        {
          "txId": "0x1cdf60761f48e69b3dd1a9667b9e483abf2874625b6efb377cb111f6093e4f37",
          "timestamp": "2025-06-04T21:36:48.002Z",
          "type": "send",
          "amount": 203.59267832647464,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.006796797839506173,
          "blockHeight": 891859
        },
        {
          "txId": "0x0f88085d6eeba9bf6f49d0ba92f642d8965c72075cc57c89056c47991cdcd6e1",
          "timestamp": "2025-06-04T17:36:48.003Z",
          "type": "contract-call",
          "amount": 1427.3366769547324,
          "token": "ROOS",
          "status": "failed",
          "fee": 0.0016027391975308642,
          "memo": "Bot funding"
        },
        {
          "txId": "0xa77957b3e67329e6f37fbc1ccbcf339163bd27eed0d296e1f8df55ddff72c85b",
          "timestamp": "2025-05-30T21:08:48.003Z",
          "type": "send",
          "amount": 1098.4447873799727,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.00279945987654321
        },
        {
          "txId": "0x94c4360f52f03ad8628a7ad344bd87cfd7f36e2e5e78f60c42b56321a1c88b2e",
          "timestamp": "2025-05-30T05:41:48.002Z",
          "type": "receive",
          "amount": 935.4689643347051,
          "token": "STX",
          "status": "failed",
          "fee": 0.0068330246913580256
        },
        {
          "txId": "0xed24972a7e5ae25960691b1f061adc0d9addd4f186b0943e17b9383dc5dc690d",
          "timestamp": "2025-05-30T03:33:48.003Z",
          "type": "receive",
          "amount": 1077.4069787379972,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.0014081404320987654,
          "memo": "Staking reward"
        },
        {
          "txId": "0x9f010f62c1bd7290d613b1be8b7cbc30352476515c940699edc951c8dfd88a8e",
          "timestamp": "2025-05-20T13:16:48.002Z",
          "type": "send",
          "amount": 940.8363340192044,
          "token": "USDA",
          "status": "failed",
          "fee": 0.005613078703703704
        },
        {
          "txId": "0x4473e6c997d8a18bb11294d791187e635bfcdfa4a65877e2140a158aa265fdc5",
          "timestamp": "2025-05-18T13:21:48.003Z",
          "type": "deploy",
          "amount": 708.5815329218108,
          "token": "USDA",
          "status": "failed",
          "fee": 0.007420331790123458,
          "memo": "Staking reward"
        },
        {
          "txId": "0x900223b1ac4da22d11b8eae22939076a5fd4b0b19080a5bf006077a5673cc5f0",
          "timestamp": "2025-05-16T15:57:48.003Z",
          "type": "contract-call",
          "amount": 609.7127914951989,
          "token": "USDA",
          "status": "failed",
          "fee": 0.006456635802469137
        },
        {
          "txId": "0x3922f8dffcfd459c9bc17a36b7e8267c3ece47c0548dd34d82cedfbce56031ad",
          "timestamp": "2025-05-15T16:17:48.003Z",
          "type": "deploy",
          "amount": 674.4388717421125,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.006221566358024692
        },
        {
          "txId": "0x11c2ce66525ad02dd5b48bb359bf391220ce3622962a0b17331186b7b858fa36",
          "timestamp": "2025-05-15T02:02:48.003Z",
          "type": "deploy",
          "amount": 1678.878172153635,
          "token": "DIKO",
          "status": "pending",
          "fee": 0.0037016589506172846,
          "memo": "Trading profit"
        },
        {
          "txId": "0x323118c45c3f54e1e7483587c4af525f84a03d28e4b4e25538065710fa208103",
          "timestamp": "2025-05-03T21:49:48.002Z",
          "type": "contract-call",
          "amount": 589.4894547325102,
          "token": "USDA",
          "status": "pending",
          "fee": 0.0013839891975308642,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0xf5a41a34834ba8ae7b774bfe15df19c99f43f7d1b0d60ad5e96ff95756618423",
          "timestamp": "2025-05-02T11:35:48.003Z",
          "type": "receive",
          "amount": 1095.8303326474622,
          "token": "STX",
          "status": "confirmed",
          "fee": 0.008856520061728396,
          "blockHeight": 539498,
          "memo": "Trading profit"
        },
        {
          "txId": "0x3c19a95f7e42bfe26490a83767183f6c7691e137c35e900af7f8bc22a33e34f7",
          "timestamp": "2025-04-30T22:17:48.003Z",
          "type": "send",
          "amount": 1554.0847908093278,
          "token": "USDA",
          "status": "pending",
          "fee": 0.005434606481481482,
          "memo": "Yield farming reward"
        },
        {
          "txId": "0x776b30184fcab69de6a8abda43ce19ec6bdad9c9726e4b47f129ade7d6fa77a8",
          "timestamp": "2025-04-29T03:36:48.003Z",
          "type": "deploy",
          "amount": 907.1090534979423,
          "token": "DIKO",
          "status": "confirmed",
          "fee": 0.0010968364197530864,
          "blockHeight": 357743
        },
        {
          "txId": "0xca6b4e1315c7e651837984f911d46c34c523078c920e81f06116a193731bda2c",
          "timestamp": "2025-04-27T03:31:48.003Z",
          "type": "receive",
          "amount": 924.0582133058984,
          "token": "ALEX",
          "status": "failed",
          "fee": 0.005848418209876543
        },
        {
          "txId": "0x0086ae55638899acf430b44670d1c5be69d64fc1be793ee2b115973cbc247179",
          "timestamp": "2025-04-27T00:42:48.003Z",
          "type": "send",
          "amount": 1898.5982510288065,
          "token": "ROOS",
          "status": "failed",
          "fee": 0.006710030864197532,
          "memo": "Staking reward"
        },
        {
          "txId": "0x4539b6533d41766cea142dd671c56bf4aa0ed100e58e4d7450c6028dc1e38ab3",
          "timestamp": "2025-04-26T06:26:48.003Z",
          "type": "receive",
          "amount": 932.1459190672153,
          "token": "LISA",
          "status": "pending",
          "fee": 0.0063728395061728406
        },
        {
          "txId": "0x2b6032ddd0fd1094772af117715c11590afb1861da04c633817e5de5cf8c862e",
          "timestamp": "2025-04-24T02:32:48.003Z",
          "type": "receive",
          "amount": 512.8720850480111,
          "token": "USDA",
          "status": "failed",
          "fee": 0.006766435185185186
        },
        {
          "txId": "0x4480ba7521974ee8af25095940fada130097e471d609b2fcc7075e92d842a158",
          "timestamp": "2025-04-21T07:20:48.003Z",
          "type": "contract-call",
          "amount": 244.55246913580245,
          "token": "ROOS",
          "status": "failed",
          "fee": 0.004902854938271605
        },
        {
          "txId": "0xd1506ee37ef66f2ec1bca5451d78c7e9bc9c84e81a355086514a554c1ace4c27",
          "timestamp": "2025-04-21T02:22:48.003Z",
          "type": "receive",
          "amount": 546.7704046639232,
          "token": "DIKO",
          "status": "confirmed",
          "fee": 0.007269598765432099,
          "blockHeight": 544000
        },
        {
          "txId": "0x151b1d38cf1361ae0705105f68694fe0fd3dd3047f86f1695e2b5291e68e9379",
          "timestamp": "2025-04-20T05:41:48.003Z",
          "type": "send",
          "amount": 961.0270919067216,
          "token": "ALEX",
          "status": "pending",
          "fee": 0.007592978395061729
        },
        {
          "txId": "0x2fef3acf009517261d6ec7370827274aad538b9d121f4db75c12889741ec2541",
          "timestamp": "2025-04-19T05:19:48.003Z",
          "type": "send",
          "amount": 438.7307098765432,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.004197646604938272,
          "blockHeight": 821296
        },
        {
          "txId": "0xcfe8cc80d4292879acfd0c8963f336a07209290f3524e032167a4424f1c0d4dc",
          "timestamp": "2025-04-18T19:46:48.003Z",
          "type": "send",
          "amount": 274.98113854595334,
          "token": "LISA",
          "status": "pending",
          "fee": 0.004528472222222223
        },
        {
          "txId": "0x871cf640852c5cbc4911fa93d4b17eea39409ad53f47ddbf57a4160180b9b8e7",
          "timestamp": "2025-04-16T18:35:48.003Z",
          "type": "deploy",
          "amount": 1770.7343106995884,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.007201581790123457,
          "memo": "Bot funding"
        },
        {
          "txId": "0xa1bb8e949cb195d775d9e220c712f7b2ad60f107a0d8772cce513af70c2fd9cb",
          "timestamp": "2025-04-13T12:09:48.003Z",
          "type": "receive",
          "amount": 597.9925411522634,
          "token": "STX",
          "status": "failed",
          "fee": 0.007590933641975309
        }
      ],
      "connectionMethod": "xverse"
    },
    "preferences": {
      "sidebarCollapsed": false,
      "theme": "light",
      "skin": "default",
      "language": "de",
      "timezone": "Europe/Berlin",
      "dateFormat": "US",
      "numberFormat": "US"
    }
  },
  "bots": {
    "list": [
      {
        "id": "SP3N8VZKGYNJKKZJ3ZFWV2SSHBJ6CFDYK6FR4ZJ1K",
        "name": "Raticate",
        "strategy": "// Basic trading strategy\nconsole.log('Checking trading opportunities...');\nconsole.log('Bot wallet:', bot.id);",
        "status": "active",
        "ownerId": "SP3N8VZKGYNJKKZJ3ZFWV2SSHBJ6CFDYK6FR4ZJ1K",
        "createdAt": "2025-05-26T21:44:48.442Z",
        "lastActive": "2025-07-12T09:12:48.442Z",
        "encryptedWallet": "2fee60e772b523e66c491d5fbfbde72e8d6955a374f5229d8ef64d03a685b6a45ac4002be425a1ccbf419433f9fc019b138987d73d1c6fff0dda3f74ff2167258f32b7cb6f82c727d491297e93475f69",
        "walletIv": "f74a7406a050a01b3cc6988e607524b3",
        "publicKey": "03d7ce45ed9c0d7d861319be5bd018415f294977d454de7533ae51d6cc631564e9",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/20.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP1CX6CQ712AES6NVGAR2RJ8QC6VVYRVYC1ZQP825",
        "name": "Horsea",
        "strategy": "console.log('Hello from bot:', bot.name);\nconsole.log('Bot wallet address:', bot.id);",
        "status": "active",
        "ownerId": "SP1CX6CQ712AES6NVGAR2RJ8QC6VVYRVYC1ZQP825",
        "createdAt": "2025-06-06T06:01:48.535Z",
        "lastActive": "2025-07-11T00:27:48.535Z",
        "encryptedWallet": "f364c035a24536b273aebc30e152b8ed3f4c3ccf8ac3de3a376223078f078deba619d2b16a7c0b5f58c08716f153e4a74d6e6ffb840808ed45dba63f0f669e1d18fd486f8f4d63447559ae7f7488097b",
        "walletIv": "10c0e80789f052f7d9b2086c77ad73a7",
        "publicKey": "020a77eb5345375970823fa1de956274b008900090bbd3be987de21a217dcfbba7",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/116.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SPBXB8QX8DFZB9ZEER03WEDQ29K0F96N5MFR46VY",
        "name": "Articuno",
        "strategy": "// Basic trading strategy\nconsole.log('Checking trading opportunities...');\nconsole.log('Bot wallet:', bot.id);",
        "status": "setup",
        "ownerId": "SPBXB8QX8DFZB9ZEER03WEDQ29K0F96N5MFR46VY",
        "createdAt": "2025-04-19T09:40:48.620Z",
        "lastActive": "2025-07-12T21:19:48.620Z",
        "encryptedWallet": "d272c24339ec583b94d1ea043c66db1eed715880669db1a76afabc460fd7e80a8a235a36ea795141c742dec619ada62da26b71de817f8a2e1518cdb14cac972d8d1c40cd8f6dc3b28c9e3c474b14b2ee",
        "walletIv": "5d46720343f7138296c47cc046efc461",
        "publicKey": "024a1b5a874807605833575f501c6c7d2411e9f656adb7111d32e42a785731f0e9",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/144.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP21NDEHY42VPNMC11Y4E7S96TX93P6E9K9VQR4GB",
        "name": "Tentacruel",
        "strategy": "// Simple monitoring strategy\nconsole.log('Monitoring market conditions...');\nconsole.log('Bot status:', bot.status);",
        "status": "active",
        "ownerId": "SP21NDEHY42VPNMC11Y4E7S96TX93P6E9K9VQR4GB",
        "createdAt": "2025-07-08T07:46:48.705Z",
        "lastActive": "2025-07-11T06:48:48.705Z",
        "encryptedWallet": "2b12447c9260cccd9ea65dcd84a5937549bef05b8235fd3c2ae70f017041cbf1f99d8f6852a19d45f3a875166ff1e3c7d265c7cd6eadf08ea36213af8b4bdca72f18faca2d199934e7b0665b9311ece1",
        "walletIv": "1bf5942448ad4c541d8b8f9a9f166d53",
        "publicKey": "029ff1c060f7aef34f66d432c905431f8383ce154e05bd991c6226c2eab3834433",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/73.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SPNCX81FVBV3KS6HTQTY1SV96NK99XGJ788X5NA8",
        "name": "Diglett",
        "strategy": "// Simple monitoring strategy\nconsole.log('Monitoring market conditions...');\nconsole.log('Bot status:', bot.status);",
        "status": "setup",
        "ownerId": "SPNCX81FVBV3KS6HTQTY1SV96NK99XGJ788X5NA8",
        "createdAt": "2025-07-04T00:38:48.790Z",
        "lastActive": "2025-07-12T16:24:48.790Z",
        "encryptedWallet": "51725db99ed2fe78f05898afee9df6345a3699d52df9f543ac939ddee051c6aedf6841b75dfd6d227563661deb6f78b5c9e8295e811e21951e25f8c237ce0d82a1d5062ca30ad0188469e8fbb01845bd",
        "walletIv": "a3258af5acbfe1921d3912399802a82a",
        "publicKey": "0360bfbe35d60a07d9b57298f1c23d007c07028aebd35f7b4c00c68fcb88ac7d6f",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/50.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP2BPPW28KE5VM8T1SZHYM8FWM7VEPK02W1RYXTBC",
        "name": "Machop",
        "strategy": "console.log('Hello from bot:', bot.name);\nconsole.log('Bot wallet address:', bot.id);",
        "status": "paused",
        "ownerId": "SP2BPPW28KE5VM8T1SZHYM8FWM7VEPK02W1RYXTBC",
        "createdAt": "2025-04-15T10:47:48.874Z",
        "lastActive": "2025-07-12T00:14:48.874Z",
        "encryptedWallet": "da2bffb1f7da7e72caceb88b31a2802ba1fe6093aec4f97799b2dfafcb1762061d836d47e5285e43bf4d9f4d3683ca85942f3acaf073ae89ae45cf05f6c54832c377a440904330deaab80fbe9def9a83",
        "walletIv": "192a1c895e915220ed1ee23647f698af",
        "publicKey": "020e14c6be296bbe41bee8caecfc11711575bfb3937df48ac860f35f478ace4ad0",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/66.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP28GCWMQN9M8EDFYH32D1G1FT9Y0PF0JS09SB993",
        "name": "Ekans",
        "strategy": "console.log('Hello from bot:', bot.name);\nconsole.log('Bot wallet address:', bot.id);",
        "status": "paused",
        "ownerId": "SP28GCWMQN9M8EDFYH32D1G1FT9Y0PF0JS09SB993",
        "createdAt": "2025-05-02T23:50:48.958Z",
        "lastActive": "2025-07-11T18:45:48.958Z",
        "encryptedWallet": "3662db96216321cadaadae15ec9d8e6069d72b01cb20f9c9ecb4abb7eb64c572737d0ef5797235465afa96847da0f38f926eb3755e12773b8d8fc33186154f19aeb9bf97363887106c7d10bcc72a18a8",
        "walletIv": "92aa47457eb6d5821f857cb0191c4cd6",
        "publicKey": "03248028e3d34ddc2fe03a073335ab7fb37d82ed818bccc108dc39b4dd330130dc",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/23.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP1ZFA9R0GQYWP3C52EEDPBN7Y2AA901KFQ3J7097",
        "name": "Diglett",
        "strategy": "console.log('Hello from bot:', bot.name);\nconsole.log('Bot wallet address:', bot.id);",
        "status": "setup",
        "ownerId": "SP1ZFA9R0GQYWP3C52EEDPBN7Y2AA901KFQ3J7097",
        "createdAt": "2025-05-30T04:07:49.043Z",
        "lastActive": "2025-07-12T03:35:49.043Z",
        "encryptedWallet": "a91b3f154da4f321a4a34d7a4ec520eab348d35a2763a8d205c6ecd5439d481736c9b51c6f56e31785bf810721a3603808dd1b58d48f45589ff6c1d97b7a47cc7d9c015d8bc839d16166fbae24a9580b",
        "walletIv": "e01e4d412c49f53567aff38d135bda26",
        "publicKey": "02a921ade4ab9a88367fb382374141825ffb5b9a54db5b343fdb72fd8597f7735a",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/50.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP252VHN0KS8Z59DEKDK2CZAPAG99TVXXHQ4CWZ4N",
        "name": "Spearow",
        "strategy": "console.log('Hello from bot:', bot.name);\nconsole.log('Bot wallet address:', bot.id);",
        "status": "paused",
        "ownerId": "SP252VHN0KS8Z59DEKDK2CZAPAG99TVXXHQ4CWZ4N",
        "createdAt": "2025-05-03T13:02:49.128Z",
        "lastActive": "2025-07-11T12:36:49.128Z",
        "encryptedWallet": "f9b92dffa71d737752617e3a84debc8977e7a96c8b12cff5fb44699aff3e5eb31080a0099716d978ecbb4d1ead90a5201dd3a0759a3435e582517ab12171bdfb18030d9a3cda1ea78728089e77278ecc",
        "walletIv": "5892441035842fdfcb4eeb2b878ec788",
        "publicKey": "0225ef8adb4c9267007b5b10349b5fa14006dc30effb2dcefd17a18e83df4b4b90",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/21.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      },
      {
        "id": "SP2ARJ8QC9GEK6F7444TZR9GEYMHZYHXRK37NNVK8",
        "name": "Tentacool",
        "strategy": "console.log('Hello from bot:', bot.name);\nconsole.log('Bot wallet address:', bot.id);",
        "status": "setup",
        "ownerId": "SP2ARJ8QC9GEK6F7444TZR9GEYMHZYHXRK37NNVK8",
        "createdAt": "2025-07-05T13:35:49.221Z",
        "lastActive": "2025-07-12T11:43:49.221Z",
        "encryptedWallet": "ea76e9e315fd2aa4bca75badcc2f38c89607404290d3ac39012bc24c2eaac242bbba1801641abb124ed75fce4484eb498c7ff9193ecdcbcb6c253e664689d33dda73766f571890df6e97f6c4833b771c",
        "walletIv": "0fe43316a9116ae4e2cedc9f5ea42a8e",
        "publicKey": "0359ed6298a422a60156dfb46a2f15ab114881abfd8ee46db39be5d4633924eadf",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/72.png",
        "imageType": "pokemon",
        "isScheduled": false,
        "executionCount": 0
      }
    ],
    "stats": {
      "totalBots": 10,
      "activeBots": 3,
      "pausedBots": 3,
      "errorBots": 0
    }
  },
  "notifications": [
    {
      "id": "notification-556998",
      "type": "success",
      "title": "Bot started successfully",
      "message": "Collected 5.2 CHA tokens in farming rewards",
      "timestamp": "2025-06-30T16:53:49.222Z",
      "read": true,
      "persistent": false,
      "actionUrl": "http://localhost:3420/settings"
    },
    {
      "id": "notification-723190",
      "type": "error",
      "title": "Insufficient balance",
      "message": "Bot encountered an error and has been paused",
      "timestamp": "2025-06-30T02:19:49.222Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-363163",
      "type": "success",
      "title": "Settings updated",
      "message": "Added 250 STX to liquidity pool",
      "timestamp": "2025-06-28T00:20:49.222Z",
      "read": true,
      "persistent": true
    },
    {
      "id": "notification-899324",
      "type": "error",
      "title": "Network connection lost",
      "message": "Unable to connect to RPC endpoint",
      "timestamp": "2025-06-23T08:15:49.222Z",
      "read": false,
      "persistent": false,
      "actionUrl": "http://localhost:3420/analytics"
    },
    {
      "id": "notification-560354",
      "type": "success",
      "title": "LP tokens staked",
      "message": "Added 250 STX to liquidity pool",
      "timestamp": "2025-06-20T15:39:49.221Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-752754",
      "type": "error",
      "title": "Bot execution failed",
      "message": "Unable to connect to RPC endpoint",
      "timestamp": "2025-06-17T08:12:49.221Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-406253",
      "type": "error",
      "title": "Bot execution failed",
      "message": "Bot encountered an error and has been paused",
      "timestamp": "2025-06-03T09:41:49.222Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-971246",
      "type": "warning",
      "title": "High slippage detected",
      "message": "Less than 10 STX remaining in wallet",
      "timestamp": "2025-05-31T21:17:49.221Z",
      "read": true,
      "persistent": false,
      "actionUrl": "http://localhost:3420/analytics"
    },
    {
      "id": "notification-862299",
      "type": "success",
      "title": "Bot started successfully",
      "message": "Collected 5.2 CHA tokens in farming rewards",
      "timestamp": "2025-05-26T23:25:49.222Z",
      "read": false,
      "persistent": false,
      "actionUrl": "http://localhost:3420/settings"
    },
    {
      "id": "notification-105868",
      "type": "info",
      "title": "Price alert triggered",
      "message": "New STX-ALEX pool offers 25% APR",
      "timestamp": "2025-05-24T05:39:49.222Z",
      "read": true,
      "persistent": true,
      "actionUrl": "http://localhost:3420/wallet"
    },
    {
      "id": "notification-579610",
      "type": "info",
      "title": "New token listing detected",
      "message": "STX price increased by 15% in last hour",
      "timestamp": "2025-05-07T10:55:49.222Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-166450",
      "type": "success",
      "title": "Settings updated",
      "message": "Collected 5.2 CHA tokens in farming rewards",
      "timestamp": "2025-05-06T16:42:49.222Z",
      "read": false,
      "persistent": true
    },
    {
      "id": "notification-487642",
      "type": "success",
      "title": "Trade executed",
      "message": "Collected 5.2 CHA tokens in farming rewards",
      "timestamp": "2025-04-21T05:37:49.221Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-700362",
      "type": "warning",
      "title": "Wallet balance low",
      "message": "Approaching 80% of hourly API limit",
      "timestamp": "2025-04-13T09:16:49.221Z",
      "read": false,
      "persistent": false
    }
  ]
} as const;
