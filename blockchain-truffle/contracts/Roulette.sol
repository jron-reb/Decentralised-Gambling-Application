// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.11;

import './SafeMath.sol';
import "../node_modules/@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "../node_modules/@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

contract Roulette is VRFConsumerBaseV2{
    
    address public casinoAddress; //only this address can acept and end games
    
    /// @dev Min value user needs to deposit for creating game session.
    uint128 public minStake;

    /// @dev Max value user can deposit for creating game session.
    uint128 public maxStake;

    uint256 public gameId;

    address payable[] public approvedAddresses;

    uint64 subscriptionId = 1215;
    bytes32 constant keyHash = 0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c; //keyhash
    VRFCoordinatorV2Interface COORDINATOR;

    uint32 constant callbackGasLimit = 1 * 10 ** 6;// how much gas they are willing to spend for you (cus they call function in your smart contract to send you the result)
    uint32 constant numWords = 1; //number of random numbers generated
    uint16 constant requestConfirmations = 3; //how many blocks need to be confirmed (So there can be no manipulations)

    mapping (uint256 => Game) public Games;
    mapping (uint256 => LinkRequest) public LinkRequests;

    constructor () 
    VRFConsumerBaseV2(0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625)
    {
        COORDINATOR = VRFCoordinatorV2Interface(0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625);
        casinoAddress = payable(msg.sender);
        gameId = 0;

        minStake = 1 * 10 ** 13; //0.00001 ETH (0.01862 USD as of 8 April)
        maxStake = 1 * 10 ** 18; //equivalent to 1 eth (1,862 USD as of 8 April)
    }

    struct LinkRequest {
        uint256 requestId;
        bool exists;
        bool requestFulfilled;
        uint256 randomWord;
    }
    
    struct Game {
        uint256 gameId;
        uint256[] bet;
        uint256 betAmount;
        address payable user;
        bool win;
        uint256 winnings;
        bool gameDone;
        uint256 requestId;
        uint256 gameResult;
    }
    //may wantr to use indexed for gameFinished
    event BetPlaced(uint256 gameId, uint256[] betPlaced, uint256 requestId, uint256 betValue, address payable user);
    event RequestSent(uint256 indexed requestId);
    event RequestStored(uint256 indexed requestId, uint256 indexed randomWords);
    event GameFinished(uint256 indexed id, uint256[] bet, uint256 betAmount, address payable indexed user, bool indexed win, uint256 winnings);
    event Recieved(address indexed depositor,uint256 indexed amount);
    event Withdrawn(address indexed casino, uint256 indexed amount);
    event OwnershipTransferredSuccessfully(address indexed previousOwner, address indexed newOwner);
    event RegisterUser(address indexed user);
    event VerifiedAddress(address recoveredAddress);

    function placeBet(uint256[] memory _numbersSelected) public payable onlyValidUserStake(msg.value) onlyRegistered(msg.sender) onlyValidHouseFunds(msg.value){
        require (msg.sender.balance > msg.value, "Not enough money in wallet to place bet");
        require (_numbersSelected.length < 7 && _numbersSelected.length > 0 || _numbersSelected.length == 12 || _numbersSelected.length == 18, "Need to make a valid bet");

        uint256 requestId = COORDINATOR.requestRandomWords(keyHash, subscriptionId, requestConfirmations, callbackGasLimit, numWords); //will revert if subscription is not set and funded
        LinkRequests[requestId] = LinkRequest(requestId, true, false, 0);
        emit RequestSent(requestId);
        
        gameId = SafeMath.add(gameId, 1);
        Games[gameId] = Game(gameId, _numbersSelected, msg.value, payable(msg.sender), false, 0, false, requestId, 0);
        emit BetPlaced(gameId, _numbersSelected, requestId, msg.value, payable (msg.sender));
    }

    function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
        require (LinkRequests[_requestId].exists, "Request was not found"); //checks whether a request has actually been made
        LinkRequests[_requestId].randomWord = _randomWords[0];
        LinkRequests[_requestId].requestFulfilled = true;
        emit RequestStored(_requestId, LinkRequests[_requestId].randomWord);
    }

    function endGame(uint256 _gameId) public {
        require (Games[_gameId].gameDone == false, "Game has already been finished.");
        require (Games[_gameId].gameId != 0, "Game does not exist.");
        require (LinkRequests[Games[_gameId].requestId].requestFulfilled == true, "Random number has not yet been generated, try again after a short wait.");
        uint256 result = SafeMath.mod(LinkRequests[Games[_gameId].requestId].randomWord, 38); //This line extracts the randomly generated number that has been stored by the request struct

        bool won = checkResult(result, Games[_gameId].bet);
        if (won == true) {//Means that the user placed their bet successfully
            uint256 payout = calculatePayout(Games[_gameId].bet.length);
            payout = SafeMath.div(SafeMath.mul(payout, Games[_gameId].betAmount), 10);

            safeTransferWinnings(payable (Games[_gameId].user), payout);

            Games[_gameId].win = true;
            Games[_gameId].winnings = SafeMath.sub(payout, Games[_gameId].betAmount);
        } else {
        }
        Games[_gameId].gameDone = true;
        Games[_gameId].gameResult = result;
        emit GameFinished(_gameId, Games[_gameId].bet, Games[_gameId].betAmount, Games[_gameId].user, Games[_gameId].win, Games[_gameId].winnings);
    }

    function checkResult (uint256 _result, uint256[] memory _numbersSelected) private pure returns (bool) {
        for (uint256 i = 0; i< 38 && i < _numbersSelected.length ; i++) {
            if (_numbersSelected[i] == _result) {
                return true;
            }
        }
        return false; 
    }

    function calculatePayout(uint256 _amountOfNumbersSelected) private pure returns (uint256) {
        //All the payouts are multiplied by ten so that the odds 1.5 can be returned (solidity cannot handle floating point numbers)
        //The payout is later divided by ten after being multiplide with the user's bet
        //Odds are dependent on the amount of numbers selected not which ones. 
        if (_amountOfNumbersSelected == 18) {
            //If red/black/odd/even numbers are bet on (payout is 1:1)
            return 20;
        } else if (_amountOfNumbersSelected == 12) {
            //If the 1st/2nd/3rd dozen or the 1st/2nd/3rd column is bet on (payuout is 2:1)
            return 15;
        } else if (_amountOfNumbersSelected < 7 && _amountOfNumbersSelected > 0) {
            // When selecting individual numbers up to 6 can be selected with the odds being (36/# numbers selected) - 1    
            uint256 payout = SafeMath.div(36, _amountOfNumbersSelected);
            payout = SafeMath.sub(payout, 1);
            return SafeMath.mul(payout, 10);
        }
        return 0;
    }

    //Sends money from the casino to the user
    function safeTransferWinnings(address payable _userAddress, uint256 _userPayout) private {
        require (_userPayout > 0, "The user did not win any money");
        require (casinoAddress.balance > _userPayout, "Casino does not have enough funds to reward user after successful bet");
        (bool sent,) = _userAddress.call{value: _userPayout}("");
        require(sent, "Casino failed to send Ether");
        }

    function addFunds() public payable {
        emit Recieved(msg.sender, msg.value);
        //If users pay to the wrong function, consider it a donation.
    }

    function withdrawFundsWei(uint256 _withdrawAmount) public onlyCasino {
        require (_withdrawAmount <= address(this).balance, "Attempting to withdraw more funds than casino has available");
        (bool sent,) = casinoAddress.call{value: _withdrawAmount}("");
        require(sent, "Failed to withdraw ether");

        emit Withdrawn(msg.sender, _withdrawAmount);
    }
    
    function withdrawAllFunds() public onlyCasino {
        require (0 < address(this).balance, "Casino has no funds to withdraw");
        uint _withdrawAmount = address(this).balance;
        (bool sent,) = casinoAddress.call{value: address(this).balance}("");
        require(sent, "Failed to withdraw ether");
        emit Withdrawn(msg.sender, _withdrawAmount);
    }

    function registerUser(address payable _address, bytes32 _messageHash, uint8 _v, bytes32 _r, bytes32 _s) public onlyDapp(_messageHash, _v, _r, _s) {
        approvedAddresses.push(_address);
        emit RegisterUser(_address);
    }

    function unregisterUser(address payable _address) public onlyCasino{
        for (uint i; i < approvedAddresses.length; i++) {
            if (_address == approvedAddresses[i]) {
                approvedAddresses[i] = approvedAddresses[approvedAddresses.length - 1];
                approvedAddresses.pop();
                //no break in case there are multiple instances of a single address
            }
        }
    }

    function verifyUser(address _address) private view returns (bool) {
        for (uint i; i < approvedAddresses.length; i++) {
            if (_address == approvedAddresses[i]) {
                return true;
            }
        }
        return false;
    }

    function getApprovedUsers() public view returns( address payable[] memory) {
        return approvedAddresses;
    }

    function changeOwner(address payable _newOwner) public onlyCasino {
        require(_newOwner != address(0), "Need to transfer ownership to a valid address");
        emit OwnershipTransferredSuccessfully(casinoAddress, _newOwner);
        casinoAddress = _newOwner;
    }

    modifier onlyDapp(bytes32 _messageHash, uint8 _v, bytes32 _r, bytes32 _s) {
    address recoveredAddress = ecrecover(_messageHash, _v, _r, _s);
    require(recoveredAddress == casinoAddress, "Only the Dapp can register a user");
        _;
    }
    //ensures only 1% of house funds can be bet
    modifier onlyValidHouseFunds (uint256 _userBet) {
        require (SafeMath.mul(_userBet, 100) <= address(this).balance, "Casino does not have enough funds");
        _;
    }
    modifier onlyRegistered(address _address) {
        require (verifyUser(_address) == true, "User is not verified");
        _;
    }
    modifier onlyValidUserStake (uint256 _userBet) {
        require (_userBet >= minStake, "Stake is below the minimum stake");
        require (_userBet <= maxStake, "Stake is above the maximum stake");
        _;
    }
    modifier onlyCasino() {
        require(msg.sender == casinoAddress, "Address is not the casino");
        _;
    }
}