import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });
import algosdk from "algosdk";
import * as algotxn from "../scripts/index.js";
import { getpaymentMethod } from "../src/algorand/index.js";

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

// use chai-as-promise library
chai.use(chaiAsPromised);
let assert = chai.assert;

const creator = algosdk.mnemonicToSecretKey(
  process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
);
const buyer = algosdk.generateAccount();

describe("Success Tests", function () {
  let holdingsappId,
    assetID,
    mintappId,
    burnappId,
    mintAddress,
    holdingsAddress,
    burnAddress;
  this.beforeEach(async () => {
    await algotxn.fundAccount(creator, buyer.addr, 1e10);
    // deploy app
    // deploy Minting contract
    const mintApp = await algotxn.deployDemoApp(
      creator,
      "../artifacts/MintApp/approval.teal",
      "../artifacts/MintApp/clear.teal",
      1,
      2
    );

    mintappId = mintApp.confirmation["application-index"];
    mintAddress = algosdk.getApplicationAddress(mintappId);
    //fund mint contract
    await algotxn.fundAccount(creator, mintAddress, 1e6 + 1e5);
    assetID = Number(await algotxn.mintTokens(mintappId, creator));
    //deploy holdings contract
    const holdingsapp = await algotxn.deployDemoApp(
      creator,
      "../artifacts/HoldingsApp/approval.teal",
      "../artifacts/HoldingsApp/clear.teal",
      2,
      0
    );

    holdingsappId = holdingsapp.confirmation["application-index"];
    //deploy burning contract
    const burnapp = await algotxn.deployDemoApp(
      creator,
      "../artifacts/BurnApp/approval.teal",
      "../artifacts/BurnApp/clear.teal",
      1,
      0
    );
    burnappId = burnapp.confirmation["application-index"];
    holdingsAddress = algosdk.getApplicationAddress(holdingsappId);
    burnAddress = algosdk.getApplicationAddress(burnappId);
    //fund both contract to store asset
    await algotxn.fundAccount(creator, holdingsAddress, 1e6 + 1e5);
    await algotxn.fundAccount(creator, burnAddress, 1e6 + 1e5);

    //save both contract addresess to mintapp global state
    await algotxn.updatecontracts(mintappId, holdingsAddress, burnAddress);
  });

  it("Contracts deploy successfully", async () => {
    //verify apps and asset created
    assert.isDefined(mintappId);
    assert.isDefined(holdingsappId);
    assert.isDefined(burnappId);
    assert.isDefined(assetID);
    const appGS = await algotxn.readGlobalState(mintappId);
    assert.equal(appGS.get("holding_address", holdingsAddress));
    assert.equal(appGS.get("burn_address", burnAddress));
    assert.equal(appGS.get("Asset ID"), assetID);
  });

  it("Transfer tokens to holdings application successfully", async () => {
    await algotxn.holdingsoptintoasset(holdingsappId, assetID, creator);
    const number = Math.floor(Math.random() * (10000 - 1) + 1);
    await algotxn.transfertokenstoholdings(
      mintappId,
      assetID,
      holdingsAddress,
      Number(number),
      creator
    );
    const accountInfo = await algodClient
      .accountInformation(algosdk.getApplicationAddress(holdingsappId))
      .do();
    const tokens = accountInfo.assets.find((x) => x["asset-id"] == assetID);
    const amount = tokens["amount"];
    //assert that tokens received by holdings contract is correct
    assert.equal(Number(amount), number);
  });

  it("Update token price successfully", async () => {
    const new_price = Math.floor(Math.random() * (10 - 1) + 1);
    await algotxn.updateprice(holdingsappId, Number(new_price), creator);
    const appGS = await algotxn.readGlobalState(holdingsappId);
    const currentprice = Number(appGS.get("Current Price"));
    //assert that global state is correctly updated
    assert.equal(currentprice, new_price);
  });

  it("Burn tokens successfully", async () => {
    const tokens_to_burn = Math.floor(Math.random() * (1000 - 1) + 1);
    await algotxn.burnoptintoasset(burnappId, assetID, creator);
    await algotxn.burntokens(
      mintappId,
      assetID,
      burnAddress,
      Number(tokens_to_burn),
      creator
    );
    const accountInfo = await algodClient
      .accountInformation(algosdk.getApplicationAddress(mintappId))
      .do();
    const tokens = accountInfo.assets.find((x) => x["asset-id"] == assetID);
    const amount = tokens["amount"];
    //assert that tokens left after burning is correct
    assert.equal(Number(amount), 1000000 - tokens_to_burn);
  });

  it("Buy tokens successfully", async () => {
    await algotxn.holdingsoptintoasset(holdingsappId, assetID, creator);
    const number = Math.floor(Math.random() * (10000 - 1) + 1);
    await algotxn.transfertokenstoholdings(
      mintappId,
      assetID,
      holdingsAddress,
      Number(number),
      creator
    );
    const amount = Math.floor(Math.random() * (10 - 1) + 1);
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    const commonParams = {
      appID: holdingsappId,
      sender: buyer.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(buyer),
    };

    const appGS = await algotxn.readGlobalState(holdingsappId);
    const currentprice = Number(appGS.get("Current Price"));

    await algotxn.optIntoAsset(buyer, assetID);

    const paymenttxn = [
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: buyer.addr,
          to: holdingsAddress,
          amount: currentprice * amount,
          suggestedParams,
        }),
        signer: algosdk.makeBasicAccountTransactionSigner(buyer),
      },
      {
        method: getpaymentMethod("buy_tokens"),
        methodArgs: [Number(amount)],
        appForeignAssets: [assetID],
        appAccounts: [buyer.addr],
        ...commonParams,
      },
    ];
    await algotxn.makeATCCall(paymenttxn);
    const buyerInfo = await algodClient.accountInformation(buyer.addr).do();
    const tokens = buyerInfo.assets.find((x) => x["asset-id"] == assetID);
    const bought_tokens = tokens["amount"];
    //assert that buyer received correct number of bought tokens
    assert.equal(Number(bought_tokens), amount);
    const contractInfo = await algodClient
      .accountInformation(algosdk.getApplicationAddress(holdingsappId))
      .do();
    const assetsleft = contractInfo.assets.find(
      (x) => x["asset-id"] == assetID
    );
    const tokens_left = assetsleft["amount"];
    //assert the correct nunmber of tokens left in the holdings contract
    assert.equal(Number(tokens_left), number - amount);
  });
});
