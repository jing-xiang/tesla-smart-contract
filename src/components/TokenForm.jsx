import { useWallet } from "@txnlab/use-wallet";
import { useState } from "react";
import { getAlgodClient } from "../clients";
import Button from "./Button";

const network = process.env.NEXT_PUBLIC_NETWORK || "SandNet";
const algod = getAlgodClient(network);

export default function TokenForm({ onPurchase }) {
  const { activeAddress, signTransactions, sendTransactions } = useWallet();
  const [txnref, setTxnRef] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    // write your code here
    console.log("buying tokens!");
  };

  return (
    <div className="w-full">
      {txnref && <p className="mb-4">Txn ID: {txnref} </p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4 w-full">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="to"
          >
            Buy amount
          </label>
          <input className="w-full" name="asset_amount" type="number" />
        </div>
        <Button label="Buy" type="submit" />
      </form>
    </div>
  );
}
