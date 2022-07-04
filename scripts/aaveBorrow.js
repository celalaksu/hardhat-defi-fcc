const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")
async function main() {
    // the protocol (aave) treats everything as an ERC20 token
    await getWeth()
    const { deployer } = await getNamedAccounts()
    // we need abi and aave contract adres

    // Lending Pool Address Provider : 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
    const lendingPool = await getLendingPool(deployer)
    console.log(`Lending Pool address : ${lendingPool.address}`)

    // deposit! To deposit first we need to approve to aave
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    // approve
    await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing..............========")
    // deposit
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("DEPOSİTED==============")

    // BORROW TIME - borrow other assets with deposited weth
    // We want to know how much we can borrow.
    // how much we have in collateral
    // how much we have borrowed
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)
    const daiPrice = await getDAIPrice()
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log(`You can borrow ${amountDaiToBorrow} DAI.`)
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())

    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    await borrowDAI(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)
    console.log("After borrowed=========================")
    await getBorrowUserData(lendingPool, deployer)

    await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
    console.log("After repaid====================")
    await getBorrowUserData(lendingPool, deployer)
}
async function repay(amount, daiAddress, lendigPool, account) {
    await approveERC20(daiAddress, lendigPool.address, amount, account)
    const repayTx = await lendigPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log(`Repaid`)
}
async function borrowDAI(daiAddress, lendigPool, amountDaiToBorrowWei, account) {
    const borrowTx = await lendigPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log(`You are borrowed !`)
}
async function getDAIPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4" // DAI/ETH price addres
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`The DAI/ETH price is ${price.toString()}`)
    return price
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited.`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed.`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`)
    return { availableBorrowsETH, totalDebtETH }
}

async function getLendingPool(account) {
    // abi, address
    const lendingPoolAddressProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account
    )
    const lendingPoolAddress = await lendingPoolAddressProvider.getLendingPool()
    const lendigPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendigPool
}
// spenderAddress--> this is going to be the contract that
// weare going to give the approval to, to spend our token
// amount -->amount to spend, how much we want to approve it
async function approveERC20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("APPROVED")
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
