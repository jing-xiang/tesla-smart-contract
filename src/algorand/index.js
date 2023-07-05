import * as path from "path";
import algosdk from "algosdk";

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

const getAlgodClient = () => {
  return algodClient;
};

const readGlobalState = async (appId) => {
  const app = await algodClient.getApplicationByID(appId).do();

  const gsMap = new Map();

  // global state is a key value array
  const globalState = app.params["global-state"];
  globalState.forEach((item) => {
    // decode from base64 and utf8
    const formattedKey = decodeURIComponent(Buffer.from(item.key, "base64"));
    let formattedValue;
    if (item.value.type === 1) {
      if (formattedKey === "Address") {
        console.log(item.value.bytes);
        formattedValue = algosdk.encodeAddress(
          Buffer.from(item.value.bytes, "base64")
        );
      } else {
        formattedValue = decodeURIComponent(
          Buffer.from(item.value.bytes, "base64")
        );
      }
    } else {
      formattedValue = item.value.uint;
    }
    gsMap.set(formattedKey, formattedValue);
  });

  return gsMap;
};

const callApp = async (fromAccount, appIndex, appArgs, accounts) => {
  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  // call the created application
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    appIndex,
    appArgs,
    accounts,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const optIntoApp = async (fromAccount, appIndex) => {
  const acc = await algodClient.accountInformation(fromAccount.addr).do();
  const localStates = acc["apps-local-state"];

  const appLocalState = localStates.find((ls) => {
    return ls.id === appIndex;
  });

  // account has already opted into app
  if (appLocalState !== undefined) return;

  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  // call the created application
  const txn = algosdk.makeApplicationOptInTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    appIndex,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const optIntoAsset = async (fromAccount, assetId) => {
  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: fromAccount,
    to: fromAccount,
    assetIndex: assetId,
    amount: 0,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const makeATCCall = async (txns) => {
  // create atomic transaction composer
  const atc = new algosdk.AtomicTransactionComposer();

  // add calls to atc
  txns.forEach((txn) => {
    if (txn.method !== undefined) {
      atc.addMethodCall(txn);
    } else {
      atc.addTransaction(txn);
    }
  });

  // execute
  const result = await atc.execute(algodClient, 10);
  for (const idx in result.methodResults) {
    console.log(result.methodResults[idx]);
  }

  return result;
};

const getpaymentMethod = (methodName) => {
  const data = require("../../artifacts/HoldingsApp/contract.json");

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(data);

  const method = contract.methods.find((mt) => mt.name === methodName);

  if (method === undefined) throw Error("Method undefined: " + method);

  return method;
};

const accountInfo = async (addr) => {
  return await algodClient.accountInformation(addr).do();
};

const getAssetOptInTxn = async (algodClient, accAddr, assetId) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: accAddr,
    to: accAddr,
    assetIndex: assetId,
    suggestedParams,
  });
};

export {
  readGlobalState,
  callApp,
  optIntoApp,
  optIntoAsset,
  makeATCCall,
  getAlgodClient,
  getpaymentMethod,
  accountInfo,
  getAssetOptInTxn,
};
