from beaker import *
from pyteal import *


class MintAppState:
    # Init states here
    burn_address = GlobalStateValue(
        stack_type=TealType.bytes,
        key=Bytes("Burn Address"),
        default=Bytes(""),
        descr="Burn Address",
    )

    holding_address = GlobalStateValue(
        stack_type=TealType.bytes,
        key=Bytes("Holding Address"),
        default=Bytes(""),
        descr="Holding Address",
    )
    assetID = GlobalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("Asset ID"),
        default=Int(0),
        descr="Asset ID",
    )


APP_NAME = "MintApp"
app = Application(APP_NAME, state=MintAppState())

# Add methods here

@app.create(bare=True)
def create():
    return Seq(
    app.initialize_global_state(),
    app.state.holding_address.set(Txn.sender()),  # set initial admin
    app.state.burn_address.set(Txn.sender()) # Set platformFee
    )

@Subroutine(TealType.uint64)
def basic_checks():
    return And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address(),
    )


@app.external(authorize=Authorize.only(Global.creator_address()))
def update_addresses(*,output: abi.String): 
    return Seq(
        Assert(Txn.sender() == Global.creator_address()),
        Assert(basic_checks()),
        app.state.holding_address.set(Txn.accounts[1]),
        app.state.burn_address.set(Txn.accounts[2]),
        output.set("Updated holdings and burn accounts!"),
    )

@app.external(authorize=Authorize.only(Global.creator_address()))
def mint_tokens(
    amount: abi.Uint64,
    decimals: abi.Uint64,
    assetName: abi.String,
    unitName: abi.String,
    *,
    output: abi.Uint64
    ):
    return Seq(
        Assert(Txn.sender() == Global.creator_address()),
        Assert(Balance(Txn.sender()) >= Int(1000)), #Check if deployer has enough algos to pay for txn fees
        Assert(app.state.assetID.get()==Int(0)), #Check if there is already an assset existing in the account
        Assert(Txn.fee() == Int(2000000)),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetConfig,
                TxnField.config_asset_name: assetName.get(),
                TxnField.config_asset_unit_name: unitName.get(),
                TxnField.config_asset_decimals: decimals.get(),
                TxnField.config_asset_total: amount.get()
            }
        ),
        InnerTxnBuilder.Submit(),
        app.state.assetID.set(InnerTxn.created_asset_id()),
        output.set(InnerTxn.created_asset_id())
    )

@app.external(authorize=Authorize.only(Global.creator_address()))
def send_tokens(amount: abi.Uint64, *, output: abi.String):
    return Seq(
        Assert(basic_checks()),
        Assert(Txn.sender() == Global.creator_address()),
        Assert(Txn.accounts[1] == app.state.holding_address.get()),
        Assert(Txn.assets[0] == app.state.assetID.get()),
        # Transfer Asset
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # first foreign asset
                TxnField.asset_receiver: Txn.accounts[1],
                TxnField.asset_amount: amount.get(),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Tokens transferred to holdings contract!"),
    )

@app.external(authorize=Authorize.only(Global.creator_address()))
def burn_tokens(amount: abi.Uint64, *, output: abi.String):
    return Seq(
        Assert(basic_checks()),
        Assert(Txn.sender() == Global.creator_address()),
        Assert(Txn.assets[0] == app.state.assetID.get()),
        Assert(Txn.accounts[1] == app.state.burn_address.get()),
        # Transfer Asset
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: Txn.assets[0],  # first foreign asset
                TxnField.asset_receiver: Txn.accounts[1],
                TxnField.asset_amount: amount.get(),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set("Tokens burned!"),
    )

if __name__ == "__main__":
    app.build().export(f"./artifacts/{APP_NAME}")
