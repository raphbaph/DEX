// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract Wallet is Ownable{

    using SafeMath for uint256;

    modifier tokenExists(bytes32 _ticker){
        require(tokenMapping[_ticker].tokenAddress != address(0), "Wallet: Specified token doesn't exist!");
        _;
    }

    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }
    
    bytes32[] public tokenList;
    mapping(bytes32 => Token) public tokenMapping;

    mapping(address => mapping(bytes32 => uint256)) public balances;

    function addToken(bytes32 _ticker, address _address) onlyOwner external {
        tokenMapping[_ticker] = Token(_ticker, _address);
        tokenList.push(_ticker);
    }

    /* deposit amount of ticker into wallet contract
    * check that token can be deposited into wallet contract
    * Get a handle on the contract, check balances, and transfer tokens
    * check if transfer was successful
    * update balances using Safemath
    */
    function deposit(uint amount, bytes32 ticker) tokenExists(ticker) external {
        IERC20 depositToken = IERC20(tokenMapping[ticker].tokenAddress);
        require(depositToken.balanceOf(msg.sender) >= amount, "Wallet: Insufficient tokens to deposit!");

        bool success;

        success = depositToken.transferFrom(msg.sender, address(this), amount);

        require(success, "Wallet: Deposit failed");
        balances[msg.sender][ticker] = balances[msg.sender][ticker].add(amount);
    }

    function withdraw(uint amount, bytes32 ticker) tokenExists(ticker) external {
        require(balances[msg.sender][ticker] >= amount, "Wallet: Balance of token not sufficient");

        balances[msg.sender][ticker] = balances[msg.sender][ticker].sub(amount);
        IERC20(tokenMapping[ticker].tokenAddress).transfer(msg.sender, amount);
    }
}