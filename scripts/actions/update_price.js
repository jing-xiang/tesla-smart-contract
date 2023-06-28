import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });
import * as algotxn from "../index.js";
import algosdk from "algosdk";

const holdingsappId = Number(process.env.NEXT_PUBLIC_HOLDINGS_ID);
const creator = algosdk.mnemonicToSecretKey(
  process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
);
//set new price in microalgos
const new_price = 10000000;

(async () => {
  await algotxn.updateprice(holdingsappId, Number(new_price), creator);
})();
