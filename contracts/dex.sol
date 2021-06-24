// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "./Wallet.sol";

contract Dex is Wallet {

    using SafeMath for uint256;

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

    uint256 public nextOrderId = 0;

    function getOrderBook (bytes32 ticker, Side side) public view returns (Order[] memory){
        return OrderBook[ticker][uint(side)];
    }

    function createLimitOrder (bytes32 ticker, Side side, uint amount, uint price) public returns (bool success_){
        if(side == Side.BUY){
            require(balances[msg.sender]["ETH"] >= amount.mul(price), "DEX: Insufficient funds for BUY order!");
        }
        else if(side == Side.SELL){
            require(balances[msg.sender][ticker] >= amount, "DEX: Insufficient funds for SELL order!");
        }

        Order[] storage orders = OrderBook[ticker][uint(side)];
        orders.push(
            Order(nextOrderId, msg.sender, side, ticker, amount, price)
        );

        _sortOrders(orders, side);

        nextOrderId++;
        success_ = true;
    }

    /* sortOrders function should sort BUY Orders from highest price at [0] to lowest at [length -1]
    * should sort SELL orders from lowest price at [0] to highest at [length -1]
    * use bubble sort algorithm.
    * assume pre-ordered array, only one loop of bubble is necessary, new element always at position length -1
    */
    function _sortOrders(Order[] storage _orders, Side _side) private {
        
        if (_side == Side.BUY){ // sort BUY Orders from highest price at [0] to lowest at [length -1]
            bool sorting = true;
            uint i = _orders.length > 0 ?_orders.length - 1 : 0; 

            while(sorting && i > 0){            
                if(_orders[i-1].price > _orders[i].price) { // swap if bigger
                    Order memory swap = _orders[i-1];
                    _orders[i-1] = _orders [i]; 
                    _orders[i] = swap;
                    i--; // on to the next
                }
                else { // found the right place in the array
                    sorting = false; // stop sort
                }
            }
        }
        
        if (_side == Side.SELL){ // sort SELL Orders from lowest price at [0] to highest at [length -1]
            bool sorting = true;
            uint i = _orders.length > 0 ?_orders.length - 1 : 0; 

            while(sorting && i > 0){            
                if(_orders[i-1].price < _orders[i].price) { // swap if smaller
                    Order memory swap = _orders[i-1];
                    _orders[i-1] = _orders [i]; 
                    _orders[i] = swap;
                    i--; // on to the next
                }
                else { // found the right place in the array
                    sorting = false; // stop sort
                }
            }
        }
    }

    function addFunds() public payable {
        balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(msg.value);
    }

    function getFunds(address _address) public view returns (uint256 funds_){
        return balances[_address]["ETH"];
    }
}
