import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });
import algosdk, { getApplicationAddress } from "algosdk";
import * as algotxn from "./index.js";
const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

(async () => {
  const creator = algosdk.mnemonicToSecretKey(
    process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
  );

  // deploy Minting contract
  const mintApp = await algotxn.deployDemoApp(
    creator,
    "../artifacts/MintApp/approval.teal",
    "../artifacts/MintApp/clear.teal",
    1,
    2
  );

  const mintappId = mintApp.confirmation["application-index"];
  console.log(
    `Deployed MintApp ID is ${mintappId}. Save this app ID in the env file.`
  );
  const mintAddress = algosdk.getApplicationAddress(mintappId);
  //fund mint contract
  await algotxn.fundAccount(creator, mintAddress, 1e6 + 1e5);
  const assetID = Number(await algotxn.mintTokens(mintappId, creator));
  //deploy holdings contract
  const holdingsapp = await algotxn.deployDemoApp(
    creator,
    "../artifacts/HoldingsApp/approval.teal",
    "../artifacts/HoldingsApp/clear.teal",
    2,
    0
  );

  const holdingsappId = holdingsapp.confirmation["application-index"];
  console.log(
    `Deployed HoldingsApp ID is ${holdingsappId}. Save this app ID in the env file.`
  );
  //deploy burning contract
  const burnapp = await algotxn.deployDemoApp(
    creator,
    "../artifacts/BurnApp/approval.teal",
    "../artifacts/BurnApp/clear.teal",
    1,
    0
  );
  const burnappId = burnapp.confirmation["application-index"];
  console.log(
    `Deployed BurnApp ID is ${burnappId}. Save this app ID in the env file.`
  );

  const holdingsAddress = algosdk.getApplicationAddress(holdingsappId);
  const burnAddress = algosdk.getApplicationAddress(burnappId);
  //fund both contract to store asset
  await algotxn.fundAccount(creator, holdingsAddress, 1e6 + 1e5);
  await algotxn.fundAccount(creator, burnAddress, 1e6 + 1e5);

  //save both contract addresess to mintapp global state
  await algotxn.updatecontracts(mintappId, holdingsAddress, burnAddress);

  //view the id and addresses
  console.log([
    assetID,
    mintappId,
    holdingsappId,
    burnappId,
    mintAddress,
    holdingsAddress,
    burnAddress,
  ]);
})();
