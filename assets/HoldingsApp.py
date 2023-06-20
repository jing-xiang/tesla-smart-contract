from beaker import *
from pyteal import *


class HoldingsAppState:
    # Init states here
    global_text = GlobalStateValue(
        stack_type=TealType.bytes,
        key=Bytes("GlobalText"),
        default=Bytes(""),
        descr="global state text",
    )


APP_NAME = "HoldingsApp"
app = Application(APP_NAME, state=HoldingsAppState())

# Add methods here

if __name__ == "__main__":
    app.build().export(f"./artifacts/{APP_NAME}")
