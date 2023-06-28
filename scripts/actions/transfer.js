import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });
import algosdk, { getApplicationAddress } from "algosdk";
import * as algotxn from "../index.js";
const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

const assetID = Number(process.env.NEXT_PUBLIC_ASSET_ID);
const mintappId = Number(process.env.NEXT_PUBLIC_MINT_ID);
const holdingsappId = Number(process.env.NEXT_PUBLIC_HOLDINGS_ID);
const holdingsAddress = process.env.NEXT_PUBLIC_HOLDINGS_ADDRESS;
const creator = algosdk.mnemonicToSecretKey(
  process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
);

(async () => {
  console.log(assetID);
  await algotxn.holdingsoptintoasset(holdingsappId, assetID, creator);
  console.log(mintappId);
  await algotxn.transfertokenstoholdings(
    mintappId,
    assetID,
    holdingsAddress,
    Number(10000),
    creator
  );
})();
