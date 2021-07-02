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

    function createLimitOrder (bytes32 ticker, Side side, uint amount, uint price) public tokenExists(ticker) returns (bool success_){
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
            uint i = _orders.length > 0 ?_orders.length - 1 : 0; 

            while(i > 0){            
                if(_orders[i-1].price < _orders[i].price) { // swap if bigger
                    Order memory swap = _orders[i-1];
                    _orders[i-1] = _orders [i]; 
                    _orders[i] = swap;
                    i--; // on to the next
                }
                else { // found the right place in the array
                    break; // stop sort
                }
            }
        }
        
        if (_side == Side.SELL){ // sort SELL Orders from lowest price at [0] to highest at [length -1]
            bool sorting = true;
            uint i = _orders.length > 0 ?_orders.length - 1 : 0; 

            while(sorting && i > 0){            
                if(_orders[i-1].price > _orders[i].price) { // swap if smaller
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

    function kill() external onlyOwner{
        selfdestruct(payable(msg.sender));
    }

    function createMarketOrder(Side side, bytes32 ticker, uint amount) public returns (bool success_){

        uint sideToGet;

        if(side == Side.BUY){
            sideToGet = 1;
        }
        else{
            sideToGet = 0;
            require(balances[msg.sender][ticker] >= amount, "DEX: Insufficient funds for SELL order!");
        }

        Order[] storage orders = getOrderBook(ticker, sideToGet);

        uint amountFilled = 0;

        // Fill the order until complete or order book is empty. We'll look at each orders amount and fill one by one, checking funds as we go along.
        for(uint256 i=0; i < orders.length && amountFilled < amount; i++){

            if(amount < orders[i].amount){ // Order can be completed in this iteration, fill it and adjust the amount of the order used to fill it.
                if(side == Side.BUY){
                    require(balances[msg.sender]["ETH"] >= amount.mul(orders[i].price), "DEX: Insufficient funds for BUY order!");
                }
                //Sufficient balances for whole sell order checked at top of function, no need to repeat it here.
                _fillOrder(orders[i].trader, msg.sender, ticker, amount, price);
                orders[i].amount = orders[i].amount.sub(amount);
            }
            else{ // This consumes a whole order on the other side now. So we need to remove that order from the book.
                if(side == Side.BUY){
                    require(balances[msg.sender]["ETH"] >= amount.mul(orders[i].price), "DEX: Insufficient funds for BUY order!");
                }
                _fillOrder(orders[i].trader, msg.sender, ticker, orders[i].amount, price);
                amountFilled += orders[i].amount;
                _removeTopOrder(orders);
            }
        }

        _success = true;
    }

    function _fillOrder(address from, address to, bytes32 ticker, uint _amount, uint _price) private {
        require(balances[from][ticker] > amount, "DEX: insufficient balance for filling order!");

        balances[to][ticker] = balances[to][ticker].add(_amount);
        balances[from][ticker] = balances[from][ticker].sub(_amount);

        require(balances[to]["ETH"] > amount.mul(_price), "DEX: insufficient ETH funds for filling order!");
        balances[to]["ETH"] = balances[to][ticker].sub(_amount.mul(_price));
        balances[from]["ETH"] = balances[from][ticker].add(_amount.mul(_price));
    }

    function _removeTopOrder(_orders storage) private {
        //move all orders up 1 index and pop last
        for(uint i=0; i < _orders.length; i++){
            _orders[i] = _orders[i+1];
        }
        _orders.pop();
    }
}
