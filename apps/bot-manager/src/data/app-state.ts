import { type AppState } from '@/schemas/app-state.schema';

/**
 * Generated application state data
 * Created with proper TypeScript types for compile-time safety
 */
export const appState: AppState = {
  "metadata": {
    "version": "1.0.0",
    "generatedAt": "2025-07-10T08:49:36.941Z",
    "seed": 12345,
    "profile": "testing",
    "botCount": 5,
    "realistic": false
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
        "rpcEndpoint": "https://stacks-node-api.testnet.stacks.co"
      },
      "botDefaults": {
        "defaultStrategy": "dca"
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
        "apiKey": "sk-37a3867f552c494a93fae81ed784144573c98b1b",
        "autoLockTimeout": "30",
        "requireConfirmation": true
      },
      "advanced": {
        "debugMode": false,
        "performanceMonitoring": true
      }
    },
    "wallet": {
      "isConnected": true,
      "address": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
      "network": "devnet",
      "balance": {
        "stx": 178.3619255829904,
        "tokens": [
          {
            "contractId": "SP6T0M95QUKXYOM2W8JN6UCUCDPH75P7KDUEXH3S.stx",
            "symbol": "STX",
            "name": "Stacks",
            "balance": 148,
            "decimals": 6,
            "usdValue": 0.0008650826224717767
          },
          {
            "contractId": "SPIL2R9COFLOI78XNQ3ALEK7BW17PGJEWOET24K4.stx",
            "symbol": "STX",
            "name": "Stacks",
            "balance": 78,
            "decimals": 6,
            "usdValue": 0.0007763144223501086
          },
          {
            "contractId": "SPEBWR5GJIC3SZWGRBW5SIIQRBK0XPPSK9BK3X3M.welsh",
            "symbol": "WELSH",
            "name": "Welsh",
            "balance": 61,
            "decimals": 6,
            "usdValue": 0.00003474175692572323
          },
          {
            "contractId": "SP2JFF8JJ5ZSQ8NCNHFPRERUO96ON6SA9HMU52C6.pepe",
            "symbol": "PEPE",
            "name": "Pepe",
            "balance": 61,
            "decimals": 8,
            "usdValue": 2.1234079990439616e-7
          },
          {
            "contractId": "SPXR37HS8TJH4SBVW7FAI8FOPP49J9BBIAIALH0N.alex",
            "symbol": "ALEX",
            "name": "Alex",
            "balance": 16,
            "decimals": 8,
            "usdValue": 0.000001126103726089773
          },
          {
            "contractId": "SPJXNFYFSMN1AOLEYVDWAMX9KG6MWI7OMQ7YMVY9.stx",
            "symbol": "STX",
            "name": "Stacks",
            "balance": 172,
            "decimals": 6,
            "usdValue": 0.0002722581846141552
          }
        ]
      },
      "transactions": [
        {
          "txId": "0xf7e9796c5cc91ebc8341700e6bddadb247b79af681595c6045a1cac25ae326bb",
          "timestamp": "2025-07-10T01:55:36.942Z",
          "type": "contract-call",
          "amount": 3.424682784636488,
          "token": "ALEX",
          "status": "pending",
          "fee": 0.007653703703703704
        },
        {
          "txId": "0x124320fd59a8bf0944aeb64c2ec6139570ff2827565d227c59c5a891674e6b6c",
          "timestamp": "2025-07-09T22:15:36.943Z",
          "type": "contract-call",
          "amount": 14.578630829903979,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.0015065972222222223,
          "blockHeight": 776265,
          "memo": "Staking reward"
        },
        {
          "txId": "0x65f5036d7e524cafb668df85045124988de858a6069a23e4c349f7286d651fd4",
          "timestamp": "2025-07-09T21:33:36.942Z",
          "type": "deploy",
          "amount": 12.803245027434844,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.009082291666666669
        },
        {
          "txId": "0xbc6b4d8558641e2b35cc3bf3e4dc15cd45e0caf9a9323fb56a5d7aa7a63d6f81",
          "timestamp": "2025-07-09T21:15:36.942Z",
          "type": "deploy",
          "amount": 5.680036865569273,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.009217399691358028
        },
        {
          "txId": "0x07fc57c8167509936332b86697dcd48e43125c5365557122e1e3af64fd420205",
          "timestamp": "2025-07-09T17:37:36.942Z",
          "type": "send",
          "amount": 7.724361282578875,
          "token": "LEO",
          "status": "failed",
          "fee": 0.003204282407407408,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0x41009fa6691c5e8370a0c101ff6b23a1d43cfd5261465b38e313d628e1b06c29",
          "timestamp": "2025-07-09T17:34:36.942Z",
          "type": "contract-call",
          "amount": 3.570961934156379,
          "token": "LISA",
          "status": "pending",
          "fee": 0.001297067901234568,
          "memo": "Yield farming reward"
        },
        {
          "txId": "0xca3ba47eb6ceea5515456fedf339ac5a1998bf7215679c89b8da1a08743cbaed",
          "timestamp": "2025-07-08T22:45:36.942Z",
          "type": "contract-call",
          "amount": 5.688425925925926,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.0011056327160493828,
          "blockHeight": 439178
        },
        {
          "txId": "0x04037e1c10af78edb68cdf0a9f3befe4589cf39984f0460f40b1604943fd403e",
          "timestamp": "2025-07-08T13:49:36.943Z",
          "type": "contract-call",
          "amount": 2.9398276748971193,
          "token": "ROOS",
          "status": "confirmed",
          "fee": 0.006123109567901235,
          "blockHeight": 694398
        },
        {
          "txId": "0x0e68431840f1e20f58c1fbbd2a786544dcb6737d152c9fb895980313dd5d1c94",
          "timestamp": "2025-07-08T10:17:36.943Z",
          "type": "deploy",
          "amount": 19.19188100137174,
          "token": "PEPE",
          "status": "pending",
          "fee": 0.008326080246913581
        },
        {
          "txId": "0xba0e3104c94808aa7af9e53e3df0d92b20b016bb295516694c86e52270f36b1a",
          "timestamp": "2025-07-08T05:39:36.943Z",
          "type": "send",
          "amount": 17.441010802469133,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.003380979938271605
        },
        {
          "txId": "0xda557e1619c321b4b0519bacecf4ea4644c2b6c0a8a0cee14ab3c20ad4a24487",
          "timestamp": "2025-07-07T18:57:36.943Z",
          "type": "contract-call",
          "amount": 17.134280692729767,
          "token": "USDA",
          "status": "pending",
          "fee": 0.003059760802469136
        },
        {
          "txId": "0x3c046fbee0b3837bdf012c477d48314c3301b5331e2baeacf5d9125729c4c7e4",
          "timestamp": "2025-07-07T17:03:36.943Z",
          "type": "contract-call",
          "amount": 1.2150205761316872,
          "token": "CHA",
          "status": "confirmed",
          "fee": 0.005597762345679012,
          "blockHeight": 768946
        },
        {
          "txId": "0x8d5ea0db7a92e97e3d1cadd6aa6ec20806578aebea6741d1148e60e707ee1302",
          "timestamp": "2025-07-07T08:44:36.942Z",
          "type": "contract-call",
          "amount": 16.355075445816183,
          "token": "LEO",
          "status": "failed",
          "fee": 0.0017323302469135803,
          "memo": "Trading profit"
        },
        {
          "txId": "0x8043dba3349276fc017df06fd0862002f28a499be2fbc69d7dc8e104164305e5",
          "timestamp": "2025-07-06T22:18:36.942Z",
          "type": "contract-call",
          "amount": 18.701487482853224,
          "token": "WELSH",
          "status": "failed",
          "fee": 0.008218788580246914
        },
        {
          "txId": "0xd8f93fef3331f4f8b45d6c1d5f06b45e0aebb1defabdb835b70c02042fb60a58",
          "timestamp": "2025-07-06T21:08:36.942Z",
          "type": "contract-call",
          "amount": 12.294933127572017,
          "token": "USDA",
          "status": "failed",
          "fee": 0.009873919753086421
        },
        {
          "txId": "0x22c82eb881af3da59105997a86a280052627c76aa542b26fbb85ab8818cefdb1",
          "timestamp": "2025-07-06T08:10:36.943Z",
          "type": "receive",
          "amount": 3.945048868312757,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.004293711419753087,
          "memo": "Trading profit"
        },
        {
          "txId": "0xa902f852a98c485d8bbf55491ef62da8947bc58789c821bcf7ca49b8b7a7504c",
          "timestamp": "2025-07-05T19:12:36.942Z",
          "type": "receive",
          "amount": 3.7545438957475996,
          "token": "PEPE",
          "status": "failed",
          "fee": 0.002559953703703704
        },
        {
          "txId": "0x5b331253f171f3d50b92231894311b3f644ac8f20bb45fa359d288edbfeec36c",
          "timestamp": "2025-07-05T17:06:36.942Z",
          "type": "receive",
          "amount": 4.4349537037037035,
          "token": "LISA",
          "status": "pending",
          "fee": 0.004261882716049383,
          "memo": "Bot funding"
        },
        {
          "txId": "0x6bafc168915a7abfd2066fbd42e631a3a9b28ffd881b29f6cc9172e78b31d25b",
          "timestamp": "2025-07-05T10:48:36.942Z",
          "type": "deploy",
          "amount": 14.260579561042524,
          "token": "PEPE",
          "status": "confirmed",
          "fee": 0.008462422839506174,
          "blockHeight": 289672
        },
        {
          "txId": "0x9fffe4e71d2d15f38c80c7557defed50bf9b507eb4f1909c7a5a9a2e1302543f",
          "timestamp": "2025-07-04T23:07:36.942Z",
          "type": "contract-call",
          "amount": 4.949618484224966,
          "token": "PEPE",
          "status": "pending",
          "fee": 0.0052788194444444445,
          "memo": "Trading profit"
        },
        {
          "txId": "0x9a00821c12e6a36038a43fed66e63b4cc9889d4d27be9970e420c6743a50e53a",
          "timestamp": "2025-07-04T12:23:36.942Z",
          "type": "contract-call",
          "amount": 13.060618141289439,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.004352353395061729
        },
        {
          "txId": "0x18931d3e9772520569c93237e99530f753cc69d03f7372ed8b8f1ee75c25fb4e",
          "timestamp": "2025-07-04T10:31:36.942Z",
          "type": "contract-call",
          "amount": 10.19335133744856,
          "token": "WELSH",
          "status": "confirmed",
          "fee": 0.001086766975308642,
          "blockHeight": 892152
        },
        {
          "txId": "0x53fca033f043a448a70d382f822612a868d595539dcf3bdf7b77e21d6cf9eb4e",
          "timestamp": "2025-07-03T21:21:36.942Z",
          "type": "deploy",
          "amount": 11.186436899862827,
          "token": "LISA",
          "status": "pending",
          "fee": 0.0033025462962962965
        },
        {
          "txId": "0x735e73254b5efd754630318232c3675a914aecf2803e395fa5ac3c77a26c188e",
          "timestamp": "2025-07-03T04:41:36.943Z",
          "type": "send",
          "amount": 5.725240054869684,
          "token": "USDA",
          "status": "pending",
          "fee": 0.008586033950617284
        },
        {
          "txId": "0x12dfaeb2bafa493e5c0cb0375085c38c0374e47f9fde4f8baeb78bbb2df64ae7",
          "timestamp": "2025-07-03T04:41:36.942Z",
          "type": "receive",
          "amount": 3.9944873113854595,
          "token": "STX",
          "status": "confirmed",
          "fee": 0.007868055555555555,
          "blockHeight": 968661
        },
        {
          "txId": "0xb9b025f67db819e250785573591c45217c4d25e9afab9ad217f419b05ccbeb07",
          "timestamp": "2025-07-02T23:42:36.942Z",
          "type": "deploy",
          "amount": 6.008106138545953,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.00961354166666667
        },
        {
          "txId": "0xd099f5fcc8d4a94b622c6626ed90453e0d33572336bc46a4a3bee271de358bfc",
          "timestamp": "2025-07-02T18:44:36.942Z",
          "type": "send",
          "amount": 19.131691529492453,
          "token": "ALEX",
          "status": "confirmed",
          "fee": 0.001691087962962963,
          "blockHeight": 471103
        },
        {
          "txId": "0xa73fa6bdb6687c53672a5ae72a214ed31de18b6406868b1239b65adb5d14c0c3",
          "timestamp": "2025-07-02T12:05:36.942Z",
          "type": "receive",
          "amount": 16.05559413580247,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.004974729938271605,
          "blockHeight": 886504,
          "memo": "Trading profit"
        },
        {
          "txId": "0x6441fc2cef31fac97532351c4a775c68f799f0072b57ff65c4239dacd8284365",
          "timestamp": "2025-07-01T00:51:36.942Z",
          "type": "contract-call",
          "amount": 7.59738511659808,
          "token": "ROOS",
          "status": "confirmed",
          "fee": 0.001556172839506173,
          "blockHeight": 986547,
          "memo": "Trading profit"
        },
        {
          "txId": "0xcd68bc62eb91f6c8f7dc75346b47bdf974b8da71aa6382c8eb0f68c65bff49bc",
          "timestamp": "2025-06-30T06:31:36.943Z",
          "type": "send",
          "amount": 15.037911522633745,
          "token": "ALEX",
          "status": "pending",
          "fee": 0.007756558641975309
        },
        {
          "txId": "0xf2a0175b15705cbe176cb34ebf874dbb6088b5b45502d8090801f90ca46a4307",
          "timestamp": "2025-06-29T19:34:36.943Z",
          "type": "deploy",
          "amount": 14.547762345679013,
          "token": "ALEX",
          "status": "failed",
          "fee": 0.0032188271604938275,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0x751eae787a73de9730dcd828e984a339f0f4328191297db17338b77719e96854",
          "timestamp": "2025-06-29T00:08:36.942Z",
          "type": "send",
          "amount": 13.787127057613167,
          "token": "ROOS",
          "status": "pending",
          "fee": 0.007177970679012347
        },
        {
          "txId": "0x9ad34e2f8b21741bbeeee748c344266778ad21e92245ebfa49c47b42dafac571",
          "timestamp": "2025-06-28T13:56:36.942Z",
          "type": "send",
          "amount": 15.641842421124828,
          "token": "LISA",
          "status": "confirmed",
          "fee": 0.0011861496913580247,
          "blockHeight": 628016
        },
        {
          "txId": "0xbbdd50a6396b1b17ca40dcd18bdee74f514fb4ca515e61515288b42697bf0fd2",
          "timestamp": "2025-06-28T02:36:36.942Z",
          "type": "receive",
          "amount": 14.340234910836763,
          "token": "PEPE",
          "status": "failed",
          "fee": 0.0041390432098765435,
          "memo": "Staking reward"
        },
        {
          "txId": "0x35344f63016fc51b8d83a7ee001af8a3b801b0f97c8c00717e5483db29e9f7e6",
          "timestamp": "2025-06-27T11:19:36.942Z",
          "type": "receive",
          "amount": 18.272423696844992,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.0030711033950617285
        },
        {
          "txId": "0xa2578facab4c09cff0fff8e0f39b513afeaa3b773f296a456a2c3255e56c3d27",
          "timestamp": "2025-06-27T02:31:36.942Z",
          "type": "receive",
          "amount": 3.4580761316872426,
          "token": "WELSH",
          "status": "confirmed",
          "fee": 0.005160262345679013,
          "blockHeight": 650196,
          "memo": "Staking reward"
        },
        {
          "txId": "0x5594551ba3de24734de668f996d727a9f73b563b8c00ea5f0e5908b4edfe68eb",
          "timestamp": "2025-06-27T00:54:36.942Z",
          "type": "deploy",
          "amount": 9.461548353909464,
          "token": "USDA",
          "status": "failed",
          "fee": 0.004254012345679013,
          "memo": "Staking reward"
        },
        {
          "txId": "0xa6d787aedbe50051a632cd0f7a66672b9113ada37734e1c935c07ef777ccdd5a",
          "timestamp": "2025-06-26T06:19:36.943Z",
          "type": "send",
          "amount": 2.716662379972565,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.002591473765432099
        },
        {
          "txId": "0x90ee234d2273f7d146f540ffabd4e55fd26c4791bbf8744597c26289d0652404",
          "timestamp": "2025-06-26T05:54:36.942Z",
          "type": "deploy",
          "amount": 12.44593621399177,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.007862114197530865
        },
        {
          "txId": "0x332af8ac2b05129694ecc0094e10bbbfdbfe725508dff55f3a0f37f8d9f64fb8",
          "timestamp": "2025-06-26T05:18:36.942Z",
          "type": "receive",
          "amount": 18.449408436213993,
          "token": "ALEX",
          "status": "pending",
          "fee": 0.006955864197530865,
          "memo": "Bot funding"
        },
        {
          "txId": "0x5ffe81e7fe124ee65cbb1a8493cf1f4a5c430615763d7ffb24a12a301e56b71e",
          "timestamp": "2025-06-26T01:37:36.942Z",
          "type": "send",
          "amount": 16.44597050754458,
          "token": "CHA",
          "status": "confirmed",
          "fee": 0.009608719135802472,
          "blockHeight": 859857
        },
        {
          "txId": "0xf7161f9b80a516a350cec47507385b2745457350bb61cfe026d62a28ebefab44",
          "timestamp": "2025-06-26T01:15:36.942Z",
          "type": "receive",
          "amount": 7.955752743484226,
          "token": "DIKO",
          "status": "failed",
          "fee": 0.0015777777777777778
        },
        {
          "txId": "0x3bc3ad7a640c1386af8c8ffa0ac444038be0cb392699137ad27f01eac1400741",
          "timestamp": "2025-06-26T00:01:36.942Z",
          "type": "send",
          "amount": 11.503429355281208,
          "token": "LEO",
          "status": "confirmed",
          "fee": 0.006545293209876544,
          "blockHeight": 967403
        },
        {
          "txId": "0xc70b6208f36fb57ebf21dfb8b26cbfad8b096982fc49c4ed85883290232fc00a",
          "timestamp": "2025-06-25T23:34:36.942Z",
          "type": "contract-call",
          "amount": 2.2797796639231827,
          "token": "PEPE",
          "status": "pending",
          "fee": 0.004217862654320988
        },
        {
          "txId": "0x602b3726430e58ed39396e0c4f2bdeb06af3f090b046f28c16d69b97a1524ca8",
          "timestamp": "2025-06-25T22:53:36.942Z",
          "type": "deploy",
          "amount": 2.9270404663923184,
          "token": "WELSH",
          "status": "pending",
          "fee": 0.003982793209876543
        },
        {
          "txId": "0x671227702f68ebfb7fe0edc3f24a9858665557a84d5454c8b4c029ad51b6a34d",
          "timestamp": "2025-06-25T19:15:36.942Z",
          "type": "deploy",
          "amount": 16.92593878600823,
          "token": "USDA",
          "status": "confirmed",
          "fee": 0.009748109567901234,
          "blockHeight": 906898,
          "memo": "LP token withdrawal"
        },
        {
          "txId": "0xc13ac500d352c1c0b06955333ef81094decde16e9f5afbcc65dcc84755da65ed",
          "timestamp": "2025-06-25T18:41:36.943Z",
          "type": "deploy",
          "amount": 8.08281035665295,
          "token": "CHA",
          "status": "confirmed",
          "fee": 0.0017490740740740743,
          "blockHeight": 403985
        },
        {
          "txId": "0x6265795ebad3db63fc3fc42bc013d4e2b64dfb01cb205ac4f7f78d954d5b7f80",
          "timestamp": "2025-06-25T18:09:36.943Z",
          "type": "send",
          "amount": 12.502949245541839,
          "token": "DIKO",
          "status": "pending",
          "fee": 0.009092824074074076
        },
        {
          "txId": "0xb55f1d2a8c5e1a4af2caef3f9fb16adf14f8de5e3fe3d46472dcedc1bb1e25d7",
          "timestamp": "2025-06-25T11:08:36.942Z",
          "type": "receive",
          "amount": 6.567974108367627,
          "token": "ROOS",
          "status": "confirmed",
          "fee": 0.009999112654320987,
          "blockHeight": 364868
        },
        {
          "txId": "0x4959646d914b121df2bf41bf7873e6c209dc0427e871546f61d4a547fd015a13",
          "timestamp": "2025-06-25T08:22:36.942Z",
          "type": "send",
          "amount": 16.266298010973934,
          "token": "CHA",
          "status": "pending",
          "fee": 0.009458796296296298
        }
      ],
      "connectionMethod": "hiro"
    },
    "preferences": {
      "sidebarCollapsed": false,
      "theme": "dark",
      "skin": "default",
      "language": "zh",
      "timezone": "Asia/Tokyo",
      "dateFormat": "ISO",
      "numberFormat": "US"
    }
  },
  "bots": {
    "list": [
      {
        "id": "bot-595574",
        "name": "Seaking",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "inactive",
        "walletAddress": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-06-29T12:11:36.944Z",
        "lastActive": "2025-07-09T23:47:36.944Z",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/119.png",
        "imageType": "pokemon",
        "dailyPnL": 0.85,
        "totalPnL": 5.79,
        "totalVolume": 153.6826131687243,
        "successRate": 87.80021862139918,
        "isScheduled": false,
        "executionCount": 0,
        "stxBalance": 4.804072359396433,
        "lpTokenBalances": [
          {
            "contractId": "SPOBF15BUKNJ1SJX68O83PDIF0V9KNMG7X30KVF0.lisa-pool",
            "symbol": "LISA",
            "name": "Lisa Pool",
            "balance": 10,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.000029436554110516268
          }
        ],
        "rewardTokenBalances": [
          {
            "contractId": "SPUVFO41TTWODFO818Q5QD6NJJCNN94WUCRGSLJT.pepe",
            "symbol": "PEPE",
            "name": "Pepe",
            "balance": 130,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 0.000005685966536121579
          },
          {
            "contractId": "SPYSEASRAXEDLQY96GA5A51V7BLWDXOL8WFZ0BJF.welsh",
            "symbol": "WELSH",
            "name": "Welsh",
            "balance": 178,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.0005588172985448334
          },
          {
            "contractId": "SPSTT8ENDFGMEMEPM4RT6YN1RJ2JWQR5ESPI2ZI1.usda",
            "symbol": "USDA",
            "name": "USD Alex",
            "balance": 115,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 0.0000023414252304395766
          },
          {
            "contractId": "SPDPLAR0MBSQUB3Q02D938JLO7Z6PO3G3VWNXEQO.lisa",
            "symbol": "LISA",
            "name": "Lisa",
            "balance": 20,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00004083264350526226
          }
        ],
        "recentActivity": []
      },
      {
        "id": "bot-586026",
        "name": "Ninetales",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "paused",
        "walletAddress": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-09T09:07:36.944Z",
        "lastActive": "2025-07-09T23:23:36.944Z",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/38.png",
        "imageType": "pokemon",
        "dailyPnL": 1.19,
        "totalPnL": 14.57,
        "totalVolume": 69.42142489711934,
        "successRate": 75.69663065843622,
        "isScheduled": false,
        "executionCount": 0,
        "stxBalance": 4.206657235939643,
        "lpTokenBalances": [
          {
            "contractId": "SPHLABBIVWFJRESBV0Z8L6Y0BFMS2V296JHZL3NO.usda-pool",
            "symbol": "USDA",
            "name": "USD Alex Pool",
            "balance": 7,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 3.9041865483770633e-7
          },
          {
            "contractId": "SP8AMM4A2IN0U4VL3141ZWC3AERQOGNJJGGGKSNE.pepe-pool",
            "symbol": "PEPE",
            "name": "Pepe Pool",
            "balance": 5,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 5.162576175351324e-7
          },
          {
            "contractId": "SPGEWMTDW59PSXG7TJSDFXYH306NYV170P600AAE.cha-pool",
            "symbol": "CHA",
            "name": "Charisma Pool",
            "balance": 8,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00007537685091770977
          }
        ],
        "rewardTokenBalances": [
          {
            "contractId": "SPC3KY7EI3FF533RUZE1GF4YAIXFLQ7UT2NLFFHP.diko",
            "symbol": "DIKO",
            "name": "Diko",
            "balance": 117,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.0003352922462212593
          }
        ],
        "recentActivity": []
      },
      {
        "id": "bot-565069",
        "name": "Sandshrew",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "error",
        "walletAddress": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-04T02:26:36.944Z",
        "lastActive": "2025-07-09T23:06:36.944Z",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/27.png",
        "imageType": "pokemon",
        "dailyPnL": -0.84,
        "totalPnL": -7.92,
        "totalVolume": 88.84495027434842,
        "successRate": 83.18685699588477,
        "isScheduled": false,
        "executionCount": 0,
        "stxBalance": 18.89386574074074,
        "lpTokenBalances": [
          {
            "contractId": "SPHTP323ZE1K8X9Z8H1BNVN5VLGFLX021ZF5S3PV.diko-pool",
            "symbol": "DIKO",
            "name": "Diko Pool",
            "balance": 9,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00004828017915851004
          },
          {
            "contractId": "SP0UE28P4PXJQHSPR818C49HFB3BRL92EMLXUSKC.alex-pool",
            "symbol": "ALEX",
            "name": "Alex Pool",
            "balance": 12,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 9.33227870619766e-8
          }
        ],
        "rewardTokenBalances": [
          {
            "contractId": "SPZUJJOKXFBIK9QHR0KASA7F0ZC6Z07NTIE6INHM.welsh",
            "symbol": "WELSH",
            "name": "Welsh",
            "balance": 170,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.0006928675218511218
          },
          {
            "contractId": "SPBPUJGRYTHX8EX4WBWFKZE1S96QDE764O3RJIQ6.diko",
            "symbol": "DIKO",
            "name": "Diko",
            "balance": 60,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.0002745319115408662
          },
          {
            "contractId": "SPNBK5S4V85632JTABR8YDAV2XH9J7DIGTBNZB6C.cha",
            "symbol": "CHA",
            "name": "Charisma",
            "balance": 19,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00009597384084268866
          }
        ],
        "recentActivity": []
      },
      {
        "id": "bot-903437",
        "name": "Doduo",
        "strategy": "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
        "status": "inactive",
        "walletAddress": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-05T14:34:36.944Z",
        "lastActive": "2025-07-09T05:29:36.944Z",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/84.png",
        "imageType": "pokemon",
        "dailyPnL": -0.11,
        "totalPnL": -1.11,
        "totalVolume": 72.75505829903977,
        "successRate": 73.54854681069959,
        "isScheduled": false,
        "executionCount": 0,
        "stxBalance": 11.391358024691359,
        "lpTokenBalances": [],
        "rewardTokenBalances": [
          {
            "contractId": "SP21ZN61K3179E11IGVUU6RNDPBV473DRGWED4J8.usda",
            "symbol": "USDA",
            "name": "USD Alex",
            "balance": 99,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 0.000002247810862484691
          },
          {
            "contractId": "SPBZK33U9ES7ARB571FJTK60XJ2Y1E22FO3K7H82.welsh",
            "symbol": "WELSH",
            "name": "Welsh",
            "balance": 106,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00037342245237423317
          }
        ],
        "recentActivity": []
      },
      {
        "id": "bot-378414",
        "name": "Seaking",
        "strategy": "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
        "status": "active",
        "walletAddress": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        "createdAt": "2025-07-03T04:55:36.944Z",
        "lastActive": "2025-07-09T10:27:36.944Z",
        "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/119.png",
        "imageType": "pokemon",
        "dailyPnL": 1.87,
        "totalPnL": 22.9,
        "totalVolume": 118.78412208504801,
        "successRate": 82.20556841563786,
        "isScheduled": false,
        "executionCount": 0,
        "stxBalance": 3.738091563786008,
        "lpTokenBalances": [
          {
            "contractId": "SPGT9LEGFHMCH5TTI8W2049JYIAR8M0UZ2RTDEHC.usda-pool",
            "symbol": "USDA",
            "name": "USD Alex Pool",
            "balance": 13,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 2.487814051068815e-7
          },
          {
            "contractId": "SPI2YSTFH38YASOVH08SER29XS03B2P3U6JRX27D.cha-pool",
            "symbol": "CHA",
            "name": "Charisma Pool",
            "balance": 8,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00000983949316335136
          }
        ],
        "rewardTokenBalances": [
          {
            "contractId": "SPH0B31CXEIFKAYW1YV8UU819HYKEZ4ELDW6QB4L.leo",
            "symbol": "LEO",
            "name": "Leo",
            "balance": 18,
            "formattedBalance": 0,
            "decimals": 8,
            "usdValue": 6.3877452566392e-8
          },
          {
            "contractId": "SPKVM7HKG5QOBHCCATOIJPLXWYEN0DC69GVHCIGH.roos",
            "symbol": "ROOS",
            "name": "Roos",
            "balance": 92,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00022792588716063526
          },
          {
            "contractId": "SP9A17ZBS4HD2YE95A4HG2DBI7AVGSKH80Q1LNLS.welsh",
            "symbol": "WELSH",
            "name": "Welsh",
            "balance": 54,
            "formattedBalance": 0,
            "decimals": 6,
            "usdValue": 0.00016274806311551766
          }
        ],
        "recentActivity": []
      }
    ],
    "stats": {
      "totalBots": 5,
      "activeBots": 1,
      "pausedBots": 1,
      "errorBots": 1,
      "totalGas": 0,
      "totalValue": 43.04,
      "totalPnL": 34.23,
      "todayPnL": 2.96
    },
    "activities": []
  },
  "market": {
    "data": {
      "tokenPrices": {
        "STX": 0.2297,
        "ALEX": 0.0571,
        "DIKO": 0.0195,
        "USDA": 0.6424,
        "CHA": 0.0055,
        "WELSH": 0.0005,
        "PEPE": 0,
        "LISA": 0.0008,
        "ROOS": 0.0014,
        "LEO": 0.0043
      },
      "priceChanges": {
        "STX": 9.363082990397803,
        "ALEX": 1.239883401920439,
        "DIKO": 9.737054183813441,
        "USDA": 3.1879286694101516,
        "CHA": 9.925840192043896,
        "WELSH": -1.7158779149519887,
        "PEPE": -3.4038923182441705,
        "LISA": -6.804869684499314,
        "ROOS": -3.5854766803840876,
        "LEO": -5.412379972565158
      },
      "marketCap": {
        "STX": 12482.510288065843,
        "ALEX": 70628.47222222222,
        "DIKO": 186390.17489711934,
        "USDA": 58934.284979423865,
        "CHA": 147427.46913580244,
        "WELSH": 151036.39403292185,
        "PEPE": 148927.72633744855,
        "LISA": 30268.132716049382,
        "ROOS": 64224.279835390946,
        "LEO": 139962.83436213993
      }
    },
    "analytics": {
      "totalValue": 0,
      "totalPnL": 0,
      "activeBots": 1,
      "successRate": 0,
      "volumeToday": 0,
      "bestPerformer": "Seaking",
      "worstPerformer": "Seaking",
      "avgGasUsed": 0,
      "totalTransactions": 0,
      "profitableDays": 0,
      "totalDays": 0,
      "timeRange": "7d",
      "chartData": []
    },
    "pools": [
      {
        "id": "pool-960771",
        "name": "USDA-LISA",
        "tokenA": "USDA",
        "tokenB": "LISA",
        "totalValueLocked": 1634.5383230452674,
        "apr": 180.2383401920439,
        "volume24h": 125.54342421124828,
        "fees24h": 0.7953960905349793,
        "liquidity": 390.2741340877915
      },
      {
        "id": "pool-614139",
        "name": "PEPE-ROOS",
        "tokenA": "PEPE",
        "tokenB": "ROOS",
        "totalValueLocked": 1162.2505144032923,
        "apr": 207.12877229080934,
        "volume24h": 146.04612482853224,
        "fees24h": 0.15158050411522633,
        "liquidity": 725.8894890260632
      },
      {
        "id": "pool-473757",
        "name": "WELSH-PEPE",
        "tokenA": "WELSH",
        "tokenB": "PEPE",
        "totalValueLocked": 1600.3793724279835,
        "apr": 963.1858710562415,
        "volume24h": 162.59049211248285,
        "fees24h": 1.84318158436214,
        "liquidity": 566.713177297668
      },
      {
        "id": "pool-764625",
        "name": "ALEX-CHA",
        "tokenA": "ALEX",
        "tokenB": "CHA",
        "totalValueLocked": 1523.9248971193415,
        "apr": 698.4096364883402,
        "volume24h": 32.67652606310014,
        "fees24h": 0.6451993312757202,
        "liquidity": 150.24519890260632
      },
      {
        "id": "pool-811743",
        "name": "PEPE-CHA",
        "tokenA": "PEPE",
        "tokenB": "CHA",
        "totalValueLocked": 1407.8870884773662,
        "apr": 662.8000685871056,
        "volume24h": 183.8042266803841,
        "fees24h": 0.832633744855967,
        "liquidity": 663.9855538408779
      },
      {
        "id": "pool-840111",
        "name": "CHA-LEO",
        "tokenA": "CHA",
        "tokenB": "LEO",
        "totalValueLocked": 1727.2659465020574,
        "apr": 106.35716735253773,
        "volume24h": 93.4735939643347,
        "fees24h": 0.9804848251028806,
        "liquidity": 445.4342421124829
      }
    ]
  },
  "notifications": [
    {
      "id": "notification-151840",
      "type": "info",
      "title": "Price alert triggered",
      "message": "STX price increased by 15% in last hour",
      "timestamp": "2025-07-09T08:15:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-312164",
      "type": "error",
      "title": "Contract call failed",
      "message": "Smart contract rejected the transaction",
      "timestamp": "2025-07-08T16:55:36.945Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-387202",
      "type": "warning",
      "title": "Gas price elevated",
      "message": "Network gas prices are 50% above normal",
      "timestamp": "2025-07-08T12:22:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-466562",
      "type": "info",
      "title": "System maintenance scheduled",
      "message": "STX price increased by 15% in last hour",
      "timestamp": "2025-07-07T10:01:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-681261",
      "type": "success",
      "title": "Trade executed",
      "message": "Successfully swapped 100 STX for ALEX",
      "timestamp": "2025-07-06T08:16:36.945Z",
      "read": true,
      "persistent": false,
      "actionUrl": "/analytics"
    },
    {
      "id": "notification-101439",
      "type": "success",
      "title": "Bot started successfully",
      "message": "Collected 5.2 CHA tokens in farming rewards",
      "timestamp": "2025-07-05T09:03:36.945Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-252496",
      "type": "info",
      "title": "New farming opportunity available",
      "message": "WELSH token now available for trading",
      "timestamp": "2025-07-04T08:37:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-200551",
      "type": "info",
      "title": "Market volatility increased",
      "message": "New STX-ALEX pool offers 25% APR",
      "timestamp": "2025-07-03T08:54:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-618028",
      "type": "info",
      "title": "New token listing detected",
      "message": "STX price increased by 15% in last hour",
      "timestamp": "2025-06-30T13:17:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-518892",
      "type": "success",
      "title": "Trade executed",
      "message": "Successfully swapped 100 STX for ALEX",
      "timestamp": "2025-06-29T20:06:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-840597",
      "type": "warning",
      "title": "API rate limit approaching",
      "message": "Your bot has not made a profit in 24 hours",
      "timestamp": "2025-06-29T19:10:36.945Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-411304",
      "type": "warning",
      "title": "Gas price elevated",
      "message": "Network gas prices are 50% above normal",
      "timestamp": "2025-06-29T06:09:36.945Z",
      "read": false,
      "persistent": false,
      "actionUrl": "/market"
    },
    {
      "id": "notification-705027",
      "type": "info",
      "title": "Price alert triggered",
      "message": "Maintenance window: 2 AM - 4 AM UTC",
      "timestamp": "2025-06-28T18:22:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-300281",
      "type": "error",
      "title": "Bot execution failed",
      "message": "Transaction failed due to insufficient gas",
      "timestamp": "2025-06-28T00:22:36.945Z",
      "read": false,
      "persistent": false
    },
    {
      "id": "notification-774741",
      "type": "error",
      "title": "Transaction reverted",
      "message": "Wallet balance too low to execute trade",
      "timestamp": "2025-06-26T06:39:36.945Z",
      "read": true,
      "persistent": false
    },
    {
      "id": "notification-543530",
      "type": "info",
      "title": "Price alert triggered",
      "message": "Bitcoin price movement may affect STX",
      "timestamp": "2025-06-25T16:21:36.945Z",
      "read": true,
      "persistent": false
    }
  ]
} as const;
