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
const burnappId = Number(process.env.NEXT_PUBLIC_BURN_ID);
const burnAddress = process.env.NEXT_PUBLIC_BURN_ADDRESS;
const creator = algosdk.mnemonicToSecretKey(
  process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
);

(async () => {
  console.log(assetID);
  await algotxn.burnoptintoasset(burnappId, assetID, creator);
  console.log(mintappId);
  await algotxn.burntokens(
    mintappId,
    assetID,
    burnAddress,
    Number(500),
    creator
  );
})();
