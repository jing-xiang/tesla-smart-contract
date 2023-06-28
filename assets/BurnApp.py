from beaker import *
from pyteal import *


class BurnAppState:
    # Init states here
    assetID = GlobalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("Asset ID"),
        default=Int(0),
        descr="Asset ID",
    )


APP_NAME = "BurnApp"
app = Application(APP_NAME, state=BurnAppState())

# Add methods here
@app.create(bare=True)
def create():
    return Seq(
    app.initialize_global_state(),
    )

@Subroutine(TealType.uint64)
def basic_checks():
    return And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address(),
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

if __name__ == "__main__":
    app.build().export(f"./artifacts/{APP_NAME}")
