from beaker import *
from pyteal import *


class HoldingsAppState:
    # Init states here
   assetID = GlobalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("Asset ID"),
        default=Int(0),
        descr="Asset ID",
    )
   
   current_price = GlobalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("Current Price"),
        default=Int(0),
        descr="Current Price",
    )


APP_NAME = "HoldingsApp"
app = Application(APP_NAME, state=HoldingsAppState())

# Add methods here
@app.create(bare=True)
def create():
    return Seq(
    app.initialize_global_state(),
    app.state.current_price.set(Int(5000000))
    )

@Subroutine(TealType.uint64)
def basic_checks():
    return And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address(),
    )

@app.external(authorize=Authorize.only(Global.creator_address()))
def update_price(price: abi.Uint64, *,output: abi.String): 
    return Seq(
        Assert(Txn.sender() == Global.creator_address()),
        Assert(basic_checks()),
        app.state.current_price.set(price.get()),
        output.set("Updated token price!"),
    )

#contract opts in to asset
@app.external(authorize=Authorize.only(Global.creator_address()))
def optintoasset(assetID: abi.Uint64, *, output: abi.String):
    close = Seq([
        Assert(basic_checks()),
        Assert(Txn.sender() == Global.creator_address()),  
    ])
    
    on_close = Seq([
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # ASA index
                TxnField.asset_receiver: Global.current_application_address(),
                TxnField.asset_amount: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
        app.state.assetID.set(assetID.get()),
        output.set("Asset Opted in!")
    ])
    
    return Seq([close, on_close])

@app.external
def buy_tokens(amount: abi.Uint64,*, output: abi.String):
    contractassetbalance = AssetHolding.balance(Global.current_application_address(), Txn.assets[0])
    receiverassetbalance = AssetHolding.balance(Txn.accounts[1], Txn.assets[0])
    return Seq(
        contractassetbalance,
        Assert(contractassetbalance.value() >= amount.get()),
        receiverassetbalance,
        Assert(receiverassetbalance.hasValue()),
        Assert(basic_checks()),
        Assert(Gtxn[0].amount() == amount.get() * app.state.current_price.get()),
        Assert(Gtxn[0].type_enum() == TxnType.Payment),
        Assert(amount.get() > Int(0)),
        # Transfer Asset
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # first foreign asset
                TxnField.asset_receiver: Txn.accounts[1],
                TxnField.asset_amount: amount.get(),
                TxnField.fee: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Tokens bought!"),
    )

if __name__ == "__main__":
    app.build().export(f"./artifacts/{APP_NAME}")
