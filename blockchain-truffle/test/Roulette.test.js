const { expectRevert } = require('../node_modules/@openzeppelin/test-helpers')
const RouletteMock = artifacts.require("RouletteMock")
const truffleAssert = require('truffle-assertions');
const contractPrivateKey = 'fce6da7b794cafa97d20bf8324a482a20355dd2751364fec6cc32d29b87dac1f'


contract('RouletteMock', function (accounts) {
    let rouletteInstance

    beforeEach(async function () {
        rouletteInstance = await RouletteMock.deployed()
    })

    // it("check address balance", async () => {
    //     const initialBalance = await web3.eth.getBalance(accounts[0])
    //     console.log('initial Balance ' + initialBalance)
    //     const initialBalanceSecond = await web3.eth.getBalance(accounts[1])
    //     console.log('initial Balance accounts[1]' + initialBalanceSecond)
    // })

    it('Contract deployed correctly', async function () {
        const contractAddress = rouletteInstance.address
        assert.notEqual(contractAddress, 0x0, 'Contract address is not null')
        assert.notEqual(contractAddress, '', 'Contract address is not empty')
        assert.notEqual(contractAddress, null, 'Contract address is not null')
        assert.notEqual(contractAddress, undefined, 'Contract address is not undefined')
    })

    it("Successfully registers user", async () => {
        const message = 'Verifying message ';
        const nonceString = '1';
        //doesnt use the same exact random number generation technique as front end, this is however unimportant because the content of the matter is irrelevant to the whether a user can successfully register (it is which addres signs it)
        const messageConcat = message + nonceString
        const signedMessage = web3.eth.accounts.sign(messageConcat, contractPrivateKey)
        //private key of owner (accounts[0])
        //is a testnet account, doesnt matter if its exposed

        const initialUsers = await rouletteInstance.getApprovedUsers.call()
        assert.equal(initialUsers.length, 0, "Initial approved users array should be empty")
        const userAddress = accounts[1]
        result = await rouletteInstance.registerUser(userAddress, signedMessage.messageHash, signedMessage.v, signedMessage.r, signedMessage.s)
        const updatedUsers = await rouletteInstance.getApprovedUsers.call()
        truffleAssert.eventEmitted(result, 'RegisterUser', (event) => {
            return event.user.toString() === accounts[1]
        })
        assert.equal(updatedUsers.length, 1, "Approved users array should have one element")
        assert.equal(updatedUsers[0], userAddress, "Approved user address should match")
    })
    it("Successfully fails non-owner registering user", async () => {
        const message = 'Verifying message ';
        const nonceString = '1';
        //doesnt use the same exact random number generation technique as front end, this is however unimportant because the content of the matter is irrelevant to the whether a user can successfully register (it is which addres signs it)
        const messageConcat = message + nonceString
        const signedMessage = web3.eth.accounts.sign(messageConcat, 'c3d5f4a213616426aeae02c13a6af315a4a9888bc9bfa0ba78f92ec6e1d3e3dc')
        //this is private key of accounts[1]

        const initialUsers = await rouletteInstance.getApprovedUsers.call()
        assert.equal(initialUsers.length, 1, "Initial approved users array should contain accounts[1]")
        const userAddress = accounts[2]
        await expectRevert(
            rouletteInstance.registerUser(userAddress, signedMessage.messageHash, signedMessage.v, signedMessage.r, signedMessage.s), "Only the Dapp can register a user"
        )
        const updatedUsers = await rouletteInstance.getApprovedUsers.call()
        assert.equal(updatedUsers.length, 1, "Approved users array should have one element")
    })

    it("Successfully rejects an unverified user from playing", async () => {
        const unregisteredUser = accounts[8]
        const betAmount = web3.utils.toWei("0.1", "ether")
        const betNumbers = [0]
        // Try to place bet with unregistered user
        try {
            await rouletteInstance.placeBet(betNumbers, { from: unregisteredUser, value: betAmount })
            assert.fail("Expected exception not thrown")
        } catch (error) {
            assert.include(error.message, "User is not verified", "Unexpected error message")
        }
    })

    it("Successfully fails if user stake is above or below the maximum or minimum stake", async () => {
        const userBet = web3.utils.toWei("0.0000000001", "ether")
        await expectRevert(
            rouletteInstance.placeBet([0], { value: userBet, from: accounts[1] }),
            "Stake is below the minimum stake"
        )
        const userBetHigh = web3.utils.toWei("100", "ether")
        await expectRevert(
            rouletteInstance.placeBet([0], { value: userBetHigh, from: accounts[1] }),
            "Stake is above the maximum stake"
        )
    })
    it("Successfully fails if casino does not have enough funds ", async () => {
        const userBet = web3.utils.toWei("0.5", "ether")
        await expectRevert(
            rouletteInstance.placeBet([0], { value: userBet, from: accounts[1] }),
            "Casino does not have enough funds"
        )
    })

    it("Successfully add funds to the casino", async () => {
        const amountToSend = 2 * (10 ** 15)
        const initialBalance = await web3.eth.getBalance(rouletteInstance.address)
        await rouletteInstance.addFunds({ value: amountToSend })
        const endBalance = await web3.eth.getBalance(rouletteInstance.address)
        assert.equal(endBalance, amountToSend, "Address does not have the right amount of funds")
    })

    it("Successfully rejects invalid bets", async () => {
        const userBetAmount = 1 * (10 ** 13)
        var userBet = []
        await expectRevert(
            rouletteInstance.placeBet(userBet, { value: userBetAmount, from: accounts[1] }),
            "Need to make a valid bet"
        )
        userBet = [1, 2, 3, 4, 5, 6, 7]
        await expectRevert(
            rouletteInstance.placeBet(userBet, { value: userBetAmount, from: accounts[1] }),
            "Need to make a valid bet"
        )
    })

    it("Winning bet is Placed correctly, random number is stored correctly and events are emitted with correct values", async () => {
        const userBetAmount = 1 * (10 ** 13)
        const userBet = [1, 2, 3, 4, 5, 6]

        result = await rouletteInstance.placeBet(userBet, { value: userBetAmount, from: accounts[1] })
        truffleAssert.eventEmitted(result, 'RequestSent', (event) => {
            return event.requestId.toNumber() === 1
        })
        truffleAssert.eventEmitted(result, 'BetPlaced', (event) => {
            return event.gameId.toNumber() === 1 && event.betPlaced.every((val, index) => val == [1, 2, 3, 4, 5, 6][index]) && event.requestId.toNumber() === 1 && event.betValue.toNumber() === userBetAmount && event.user.toString() === accounts[1]
        });
        truffleAssert.eventEmitted(result, 'RequestStored', (event) => {
            return event.requestId.toNumber() === 1 && event.randomWords.toNumber() === 39
        });
    })

    it("Won game ends successfully and events are emitted with correct values", async () => {

        betAmount = 1 * (10 ** 13)
        const initialBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        const initialBalanceUser = await web3.eth.getBalance(accounts[1])
        result = await rouletteInstance.endGame(1, { from: accounts[1] })

        truffleAssert.eventEmitted(result, 'GameFinished', (event) => {
            return event.id.toNumber() === 1 && event.bet.every((val, index) => val == [1, 2, 3, 4, 5, 6][index]) && event.betAmount.toNumber() === betAmount && event.user.toString() === accounts[1] && event.win === true && event.winnings.toNumber() === 4 * betAmount
        })
        const endBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        const endBalanceUser = await web3.eth.getBalance(accounts[1])
        minValue = 26000000000000000
        maxValue = 27000000000000000
        userBalanceChange = Math.abs(endBalanceUser - initialBalanceUser)
        assert.equal(endBalanceCasino, initialBalanceCasino - 5 * betAmount, "Casino transferred correct amount of money")
        assert.equal(userBalanceChange >= minValue && userBalanceChange <= maxValue, true, "User was transferred correct amount of money")
    })

    it("Lost bet is Placed correctly, random number is stored correctly and events are emitted with correct values", async () => {
        const userBetAmount = 1 * (10 ** 13)
        const userBet = [0]

        result = await rouletteInstance.placeBet(userBet, { value: userBetAmount, from: accounts[1] })
        truffleAssert.eventEmitted(result, 'RequestSent', (event) => {
            return event.requestId.toNumber() === 2
        })
        truffleAssert.eventEmitted(result, 'BetPlaced', (event) => {
            return event.gameId.toNumber() === 2 && event.betPlaced.every((val, index) => val == [0][index]) && event.requestId.toNumber() === 2 && event.betValue.toNumber() === userBetAmount && event.user.toString() === accounts[1]
        });
        truffleAssert.eventEmitted(result, 'RequestStored', (event) => {
            return event.requestId.toNumber() === 2 && event.randomWords.toNumber() === 39
        });
    })

    it("Lost game ends successfully and events are emitted with correct values", async () => {
        betAmount = 1 * (10 ** 13)
        const initialBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        const initialBalanceUser = await web3.eth.getBalance(accounts[1])
        result = await rouletteInstance.endGame(2, { from: accounts[1] })

        truffleAssert.eventEmitted(result, 'GameFinished', (event) => {
            return event.id.toNumber() === 2 && event.bet.every((val, index) => val == [0][index]) && event.betAmount.toNumber() === betAmount && event.user.toString() === accounts[1] && event.win === false && event.winnings.toNumber() === 0
        })

        const endBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        const endBalanceUser = await web3.eth.getBalance(accounts[1])

        minValue = 15000000000000000
        maxValue = 17000000000000000

        userBalanceChange = Math.abs(endBalanceUser - initialBalanceUser)
        assert.equal(endBalanceCasino, initialBalanceCasino, "Casino transferred money despite user losing")
        assert.equal(userBalanceChange >= minValue && userBalanceChange <= maxValue, true, "User was transferred correct amount of money")
    })

    it("End Game Successfully fails if game has already finished", async () => {
        await expectRevert(
            rouletteInstance.endGame(2, { from: accounts[1] }), "Game has already been finished."
        )
    })
    it("End Game Successfully fails if game does not exist", async () => {
        await expectRevert(
            rouletteInstance.endGame(3, { from: accounts[1] }), "Game does not exist."
        )
    })


    it("Successfully doesn't allow non-owner to deregister users", async () => {
        await expectRevert(
            rouletteInstance.unregisterUser(accounts[1], { from: accounts[1] }), "Address is not the casino"
        )
    })
    it("Successfully allow owner to deregister users", async () => {
        const userAddress1 = accounts[1]
        const userAddress2 = accounts[2]
        const message = 'Verifying message ';
        const nonceString = '1';
        //doesnt use the same exact random number generation technique as front end, this is however unimportant because the content of the matter is irrelevant to the whether a user can successfully register (it is which addres signs it)
        const messageConcat = message + nonceString
        const signedMessage = web3.eth.accounts.sign(messageConcat, contractPrivateKey)
        //private key of owner (accounts[0])
        //is a testnet account, doesnt matter if its exposed
        var users = await rouletteInstance.getApprovedUsers.call()
        assert.equal(users.length, 1, "Initial approved users array should have 1 account ")
        result = await rouletteInstance.registerUser(userAddress2, signedMessage.messageHash, signedMessage.v, signedMessage.r, signedMessage.s)
        users = await rouletteInstance.getApprovedUsers.call()
        assert.equal(users.length, 2, "Initial approved users array should have 2 accounts ")
        result = await rouletteInstance.unregisterUser(userAddress2)
        users = await rouletteInstance.getApprovedUsers.call()
        assert.equal(users.length, 1, "Initial approved users array should have 1 account ")
        result = await rouletteInstance.unregisterUser(userAddress1)
        users = await rouletteInstance.getApprovedUsers.call()
        assert.equal(users.length, 0, "Updated approved users array should have 0 accounts")
    })
    it("Successfully rejects non-owner to withdraw funds and withdrawal of more funds than available", async () => {
        await expectRevert(
            rouletteInstance.withdrawFundsWei(10, { from: accounts[1] }), "Address is not the casino"
        )
        await expectRevert(
            rouletteInstance.withdrawAllFunds({ from: accounts[1] }), "Address is not the casino"
        )
    })
    it("Successfully fails if attempting to withdraw more funds than available", async () => {
        initialBalance = await web3.eth.getBalance(rouletteInstance.address)
        await expectRevert(
            rouletteInstance.withdrawFundsWei(initialBalance + 1), "Attempting to withdraw more funds than casino has available"
        )
    })
    it("Successfully withdraw a specified amount of money", async () => {
        const withdrawalAmount = 10000000000000
        const initialBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        result = await rouletteInstance.withdrawFundsWei(withdrawalAmount)
        truffleAssert.eventEmitted(result, 'Withdrawn', (event) => {
            return event.casino.toString() === accounts[0] && event.amount.toNumber() === withdrawalAmount
        })
        const finalBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        assert.equal(finalBalanceCasino, (initialBalanceCasino - withdrawalAmount), "Did not successfully withdraw the right amount")
    })
    it("Successfully withdraw all remaining funds", async () => {
        const initialBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        assert.notEqual(initialBalanceCasino, 0, "Did not successfully withdraw all remaining funds")
        result = await rouletteInstance.withdrawAllFunds()
        truffleAssert.eventEmitted(result, 'Withdrawn', (event) => {
            return event.casino.toString() === accounts[0] && event.amount.toNumber() === 1960000000000000
            //this value is less than the full balance because of gas fees
        })
        const finalBalanceCasino = await web3.eth.getBalance(rouletteInstance.address)
        assert.equal(finalBalanceCasino, 0, "Did not successfully withdraw all remaining funds")

    })
    it("Successfully prevents non-owner from changing owner", async () => {
        await expectRevert(
            rouletteInstance.changeOwner(accounts[2], { from: accounts[1] }), "Address is not the casino"
        )
    })
    it("Successfully changes owner", async () => {
        result = await rouletteInstance.changeOwner(accounts[2])

        truffleAssert.eventEmitted(result, 'OwnershipTransferredSuccessfully', (event) => {
            return event.previousOwner.toString() === accounts[0] && event.newOwner.toString() === accounts[2]
        })

        await expectRevert(
            rouletteInstance.changeOwner(accounts[0], { from: accounts[1] }), "Address is not the casino"
        )

    })

    //  it("refresh 1st account", async () => {
    //         const initialBalance1 = await web3.eth.getBalance(accounts[0])
    //         console.log('initial ' + initialBalance1 / (10 ** 18))
    //         const initialBalance2 = await web3.eth.getBalance(accounts[9])
    //         console.log('initial ' + initialBalance2 / (10 ** 18))

    //         web3.eth.sendTransaction({ 
    //             from: accounts[9],
    //             to: accounts[0],
    //             value: initialBalance2 * 0.9
    //         })

    //         const initialBalance4 = await web3.eth.getBalance(accounts[0])
    //         console.log('initial ' + initialBalance4 / (10 ** 18))
    //         const initialBalance3 = await web3.eth.getBalance(accounts[9])
    //         console.log('initial ' + initialBalance3 / (10 ** 18))



    //       })
})