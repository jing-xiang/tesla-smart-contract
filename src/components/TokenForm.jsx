import { useWallet } from "@txnlab/use-wallet";
import { useState } from "react";
import Button from "./Button";
import algosdk from "algosdk";
import * as algotxn from "../algorand/index.js";
const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";

const assetID = Number(process.env.NEXT_PUBLIC_ASSET_ID);
const appAddress = process.env.NEXT_PUBLIC_HOLDINGS_ADDRESS;
const appID = Number(process.env.NEXT_PUBLIC_HOLDINGS_ID);



export default function TokenForm({ onPurchase }) {
  const { activeAddress, signTransactions, sendTransactions, signer } = useWallet();
  const [txnref, setTxnRef] = useState("");
  const [txnUrl, setTxnUrl] = useState("");
  const [amount, setamount] = useState("");

  const getTxnRefUrl = (txId) => {
    if (network === "SandNet") {
      return `https://app.dappflow.org/explorer/transaction/${txId}`;
    } else if (network === "TestNet") {
      return `https://testnet.algoexplorer.io/tx/${txId}`;
    }

    return "";
  };
  

  const handleSubmit = async (event) => {
   
    event.preventDefault();
    const algodClient = new algosdk.Algodv2(
      process.env.NEXT_PUBLIC_ALGOD_TOKEN,
      process.env.NEXT_PUBLIC_ALGOD_ADDRESS,
      process.env.NEXT_PUBLIC_ALGOD_PORT
    );
    const appGS = await algotxn.readGlobalState(appID);
    const currentprice = Number(appGS.get("Current Price"));
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    const commonParams = {
      appID,
      sender: activeAddress,
      suggestedParams,
      signer,
    };

    // write your code here
    console.log("buying tokens!");
    const optInASATxn =
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: activeAddress,
        suggestedParams,
        assetIndex: assetID,
        amount: 0,
      });

    //sign and submit transaction for ASA opt in
    const payload = [optInASATxn];
    const groupedTxn = algosdk.assignGroupID(payload);
    const encodedTxns = groupedTxn.map((txn) =>
      algosdk.encodeUnsignedTransaction(txn)
    );
    const signed = await signTransactions(encodedTxns);
    const res = await sendTransactions(signed, 4);
    console.log(res);

      const paymenttxn = [
        {
          txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            from: activeAddress,
            to: appAddress,
            amount: currentprice * amount,
            suggestedParams,
          }),
          signer: signer,
        },
        {
          method: algotxn.getpaymentMethod("buy_tokens"),
          methodArgs: [Number(amount)],
          appForeignAssets: [assetID],
          appAccounts: [activeAddress],
          ...commonParams,
        },
      ];
      const result = await algotxn.makeATCCall(paymenttxn);
      setTxnRef(result.txIDs[1]);
      setTxnUrl(getTxnRefUrl(result.txIDs[1]));
  };

  return (
    <div className="w-full">
      {activeAddress && txnref && (
            <p className="mb-4 text-left">
              <a href={txnUrl} target="_blank" className="text-blue-500">
                Tx ID: {txnref}
              </a>
            </p>
          )}
      <form onSubmit={handleSubmit}>
        <div className="mb-4 w-full">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="to"
          >
            Buy amount
          </label>
          <input className="w-full block text-gray-700 text-sm font-bold mb-2" name="asset_amount" type="number" min={1} onChange={(e) => setamount(e.target.value)} required/>
        </div>
        <Button label="Buy" type="submit" />
      </form>
    </div>
  );
}
