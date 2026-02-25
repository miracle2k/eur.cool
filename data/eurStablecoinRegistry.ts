import { StablecoinRegistryEntry } from "@/lib/types";

/**
 * Registry sourced from CoinGecko EUR stablecoin discovery (+ manual bridge entries)
 * on 2026-02-25.
 */
export const EUR_STABLECOIN_REGISTRY: StablecoinRegistryEntry[] = [
  {
    id: "euro-coin",
    symbol: "EURC",
    name: "EURC",
    contracts: [
      { chainId: "ethereum", address: "0x1abaea1f7c830bd89acc67ec4af516284b1bc33c", kind: "native" },
      { chainId: "base", address: "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42", kind: "native" },
      { chainId: "avalanche", address: "0xc891eb4cbdeff6e073e859e987815ed1505c2acd", kind: "native" },
      { chainId: "world-chain", address: "0x1c60ba0a0ed1019e8eb035e6daf4155a5ce2380b", kind: "native" },
      { chainId: "solana", address: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", kind: "native" },
      {
        chainId: "stellar",
        address: "EURC-GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        kind: "native",
      },
    ],
  },
  {
    id: "gnosis-xdai-bridged-eurc-gnosis",
    symbol: "EURC.E",
    name: "Omnibridge Bridged EURC (Gnosis)",
    contracts: [
      { chainId: "xdai", address: "0x54e4cb2a4fa0ee46e3d9a98d13bea119666e09f6", kind: "bridged" },
    ],
  },
  {
    id: "stasis-eurs",
    symbol: "EURS",
    name: "STASIS EURO",
    contracts: [
      { chainId: "ethereum", address: "0xdb25f211ab05b1c97d595516f45794528a807ad8", kind: "native" },
      { chainId: "polygon-pos", address: "0xe111178a87a3bff0c8d18decba5798827539ae99", kind: "bridged" },
    ],
  },
  {
    id: "societe-generale-forge-eurcv",
    symbol: "EURCV",
    name: "EUR CoinVertible",
    contracts: [
      { chainId: "ethereum", address: "0x5f7827fdeb7c20b443265fc2f40845b715385ff2", kind: "native" },
      {
        chainId: "xrp",
        address: "4555524356000000000000000000000000000000.rUNaS5sqRuxZz6V7rBGhoSaZiVYA3ut4UL",
        kind: "native",
      },
      {
        chainId: "stellar",
        address: "GCEYGIVOLAVBF2TG2RUSGTUJCIN75KEX3NGLMY4VPL4GFE5L355AXW3G",
        kind: "native",
      },
      { chainId: "solana", address: "DghpMkatCiUsofbTmid3M3kAbDTPqDwKiYHnudXeGG52", kind: "native" },
    ],
  },
  {
    id: "anchored-coins-eur",
    symbol: "AEUR",
    name: "Anchored Coins AEUR",
    contracts: [
      { chainId: "ethereum", address: "0xa40640458fbc27b6eefedea1e9c9e17d4cee7a21", kind: "native" },
      {
        chainId: "binance-smart-chain",
        address: "0xa40640458fbc27b6eefedea1e9c9e17d4cee7a21",
        kind: "native",
      },
    ],
  },
  {
    id: "eurite",
    symbol: "EURI",
    name: "Eurite",
    contracts: [
      { chainId: "ethereum", address: "0x9d1a7a3191102e9f900faa10540837ba84dcbae7", kind: "native" },
      {
        chainId: "binance-smart-chain",
        address: "0x9d1a7a3191102e9f900faa10540837ba84dcbae7",
        kind: "native",
      },
    ],
  },
  {
    id: "monerium-eur-money-2",
    symbol: "EURE",
    name: "Monerium EUR emoney",
    contracts: [
      { chainId: "ethereum", address: "0x39b8b6385416f4ca36a20319f70d28621895279d", kind: "native" },
      { chainId: "xdai", address: "0x420ca0f9b9b604ce0fd9c18ef134c705e5fa3430", kind: "native" },
      { chainId: "linea", address: "0x3ff47c5bf409c86533fe1f4907524d304062428d", kind: "native" },
      { chainId: "scroll", address: "0xd7bb130a48595fcdf9480e36c1ae97ff2938ac21", kind: "native" },
      { chainId: "arbitrum-one", address: "0x0c06ccf38114ddfc35e07427b9424adcca9f44f8", kind: "native" },
      { chainId: "polygon-pos", address: "0xe0aea583266584dafbb3f9c3211d5588c73fea8d", kind: "native" },
      {
        chainId: "osmosis",
        address: "ibc/92AE2F53284505223A1BB80D132F859A00E190C6A738772F0B3EF65E20BA484F",
        kind: "native",
      },
      {
        chainId: "terra-2",
        address: "ibc/8D52B251B447B7160421ACFBD50F6B0ABE5F98D2C404B03701130F12044439A1",
        kind: "native",
      },
    ],
  },
  {
    id: "stablr-euro",
    symbol: "EURR",
    name: "StablR Euro",
    contracts: [
      { chainId: "ethereum", address: "0x50753cfaf86c094925bf976f218d043f8791e408", kind: "native" },
    ],
  },
  {
    id: "schuman-europ",
    symbol: "EUROP",
    name: "EURØP",
    contracts: [
      { chainId: "ethereum", address: "0x888883b5f5d21fb10dfeb70e8f9722b9fb0e5e51", kind: "native" },
      { chainId: "polygon-pos", address: "0x888883b5f5d21fb10dfeb70e8f9722b9fb0e5e51", kind: "native" },
      { chainId: "avalanche", address: "0x8835a2f66a7aaccb297cb985831a616b75e2e16c", kind: "native" },
      { chainId: "plasma", address: "0x98658bd74ef231158cadc21d8aba733a4e947e6a", kind: "native" },
      { chainId: "xrp", address: "rMkEuRii9w9uBMQDnWV5AA43gvYZR9JxVK", kind: "native" },
    ],
  },
  {
    id: "quantoz-eurq",
    symbol: "EURQ",
    name: "Quantoz EURQ",
    contracts: [
      { chainId: "ethereum", address: "0x8df723295214ea6f21026eeeb4382d475f146f9f", kind: "native" },
      { chainId: "polygon-pos", address: "0xd571edb2ef29df10fcd6200fd6d0ed2389983db3", kind: "native" },
      { chainId: "xrp", address: "EURQ.rDk1xiArDMjDqnrR2yWypwQAKg4mKnQYvs", kind: "native" },
      { chainId: "algorand", address: "2768422954", kind: "native" },
    ],
  },
  {
    id: "quantoz-eurd",
    symbol: "EURD",
    name: "Quantoz EURD",
    contracts: [{ chainId: "algorand", address: "1221682136", kind: "native" }],
  },
  {
    id: "celo-euro",
    symbol: "EURM",
    name: "Mento Euro",
    contracts: [{ chainId: "celo", address: "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73", kind: "native" }],
  },
  {
    id: "vnx-euro",
    symbol: "VEUR",
    name: "VNX EURO",
    contracts: [
      { chainId: "celo", address: "0x9346f43c1588b6df1d52bdd6bf846064f92d9cba", kind: "native" },
      { chainId: "fraxtal", address: "0x4c0bd74da8237c08840984fdb33a84b4586aaee6", kind: "native" },
      { chainId: "base", address: "0x4ed9df25d38795a47f52614126e47f564d37f347", kind: "native" },
      { chainId: "avalanche", address: "0x7678e162f38ec9ef2bfd1d0aaf9fd93355e5fa0b", kind: "native" },
      { chainId: "polygon-pos", address: "0xe4095d9372e68d108225c306a4491cacfb33b097", kind: "native" },
      { chainId: "arbitrum-one", address: "0x4883c8f0529f37e40ebea870f3c13cdfad5d01f8", kind: "native" },
      { chainId: "q-mainnet", address: "0x513f99dee650f529d7c65bb5679f092b64003520", kind: "native" },
      { chainId: "solana", address: "C4Kkr9NZU3VbyedcgutU6LKmi6MKz81sx6gRmk5pX519", kind: "native" },
      {
        chainId: "internet-computer",
        address: "wu6g4-6qaaa-aaaan-qmrza-cai",
        kind: "native",
      },
      { chainId: "tezos", address: "KT1FenS7BCUjn1otfFyfrfxguiGnL4UTF3aG", kind: "native" },
      {
        chainId: "stellar",
        address: "VEUR-GDXLSLCOPPHTWOQXLLKSVN4VN3G67WD2ENU7UMVAROEYVJLSPSEWXIZN",
        kind: "native",
      },
      { chainId: "xrp", address: "VEUR-rLPtwF4FZi8bNVmbQ8JgoDUooozhwMNXr3", kind: "native" },
    ],
  },
  {
    id: "decentralized-euro",
    symbol: "DEURO",
    name: "Decentralized Euro",
    contracts: [
      { chainId: "ethereum", address: "0xba3f535bbcccca2a154b573ca6c5a49baae0a3ea", kind: "native" },
      { chainId: "base", address: "0x1b5f7fa46ed0f487f049c42f374ca4827d65a264", kind: "native" },
      { chainId: "polygon-pos", address: "0xc2ff25dd99e467d2589b2c26edd270f220f14e47", kind: "native" },
      {
        chainId: "optimistic-ethereum",
        address: "0x1b5f7fa46ed0f487f049c42f374ca4827d65a264",
        kind: "native",
      },
      { chainId: "arbitrum-one", address: "0x5e85faf503621830ca857a5f38b982e0cc57d537", kind: "native" },
    ],
  },
  {
    id: "allunity-eur",
    symbol: "EURAU",
    name: "AllUnity EUR",
    contracts: [
      { chainId: "ethereum", address: "0x4933a85b5b5466fbaf179f72d3de273c287ec2c2", kind: "native" },
      { chainId: "arbitrum-one", address: "0x4933a85b5b5466fbaf179f72d3de273c287ec2c2", kind: "native" },
      { chainId: "base", address: "0x4933a85b5b5466fbaf179f72d3de273c287ec2c2", kind: "native" },
      { chainId: "polygon-pos", address: "0x4933a85b5b5466fbaf179f72d3de273c287ec2c2", kind: "native" },
      {
        chainId: "optimistic-ethereum",
        address: "0x4933a85b5b5466fbaf179f72d3de273c287ec2c2",
        kind: "native",
      },
    ],
  },
  {
    id: "tether-eurt",
    symbol: "EURT",
    name: "Euro Tether",
    contracts: [
      { chainId: "ethereum", address: "0xc581b735a1688071a1746c968e0798d642ede491", kind: "native" },
    ],
  },
  {
    id: "jarvis-synthetic-euro",
    symbol: "JEUR",
    name: "Jarvis Synthetic Euro",
    contracts: [
      { chainId: "ethereum", address: "0x0f17bc9a994b87b5225cfb6a2cd4d667adb4f20b", kind: "native" },
      { chainId: "xdai", address: "0x9fb1d52596c44603198fb0aee434fac3a679f702", kind: "bridged" },
      { chainId: "polygon-pos", address: "0x4e3decbb3645551b8a19f0ea1678079fcb33fb4c", kind: "bridged" },
      {
        chainId: "binance-smart-chain",
        address: "0x23b8683ff98f9e4781552dfe6f12aa32814924e8",
        kind: "bridged",
      },
    ],
  },
  {
    id: "usual-eur",
    symbol: "EUR0",
    name: "Usual EUR",
    contracts: [
      { chainId: "ethereum", address: "0x3c89cd1884e7bef73ca3ef08d2ef6ec338fd8e49", kind: "native" },
    ],
  },
  {
    id: "e-money-eur",
    symbol: "EEUR",
    name: "e-Money EUR",
    contracts: [
      {
        chainId: "osmosis",
        address: "ibc/5973C068568365FFF40DEDCF1A1CB7582B6116B731CD31A12231AE25E20B871F",
        kind: "native",
      },
      { chainId: "evmos", address: "0x5db67696c3c088dfbf588d3dd849f44266ff0ffa", kind: "native" },
    ],
  },
  {
    id: "aryze-eeur",
    symbol: "EEUR",
    name: "ARYZE eEUR",
    contracts: [
      { chainId: "ethereum", address: "0x735fa792e731a2e8f83f32eb539841b7b72e6d8f", kind: "native" },
      { chainId: "polygon-pos", address: "0x735fa792e731a2e8f83f32eb539841b7b72e6d8f", kind: "native" },
    ],
  },
  {
    id: "seur",
    symbol: "SEUR",
    name: "sEUR",
    contracts: [
      { chainId: "ethereum", address: "0xd71ecff9342a5ced620049e616c5035f1db98620", kind: "native" },
    ],
  },
  {
    id: "ageur",
    symbol: "EURA",
    name: "EURA",
    contracts: [
      { chainId: "ethereum", address: "0x1a7e4e63778b4f12a199c062f3efdd288afcbce8", kind: "native" },
      { chainId: "base", address: "0xa61beb4a3d02decb01039e378237032b351125b4", kind: "native" },
      { chainId: "celo", address: "0xc16b81af351ba9e64c1a069e3ab18c244a1e3049", kind: "native" },
      { chainId: "polygon-pos", address: "0xe0b52e49357fd4daf2c15e02058dce6bc0057db4", kind: "native" },
      { chainId: "arbitrum-one", address: "0xfa5ed56a203466cbbc2430a43c66b9d8723528e7", kind: "native" },
      { chainId: "xdai", address: "0x4b1e2c2762667331bc91648052f646d1b0d35984", kind: "bridged" },
      {
        chainId: "binance-smart-chain",
        address: "0x12f31b73d812c6bb0d735a218c086d44d5fe5f89",
        kind: "bridged",
      },
    ],
  },
];
