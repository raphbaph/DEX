pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "./Wallet.sol";

contract Dex is Wallet {

    enum Side{
        BUY,
        SELL
    }
    
    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint price;
    }

    mapping(bytes32 => mapping(uint => Order[])) OrderBook;

    function getOrderBook (bytes32 ticker, Side side) public view returns (Order[] memory){
        return OrderBook[ticker][uint(side)];
    }

    function createLimitOrder (bytes32 ticker, Side side, uint amount, uint price) public returns (bool){

    }

    /* function addFunds(address _address) public payable {

    }*/

    /* functions getFunds(address _address) public view {

    } */
}
