import * as path from "path";
import * as fs from "fs";
import algosdk from "algosdk";
const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });

const algodClient = new algosdk.Algodv2(
  process.env.NEXT_PUBLIC_ALGOD_TOKEN,
  process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
  process.env.NEXT_PUBLIC_ALGOD_PORT
);

const getAlgodClient = () => {
  return algodClient;
};

const appID = parseInt(process.env.NEXT_PUBLIC_APP_ID);
console.log(appID);
const creator = algosdk.mnemonicToSecretKey(
  process.env.NEXT_PUBLIC_DEPLOYER_MNEMONIC
);
//const appAddress = algosdk.getApplicationAddress(appID);

const submitToNetwork = async (signedTxns) => {
  // send txn
  const response = await algodClient.sendRawTransaction(signedTxns).do();
  console.log(response);

  // Wait for transaction to be confirmed
  const confirmation = await algosdk.waitForConfirmation(
    algodClient,
    response.txId,
    4
  );

  return {
    response,
    confirmation,
  };
};

const getBasicProgramBytes = async (relativeFilePath) => {
  // Read file for Teal code
  const filePath = path.join(__dirname, relativeFilePath);
  console.log(filePath);
  const data = fs.readFileSync(filePath);

  // use algod to compile the program
  const compiledProgram = await algodClient.compile(data).do();
  return new Uint8Array(Buffer.from(compiledProgram.result, "base64"));
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
      if (
        formattedKey === "Burn Address" ||
        formattedKey === "Holding Address"
      ) {
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

const deployDemoApp = async (
  fromAccount,
  approvalpath,
  clearpath,
  globalint,
  globalbyteslice
) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const approvalProgram = await getBasicProgramBytes(approvalpath);
  const clearProgram = await getBasicProgramBytes(clearpath);

  // global / local states
  const numGlobalInts = globalint;
  const numGlobalByteSlices = globalbyteslice;
  const numLocalInts = 0;
  const numLocalByteSlices = 0;

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    approvalProgram,
    clearProgram,
    numGlobalInts,
    numGlobalByteSlices,
    numLocalInts,
    numLocalByteSlices,
  });
  console.log(txn);

  const signedTxn = txn.signTxn(fromAccount.sk);
  console.log(signedTxn);
  return await submitToNetwork(signedTxn);
};

const fundAccount = async (fromAccount, to, amount) => {
  let suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: fromAccount.addr,
    to,
    amount,
    suggestedParams,
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
    from: fromAccount.addr,
    to: fromAccount.addr,
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

const createAssetTransferTxn = async (
  algodClient,
  sender,
  receiver,
  assetId,
  amount
) => {
  // create suggested parameters
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: sender,
    to: receiver,
    assetIndex: assetId,
    amount,
    suggestedParams,
  });

  return txn;
};

const getMethod = (methodName, path) => {
  const data = require(path);

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

const mintTokens = async (appID, fromAccount) => {
  const total = 1000000; // total supply
  const decimals = 0; // units of this asset are whole-integer amounts
  const assetName = "Tesla"; //token asset name
  const unitName = "TSLA"; //token unit name

  // create suggested parameters
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: fromAccount.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(fromAccount),
  };

  // create the asset creation transaction
  const txn = [
    {
      method: getMethod("mint_tokens", "../artifacts/MintApp/contract.json"),
      methodArgs: [total, decimals, assetName, unitName],
      ...commonParams,
    },
  ];

  // sign the transaction and submit to network
  // sign and submit the transaction
  const txnOutputs = await makeATCCall(txn);
  const assetID = Number(txnOutputs.methodResults[0].returnValue);
  console.log(`Asset ${assetID} created by contract`);

  console.log("txnOutputs: ", txnOutputs);
  return assetID;
};

const holdingsoptintoasset = async (appID, assetID, fromAccount) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: fromAccount.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(fromAccount),
  };

  // create the asset creation transaction
  const txn = [
    {
      method: getMethod(
        "optintoasset",
        "../artifacts/HoldingsApp/contract.json"
      ),
      methodArgs: [assetID],
      appForeignAssets: [assetID],
      ...commonParams,
    },
  ];

  // sign the transaction and submit to network
  // sign and submit the transaction
  const txnOutputs = await makeATCCall(txn);
  console.log(txnOutputs);
  const appGS = await readGlobalState(appID);
  console.log(appGS);
};

const burnoptintoasset = async (appID, assetID, fromAccount) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: fromAccount.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(fromAccount),
  };

  // create the asset creation transaction
  const txn = [
    {
      method: getMethod("optintoasset", "../artifacts/BurnApp/contract.json"),
      methodArgs: [assetID],
      appForeignAssets: [assetID],
      ...commonParams,
    },
  ];

  // sign the transaction and submit to network
  // sign and submit the transaction
  const txnOutputs = await makeATCCall(txn);
  console.log(txnOutputs);
  const appGS = await readGlobalState(appID);
  console.log(appGS);
};

const transfertokenstoholdings = async (
  appID,
  assetID,
  holdingsaddr,
  amount,
  fromAccount
) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: fromAccount.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(fromAccount),
  };

  console.log(amount);

  // create the asset creation transaction
  const txn = [
    {
      method: getMethod("send_tokens", "../artifacts/MintApp/contract.json"),
      methodArgs: [amount],
      appForeignAssets: [assetID],
      appAccounts: [holdingsaddr],
      ...commonParams,
    },
  ];

  // sign the transaction and submit to network
  // sign and submit the transaction
  const txnOutputs = await makeATCCall(txn);
  console.log(txnOutputs);
  const appGS = await readGlobalState(appID);
  console.log(appGS);
};

const updatecontracts = async (appID, holdingsaddr, burnaddr) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: creator.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(creator),
  };

  // create the asset creation transaction
  const txn = [
    {
      method: getMethod(
        "update_contracts",
        "../artifacts/MintApp/contract.json"
      ),
      appAccounts: [holdingsaddr, burnaddr],
      ...commonParams,
    },
  ];

  // sign the transaction and submit to network
  // sign and submit the transaction
  const txnOutputs = await makeATCCall(txn);
  console.log(txnOutputs);
  const appGS = await readGlobalState(appID);
  console.log(appGS);
};

const burntokens = async (appID, assetID, burnaddr, amount, fromAccount) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: fromAccount.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(fromAccount),
  };

  console.log(amount);

  // create the asset creation transaction
  const txn = [
    {
      method: getMethod("burn_tokens", "../artifacts/MintApp/contract.json"),
      methodArgs: [amount],
      appForeignAssets: [assetID],
      appAccounts: [burnaddr],
      ...commonParams,
    },
  ];

  // sign the transaction and submit to network
  // sign and submit the transaction
  const txnOutputs = await makeATCCall(txn);
  console.log(txnOutputs);
  const appGS = await readGlobalState(appID);
  console.log(appGS);
};

const updateprice = async (appID, price, fromAccount) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: fromAccount.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(fromAccount),
  };

  // create the asset creation transaction
  const txn = [
    {
      method: getMethod(
        "update_price",
        "../artifacts/HoldingsApp/contract.json"
      ),
      methodArgs: [price],
      ...commonParams,
    },
  ];

  // sign the transaction and submit to network
  // sign and submit the transaction
  const txnOutputs = await makeATCCall(txn);
  console.log(txnOutputs);
  const appGS = await readGlobalState(appID);
  console.log(appGS);
};

export {
  fundAccount,
  readGlobalState,
  optIntoApp,
  optIntoAsset,
  submitToNetwork,
  makeATCCall,
  getAlgodClient,
  createAssetTransferTxn,
  getMethod,
  accountInfo,
  getAssetOptInTxn,
  mintTokens,
  deployDemoApp,
  holdingsoptintoasset,
  burnoptintoasset,
  transfertokenstoholdings,
  updatecontracts,
  burntokens,
  updateprice,
};
