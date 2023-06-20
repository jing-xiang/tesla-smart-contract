# Tesla Coin Developer Assessment
In this assessment, complete the dapp to allow users to connect their wallet accounts and purchase TESLA coins. You will also need to deploy the contracts required to mint and transfer the coins.

#### TESLA coin details
- total amount: 1000000
- decimals: 0
- asset name: Tesla
- asset unit name: TSLA
- manager: -
- clawback : -
- freeze: -
- reserve: -

## Stateful smart contracts

### ABI Compliance
All contracts are required to follow [ARC4](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0004.md) standards.

### Minting Contract
Complete the stateful smart contract `assets/MintApp.py` which allows only the contract creator to mint, transfer and burn TESLA coins. These are the following features required for each function,

#### Minting
1. Prevent double asset creation.
2. Create TESLA asset via app call.

#### Transfer
1. Enough supply to conduct asset transfer.
2. Asset must be created before calling this function.
3. Verify address of the holdings contract.
4. Transfer TESLA coins to holding contract.

#### Burn
1. Enough supply to conduct asset transfer.
2. Verify address of the burn contract.
3. Transfer TESLA coins to burn contract.

#### Update Addresses
1. Stores burn and holding app addresses for verification purposes.

### Holdings Contract
Complete the stateful smart contract `assets/HoldingsApp.py` which allows the opt in users to purchase TESLA coins at the cost of `1 TSLA = 5 Algos`. Contract creator can update the price if necessary.

#### Init
1. Saves asset ID and current purchase price in global state.

#### Asset Opt In
1. Contract creator function.
2. App call to allow contract to opt into that asset.

#### Update price
1. Contract creator function.
2. Saves the updated price in global state.

#### Sell tokens
1. Check existing supply in the holdings contract before selling the tokens.
2. The sender will have to pay for the inner transaction fees issued by the holdings contract.

### Burn Contract
Complete the stateful smart contract `assets/BurnApp.py` which allows contract creator to send TESLA coins to it. This contract should not allow anyone to transfer coins out of it.

#### Init
1. Saves asset ID in global state.
   
#### Asset Opt In
1. Contract creator function.
2. App call to allow contract to opt into that asset.

## Deployment flow
1. Deploy and fund the mint contract.
2. Create TESLA token.
3. Deploy the holdings contract.
4. Deploy the burn contract.
5. Perform asset opt in for holding and burn contracts.
6. Transfer tokens to holdings contract for public to purchase

Complete the necessary server side actions in `scripts/actions` folder to allow creator to `update prices`, `transfer` and `burn supply`.

## Frontend interaction
Complete the necessary codes in the `src` folder so that end users can do the following,

1. Connect to their account in the Dapp via a web3 wallet.
2. Allow user to successfully buy TESLA coins.
3. Display remaining TESLA coins in the holding contract.

## Testing
Write test cases to cover the successful contract deployment, as well as negative tests. Testing should be done on `SandNet`.

Your contracts should cover at least the following negative tests.

- Double asset creation fails
- Asset creation fails when non-creator calls
- Asset transfer fails when supply is insufficient
- Asset burn fails when supply is insufficient
- Asset transfer fails when non-creator calls
- Asset burn fails when non-creator calls
- Updating price of asset fails when not called by creator
- Selling token fails when supply < amount sold
- Selling tokens fails when transaction is not grouped
- Buying 0 token fails
- Buying tokens with insufficient algos
- Transfer token to non holding app fails
- Burn token to non burn app fails

## Setup instructions

### 1. Install Python Packages
Run `algokit bootstrap poetry`

### 2. Install NPM Packages
Run `yarn install`

### 3. Run virtual env
Run `poetry shell`

### 4. Update environement variables
1. Copy `.env.example` to `.env.local`.
2. Update credentials in `.env.local` file.

### 4. Compile Contracts
Run `python assets/<filename>`

### 5. Deploy
Run `yarn run tsx scripts/deploy.js`

### 6. Run tests
Run `yarn test` (shortcut to run mocha tests)
