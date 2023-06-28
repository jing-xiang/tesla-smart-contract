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
const assert = chai.assert;
const expect = chai.expect;

const creator = algosdk.mnemonicToSecretKey(
  process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
);
//buyer is non creator
const buyer = algosdk.generateAccount();
const dummy = algosdk.generateAccount();

describe("Negative Tests", function () {
  let holdingsappId,
    assetID,
    mintappId,
    burnappId,
    mintAddress,
    holdingsAddress,
    burnAddress;
  it("Asset creation fails when non creator calls", async () => {
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
    await expect(algotxn.mintTokens(mintappId, buyer)).to.be.rejectedWith(
      Error
    );
  });
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

  it("Double asset creation fails", async () => {
    //mint tokens under the same mint app id again
    await expect(algotxn.mintTokens(mintappId, creator)).to.be.rejectedWith(
      Error
    );
  });
  it("Asset transfer fails when supply is insufficient", async () => {
    await expect(
      algotxn.holdingsoptintoasset(holdingsappId, assetID, buyer)
    ).to.be.rejectedWith(Error);
    //transfer total token supply + 1
    const number = 1000001;
    await expect(
      algotxn.transfertokenstoholdings(
        mintappId,
        assetID,
        holdingsAddress,
        Number(number),
        buyer
      )
    ).to.be.rejectedWith(Error);
  });

  it("Asset burn fails when supply is insufficient", async () => {
    //burn token supply + 1
    const tokens_to_burn = 1000001;
    await expect(
      algotxn.burnoptintoasset(burnappId, assetID, buyer)
    ).to.be.rejectedWith(Error);
    await expect(
      algotxn.burntokens(
        mintappId,
        assetID,
        burnAddress,
        Number(tokens_to_burn),
        buyer
      )
    ).to.be.rejectedWith(Error);
  });

  it("Asset transfer fails when non-creator calls", async () => {
    await expect(
      algotxn.holdingsoptintoasset(holdingsappId, assetID, buyer)
    ).to.be.rejectedWith(Error);
    await expect(
      algotxn.transfertokenstoholdings(
        mintappId,
        assetID,
        holdingsAddress,
        Number(10000),
        buyer
      )
    ).to.be.rejectedWith(Error);
  });

  it("Asset burn fails when non-creator calls", async () => {
    await expect(
      algotxn.holdingsoptintoasset(holdingsappId, assetID, buyer)
    ).to.be.rejectedWith(Error);
    await expect(
      algotxn.transfertokenstoholdings(
        mintappId,
        assetID,
        holdingsAddress,
        Number(10000),
        buyer
      )
    ).to.be.rejectedWith(Error);
  });

  it("Updating price of asset fails when not called by creator", async () => {
    const new_price = 10000000;
    await expect(
      algotxn.updateprice(holdingsappId, Number(new_price), buyer)
    ).to.be.rejectedWith(Error);
  });

  it("Selling token fails when supply is less than amount sold", async () => {
    await algotxn.holdingsoptintoasset(holdingsappId, assetID, creator);
    const number = Math.floor(Math.random() * (10000 - 1) + 1);
    await algotxn.transfertokenstoholdings(
      mintappId,
      assetID,
      holdingsAddress,
      Number(number),
      creator
    );
    //set token bought to supply + 1
    const amount = number + 1;
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
    await expect(algotxn.makeATCCall(paymenttxn)).to.be.rejectedWith(Error);
  });

  it("Selling tokens fails when transaction is not grouped", async () => {
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

    const paymenttxn1 = [
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: buyer.addr,
          to: holdingsAddress,
          amount: currentprice * amount,
          suggestedParams,
        }),
        signer: algosdk.makeBasicAccountTransactionSigner(buyer),
      },
    ];
    await algotxn.makeATCCall(paymenttxn1);
    const paymenttxn2 = [
      {
        method: getpaymentMethod("buy_tokens"),
        methodArgs: [Number(amount)],
        appForeignAssets: [assetID],
        appAccounts: [buyer.addr],
        ...commonParams,
      },
    ];
    //ungroup the tesla transfer App call
    await expect(algotxn.makeATCCall(paymenttxn2)).to.be.rejectedWith(Error);
  });

  it("Buying tokens with insufficient algos", async () => {
    const low_algos_buyer = algosdk.generateAccount();
    await algotxn.fundAccount(creator, low_algos_buyer.addr, 1e5);
    await algotxn.holdingsoptintoasset(holdingsappId, assetID, creator);
    const number = Math.floor(Math.random() * (10000 - 1) + 1);
    await algotxn.transfertokenstoholdings(
      mintappId,
      assetID,
      holdingsAddress,
      Number(number),
      creator
    );
    //set amount to zero
    const amount = 10;
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    const commonParams = {
      appID: holdingsappId,
      sender: low_algos_buyer.addr,
      suggestedParams,
      signer: algosdk.makeBasicAccountTransactionSigner(low_algos_buyer),
    };

    const appGS = await algotxn.readGlobalState(holdingsappId);
    const currentprice = Number(appGS.get("Current Price"));

    await algotxn.optIntoAsset(buyer, assetID);

    const paymenttxn = [
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: low_algos_buyer.addr,
          to: holdingsAddress,
          amount: currentprice * amount,
          suggestedParams,
        }),
        signer: algosdk.makeBasicAccountTransactionSigner(low_algos_buyer),
      },
      {
        method: getpaymentMethod("buy_tokens"),
        methodArgs: [Number(amount)],
        appForeignAssets: [assetID],
        appAccounts: [low_algos_buyer.addr],
        ...commonParams,
      },
    ];
    await expect(algotxn.makeATCCall(paymenttxn)).to.be.rejectedWith(Error);
  });

  it("Buying 0 token fails", async () => {
    await algotxn.holdingsoptintoasset(holdingsappId, assetID, creator);
    const number = Math.floor(Math.random() * (10000 - 1) + 1);
    await algotxn.transfertokenstoholdings(
      mintappId,
      assetID,
      holdingsAddress,
      Number(number),
      creator
    );
    //set amount to zero
    const amount = 0;
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
    await expect(algotxn.makeATCCall(paymenttxn)).to.be.rejectedWith(Error);
  });

  it("Transfer token to non holding app fails", async () => {
    //attempt to transfer tokens to dummy address
    await algotxn.fundAccount(creator, dummy.addr, 1e10);
    await algotxn.optIntoAsset(dummy, assetID);
    const number = Math.floor(Math.random() * (10000 - 1) + 1);
    await expect(
      algotxn.transfertokenstoholdings(
        mintappId,
        assetID,
        dummy.addr,
        Number(number),
        creator
      )
    ).to.be.rejectedWith(Error);
  });

  it("Burn token to non burn app fails", async () => {
    //attempt to burn tokens to dummy address
    const tokens_to_burn = Math.floor(Math.random() * (1000 - 1) + 1);
    await algotxn.fundAccount(creator, dummy.addr, 1e10);
    await expect(
      algotxn.burntokens(
        mintappId,
        assetID,
        dummy.addr,
        Number(tokens_to_burn),
        creator
      )
    ).to.be.rejectedWith(Error);
  });
});
