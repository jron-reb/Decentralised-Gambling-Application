import Head from "next/head";
import Image from 'next/image'
import 'bulma/css/bulma.css'
import { VStack, HStack, Button, Input } from '@chakra-ui/react'
import React, { useState } from "react";
import Web3 from 'web3'
import rouletteContract from "@/constants/abi";

export default function Home() {
  const [betAmount, setBetAmount] = useState(0)
  const [userAddress, setUserAddress] = useState('')
  const [userRegistered, setUserRegistered] = useState(false)
  const [betPlaced, setBetPlaced] = useState([])
  const [viewBetPlaced, setViewBetPlaced] = useState('')
  const [blockContractCreated, setBlockContractCreated] = useState()

  const [betOngoing, setBetOngoing] = useState(false)
  const [endGameId, setEndGameId] = useState('')
  const [unfinishedGamesVisible, setUnfinishedGamesVisible] = useState(false)
  const [finishedGamesVisible, setFinishedGamesVisible] = useState(false)
  const [unfinishedGamesHistory, setUnfinishedGamesHistory] = useState([])
  const [finishedGamesWonHistory, setFinishedGamesWonHistory] = useState([])
  const [finishedGamesLostHistory, setFinishedGamesLostHistory] = useState([])

  const [active, setActive] = useState(false)
  const [userError, setUserError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [web3, setWeb3] = useState(null)
  const [contract, setRouletteContract] = useState(null)
  const [minStake, setMinStake] = useState('')
  const [maxStake, setMaxStake] = useState('')

  const connect = async () => {
    /* check if MetaMask is installed */
    if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
      try {
        /* request wallet connect */
        await window.ethereum.request({ method: "eth_requestAccounts" })
        /* create web3 instance and set to state var */
        const web3 = new Web3(window.ethereum)

        /* set web3 instance */
        setWeb3(web3)
        /* get list of accounts */
        const accounts = await web3.eth.getAccounts()
        /* set Account 1 to React state var */
        setUserAddress(accounts[0])

        /* create local contract copy */
        const tempContract = rouletteContract(web3)
        setRouletteContract(tempContract)
        const minStake = await tempContract.methods.minStake().call();
        const maxStake = await tempContract.methods.maxStake().call();
        setMinStake(minStake)
        setMaxStake(maxStake)
        setBlockContractCreated(3436303)

        setActive(true)
        getRegisteredStartup(tempContract, accounts[0])

      } catch (err) {
        setError(err.message)
      }
    } else {
      // meta mask is not installed
      console.log("Please install MetaMask")
    }
  }

  const updateBetAmount = event => {
    setBetAmount(event.target.value * (10 ** 18))
  }

  const updateEndGameId = event => {
    setEndGameId(event.target.value)
  }

  const updateBetPlaced = (event) => {
    const inputValue = event.target.value.replace(/\s/g, '');
    const numbers = inputValue.split(',').map((s) => parseInt(s.trim(), 10));
    const validNumbers = numbers.filter((n) => n >= 0 && n <= 37);
    const truncatedNumbers = validNumbers.slice(0, 6); // Truncate the array to a maximum length of 6
    const viewNumbers = truncatedNumbers.map((n) => (n === 37 ? '00' : n)); // Convert 37 to '00'
    setBetPlaced(truncatedNumbers);
    setViewBetPlaced(viewNumbers.join(', '))
  };

  const handleClick = (buttonClicked) => {
    var betPlaced = []
    switch (buttonClicked) {
      case 1:
        betPlaced = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        break;
      case 2:
        betPlaced = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
        break;
      case 3:
        betPlaced = [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
        break;
      case 4:
        betPlaced = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
        break;
      case 5:
        betPlaced = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
        break;
      case 6:
        betPlaced = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
        break;
      case 7:
        betPlaced = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        break;
      case 8:
        betPlaced = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
        break;
      case 9:
        betPlaced = [0, 37];
        setBetPlaced(betPlaced)
        setViewBetPlaced(["0, 00"])
        return;
    }
    setBetPlaced(betPlaced)
    setViewBetPlaced(betPlaced.join(', '))
  };

  const placeBetHandler = async () => {

    setUserError(false)
    setSuccess(false)

    if (betAmount < minStake) {
      setUserError(true)
      setErrorMessage("Bet amount below minimum stake.")
      return
    }
    if (betAmount > maxStake) {
      setUserError(true)
      setErrorMessage("Bet amount above maximum stake.")
      return
    }
    if (!userRegistered) {
      setUserError(true)
      setErrorMessage("You are not registered.")
      return
    }

    if (betPlaced.length === 0) {
      setUserError(true)
      setErrorMessage('Select numbers to place a bet on.')
      return
    }

    setBetOngoing(true)
    try {

      var desiredGameId = await contract.methods.gameId().call();
      desiredGameId++ //Because when the game is started its ID will be 1 higher than the previous one

      contract.methods.placeBet(betPlaced).send({
        from: userAddress,
        gasLimit: 2000000, //to prevent gas estimation error, The actual gas limit is set by metamask.
        value: betAmount
      }).on("error", (error) => {
        setBetOngoing(false);
      });

      var gameId
      var filteredRequestId

      await contract.events.BetPlaced({ filter: { gameId: desiredGameId } }).once("data", function (event) {
        setSuccess(true)
        setSuccessMessage('Successfully placed bet!')
        gameId = event.returnValues.gameId
        filteredRequestId = event.returnValues.requestId
        setBetOngoing(false)
      }).on("error", console.error);

      await contract.events.RequestStored({ filter: { requestId: filteredRequestId } }).once("data", function (event) {
        setSuccess(true)
        endGameHandler(gameId)
      }).on("error", console.error);


    } catch (error) {
      console.log(error)
    }
  }
  const endGameHandler = async (gameNumber) => {
    try {
      contract.methods.endGame(gameNumber).send({
        from: userAddress,
        gasLimit: 1000000
      }).on("error", (error) => {
        setBetOngoing(false)
      })


      contract.events.GameFinished({ filter: { gameId: gameNumber } }).once("data", function (event) {
        setBetOngoing(false)
        setSuccess(true)
        setSuccessMessage('Successfully ended game!')
      }).on("error", (error) => {
        setBetOngoing(false);
      });
    } catch (error) {
      console.error(error)
    }
  }

  //Need to modify this to actually get the game that was or wasnt done
  const endGameButtonHandler = async (gameId) => {
    try {
      setUserError(false)
      setSuccess(false)
      const game = await contract.methods.Games(gameId).call();
      //should add a check the make sure that you are not the user
      //so check the games.user //if games.user != useraddress then se
      const gameDone = game.gameDone;
      const gamePlayer = game.user;
      if (userAddress !== game.user) {
        setUserError(true)
        setErrorMessage("Trying to end a different user's game.")
      } else if (gameDone) {
        setUserError(true)
        setErrorMessage("Game is already done.")
      } else {
        setBetOngoing(true)
        endGameHandler(gameId)
      }
    } catch (error) {
      console.log(error)
    }
  }

  const verifyUserHandler = async () => {
    var approvedAddresses = await contract.methods.getApprovedUsers().call();
    if (approvedAddresses.includes(userAddress)) {
      setUserRegistered(true)
      return
    }

    const message = 'Verifying message ';
    const nonce = new Uint8Array(32);
    window.crypto.getRandomValues(nonce);
    const nonceString = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
    const messageConcat = message + nonceString
    const signedMessage = web3.eth.accounts.sign(messageConcat, 'ea988c0bdb07631b03dfff8073e3a1be0a20523727b82794c43aa70f622f8193')

    try {
      await contract.methods.registerUser(userAddress, signedMessage.messageHash, signedMessage.v, signedMessage.r, signedMessage.s).send({
        from: userAddress,
        gasLimit: 200000
      })
      setUserRegistered(true)
    } catch (error) {
      console.log(error)
    }
  }

  const getRegisteredStartup = async (contract, user) => {
    var approvedAddresses = await contract.methods.getApprovedUsers().call();
    if (approvedAddresses.includes(user)) {
      setUserRegistered(true)
    }
  }

  const getGamesFinished = async () => {
    const latestBlockNumber = await web3.eth.getBlockNumber();
    const events = await contract.getPastEvents("GameFinished",
      {
        fromBlock: blockContractCreated, //should change to be the block number that the contract was deployed on
        toBlock: latestBlockNumber
      });
    const filteredWins = events.filter(event => {
      return event.returnValues.win == true && event.returnValues[3] === userAddress;
    })
    const filteredLosses = events.filter(event => {
      return event.returnValues.win === false && event.returnValues[3] === userAddress;
    })
    setFinishedGamesWonHistory(filteredWins)
    setFinishedGamesLostHistory(filteredLosses)

    setUnfinishedGamesVisible(false)
    setFinishedGamesVisible(true)
  }

  const getUnfinishedGames = async () => {
    var gamesDone = []
    const latestBlockNumber = await web3.eth.getBlockNumber();
    //adds all the ids of the finished games to the gamesDone array
    const events = await contract.getPastEvents("GameFinished",
      {
        fromBlock: blockContractCreated,
        toBlock: latestBlockNumber
      }, function (error, events) {
        if (error) {
          console.log(error)
        } else {
          events.forEach(function (event) {
            gamesDone.push(event.returnValues.id);
          });
        }
      });
    //checks events to see if they are done and if not then its a go!
    await contract.getPastEvents("BetPlaced",
      {
        fromBlock: blockContractCreated,
        toBlock: latestBlockNumber
      }

      , function (error, events) {
        if (error) {
          console.log(error)
        } else {
          const filteredEvents = events.filter(event => {
            return !gamesDone.includes(event.returnValues.gameId) && event.returnValues[4] === userAddress
          })
          // const filteredEvents = events.filter((event) => !gamesDone.includes(event.returnValues.gameId));
          // filteredEvents will now contain only the events that are not in gamesDone
          setUnfinishedGamesHistory(filteredEvents)
        }
      }
    )
    setFinishedGamesVisible(false)
    setUnfinishedGamesVisible(true)

  }


  return (
    <div>
      <Head>
        <title> Roulette DApp</title>
        <meta name="description" content="A blockchain roulette dapp" />
      </Head>

      <div>
        <h1 class="is-size-1-desktop	has-text-centered	has-text-weight-light has-text-black" fontSize="3rem"> Roulette Dapp</h1>
      </div>


      <VStack>
        <div>

          {active ? (
            <>
              <HStack justify="space-between">
                <Button style={{ margin: "0 20px" }} onClick={() => connect()} className="button is-link mt-5">Wallet Connected!</Button>
                <Button style={{ margin: "0 20px" }} onClick={() => verifyUserHandler()} className="button is-link mt-5">{userRegistered ? "Registered!" : "Register"}</Button>
              </HStack>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <Image
                  src="/Roulette-board.png"
                  alt="Vercel Logo"
                  width={400}
                  height={48}
                  priority
                />
              </div>

              <HStack w='md' justify="space-evenly">
                <div>
                  <button onClick={() => handleClick(1)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>1st 12 Numbers</button>
                  <button onClick={() => handleClick(2)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>2nd 12 Numbers</button>
                  <button onClick={() => handleClick(3)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>3rd 12 Numbers</button>
                  <button onClick={() => handleClick(4)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>1st Column</button>
                  <button onClick={() => handleClick(5)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>2nd Column</button>
                  <button onClick={() => handleClick(6)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>3rd Column</button>
                  <button onClick={() => handleClick(7)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>Red</button>
                  <button onClick={() => handleClick(8)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>Black</button>
                  <button onClick={() => handleClick(9)} className="button is-warning mt-4" style={{ margin: "0 5px" }}>Green</button>

                </div>
              </HStack>
              <HStack justify="space-evenly" paddingTop="8">
                <div style={{ width: "40%" }}>
                  <Input onChange={updateBetPlaced} className="input" type='text' placeholder='Input a maximum of 6 numbers between 0 and 37 to bet on ...' />
                </div>
              </HStack>

              <HStack justify="space-evenly" paddingTop="8">
                <div style={{ width: "40%" }}>
                  <Input onChange={updateBetAmount} className="input" type='text' placeholder='Input amount you want to bet ...' />
                </div>
              </HStack>

              <HStack paddingTop="8">
                <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}> The numbers you are currently betting on are {viewBetPlaced}</div>
              </HStack>
              <HStack >
                <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}> The current amount you are betting in ETH you are placing is: {betAmount / (10 ** 18)}</div>
                <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}> The current amount you are betting in WEI you are placing is: {betAmount}</div>
              </HStack>

              <HStack>
                <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}>  The minimum stake in ETH is: {minStake / (10 ** 18)}</div>
                <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}> The minimum stake in WEI is: {minStake}</div>
              </HStack>
              <HStack>
                <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}> The maximum stake in ETH is: {maxStake / (10 ** 18)}</div>
                <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}> The maximum stake in WEI is: {maxStake}</div>
              </HStack>
              <VStack justify="space-evenly">
                {userError ? (
                  <div class="has-text-warning-light has-text-centered box has-background-danger">{errorMessage}</div>
                ) : (
                  <div style={{ visibility: 'hidden' }}>
                  </div>
                )}
                {success ? (
                  <div class="has-text-success-light has-text-centered box has-background-success">{successMessage}</div>
                ) : (
                  <div style={{ visibility: 'hidden' }}>
                  </div>
                )}
                <Button onClick={() => placeBetHandler()} className={betOngoing ? "button is-loading is-primary is-large mt-4" : "button is-primary is-large mt-4"}>Place Bet</Button>
              </VStack>

              <HStack justify="space-evenly" paddingTop="4">
                <div style={{ width: "40%" }}>
                  <Input onChange={updateEndGameId} className="input" type='text' size='md' placeholder='Input the game ID of the game you want to end' />
                </div>
              </HStack>
              <HStack justify="space-evenly" paddingTop="4">
                <button onClick={() => endGameButtonHandler(endGameId)} className={betOngoing ? "button is-loading is-primary mt-4" : "button is-primary mt-4 "}>End Game</button>
              </HStack>
              <HStack justify="space-evenly">
                <Button onClick={() => getUnfinishedGames()} className="button is-primary mt-4">Get Unfinished Games</Button>
                <Button onClick={() => getGamesFinished()} className="button is-primary mt-4">Get Finished Games</Button>
              </HStack>

              {(finishedGamesVisible || unfinishedGamesVisible) ? (
                <div className="has-text-centered box content mb-3">
                  {/* unfinished games */}
                  {unfinishedGamesVisible ? (
                    <div>
                      <h1 className="is-primary"> Unfinished Games</h1>
                      <ul>
                        {unfinishedGamesHistory
                          .sort((a, b) => b.returnValues.gameId - a.returnValues.gameId)
                          .map((item) => (
                            <li key={item.returnValues.gameId}>
                              <div>GameID: {item.returnValues.gameId}</div>
                              <div>Bet Placed: {item.returnValues.betPlaced.join(", ")}</div>
                              <div>Bet Amount in ETH: {item.returnValues.betValue / (10 ** 18)}</div>
                              <div>Bet Amount in Wei: {item.returnValues.betValue}</div>
                              <div>Contract address: {item.address}</div>
                              <div>Transaction Hash: {item.transactionHash}</div>
                              <div>Block Number: {item.blockNumber}</div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ visibility: 'hidden' }}>
                    </div>
                  )}
                  {/* finished games */}

                  {finishedGamesVisible ? (
                    <div>
                      <h1 className="is-primary"> Won Games</h1>
                      <ul>
                        {finishedGamesWonHistory
                          .sort((a, b) => b.returnValues.id - a.returnValues.id)
                          .map((item) => (
                            <li key={item.returnValues.id}>
                              <div>GameID: {item.returnValues.id}</div>
                              <div>Bet Placed: {item.returnValues.bet.join(", ")}</div>
                              <div>Bet Amount in ETH: {item.returnValues.betAmount / (10 ** 18)}</div>
                              <div>Bet Amount in Wei: {item.returnValues.betAmount}</div>
                              <div>Winnings in ETH: {item.returnValues.winnings / (10 ** 18)}</div>
                              <div>Winnings in WEI: {item.returnValues.winnings}</div>
                              <div>Contract address: {item.address}</div>
                              <div>Transaction Hash: {item.transactionHash}</div>
                              <div>Block Number: {item.blockNumber}</div>
                            </li>
                          ))}
                      </ul>
                      {/* lost finished games */}
                      <ul>
                        <h1 className="is-primary"> Lost Games</h1>
                        {finishedGamesLostHistory
                          .sort((a, b) => b.returnValues.id - a.returnValues.id)
                          .map((item) => (
                            <li key={item.returnValues.id}>
                              <div>GameID: {item.returnValues.id}</div>
                              <div>Bet Placed: {item.returnValues.bet.join(", ")}</div>
                              <div>Bet Amount in ETH: {item.returnValues.betAmount / (10 ** 18)}</div>
                              <div>Bet Amount in Wei: {item.returnValues.betAmount}</div>
                              <div>Contract address: {item.address}</div>
                              <div>Transaction Hash: {item.transactionHash}</div>
                              <div>Block Number: {item.blockNumber}</div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ visibility: 'hidden' }}>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ visibility: 'hidden' }}>
                </div>
              )}

              <VStack>
                <h1 class="is-size-4-desktop	has-text-centered	has-text-weight-light has-text-black" font-size="3rem"> How to Play</h1>
                <HStack>
                  <div>

                    <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}>
                      How a game Works:
                      You select the bet and bet amount. You then click on the Place Bet button. You must then approve the MetaMask transaction that pops up. After a short wait a second MetaMask transaction will pop up. If you wish to end the game now then approve the transaction. Otherwise the game will be stored on the blockchain and can be finished later by entering the desired gameId and clicking the "End Game button". Finished and unfinished games can be viewed by clicking on the "Get Finished Games" and "Get Finished Games" button.
                    </div>
                    <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}>
                      Rules:
                      You may place a bet on a maximum of 6 numbers between 0 and 37. 0 represents the first green space (0) and 37 represents the second green space(00) If you wish to bet on a group of numbers use the buttons above the bet input to do so.
                      The first 6 numbers ranging from 1-36 will be selected. The bet that will be passed through once you place a bet can be viewed by clicking "See numbers". Entering numbers other than 1-36 may lead to unintended consequences and your bet may be different than intended. You will still place a bet and be charged for any gas fees. The bet you have placed that will be sent to the smart contract is available on screen.
                    </div>
                    <div className="has-text-centered box content mb-3" style={{ maxWidth: '80%', margin: '0 auto' }}>
                      Random Number Generation:
                      The random number generator used to generate random numbers is provided by <a href="https://chain.link/vrf"> Chainlink. </a> This uses the method described on their website where a random number is generated by a group decentralised nodes. This number is then published on the Ethereum blockchain and verified by a decentralised group of nodes. The number can be proved to be randomly generated using the proof provided by Chainlink. Only if the number is valid is it used. The smart contract used here waits 3 block confirmations to ensure that the random number is confirmed and that the result of the game will not change.
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>


                      <VStack className="has-text-centered box content mb-3" alignItems="center" paddingTop="8" style={{ maxWidth: '20%' }}>
                        <div>Payout:</div>
                        <div>1 Number: 35:1</div>
                        <div>2 Numbers: 17:1</div>
                        <div>3 Numbers: 11:1</div>
                        <div>4 Numbers: 8:1</div>
                        <div>5 Numbers: 6:1</div>
                        <div>6 Numbers: 5:1</div>
                        <div>12 Numbers: 2:1</div>
                        <div>18 Numbers: 1:1</div>
                      </VStack>
                    </div>
                  </div>
                </HStack>
              </VStack>
              <VStack>
                <div className="box is-size-4	is-centred has-text-centered	" >
                <a href="https://sepolia.etherscan.io/address/0xfe56B6A93Faec2878DB7731FC61F7BCAfeD6517e"> Link to smart contract on Etherscan</a> 
                <p>Note it is currently deployed on the Sepolia testnet.</p>

                  </div>
              </VStack>
            </>
          ) : (
            <div>
              <button onClick={() => connect()} className="button is-primary mt-4">Connect Wallet</button>
            </div>

          )}
        </div>
      </VStack>
    </div>
  )
}
