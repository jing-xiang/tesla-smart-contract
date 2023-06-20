from beaker import *
from pyteal import *


class MintAppState:
    # Init states here
    global_text = GlobalStateValue(
        stack_type=TealType.bytes,
        key=Bytes("GlobalText"),
        default=Bytes(""),
        descr="global state text",
    )


APP_NAME = "MintApp"
app = Application(APP_NAME, state=MintAppState())

# Add methods here

if __name__ == "__main__":
    app.build().export(f"./artifacts/{APP_NAME}")
