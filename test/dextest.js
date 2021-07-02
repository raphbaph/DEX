// The user must have ETH deposited such that deposited eth >= buy order value
// The user must have enough tokens deposited such that token balance >= sell order amount
// The BUY order book should be ordered on price from highest to lowest starting at index 0
// The SELL order book should be ordered on price from lowest to highest starting at index 0
// The User should not be able to create limit orders for not supported tokens

const Dex = artifacts.require("Dex");
const Link = artifacts.require("Link");
const truffleAssert = require('truffle-assertions');

const Side = {
    BUY: 0,
    SELL: 1
};

const LINKB32 = web3.utils.fromUtf8("LINK");
const ETHB32 = web3.utils.fromUtf8("ETH");
const ETH10 = web3.utils.toWei('10', 'ether');

contract("Dex", accounts => {

    let dex;
    let link;

    beforeEach(async () => {
        dex = await Dex.new({from: accounts[0]});
        link = await Link.new({from: accounts[0]});
        await dex.addToken(LINKB32, link.address);
    });

    afterEach(async () => {
        dex.kill({from: accounts[0]});
        link.kill({from: accounts[0]});
    });

    describe("Wallet tests", function (){

        it("Should only be possible for owner to add tokens", async ()=>{
            await truffleAssert.passes (
                dex.addToken(LINKB32, link.address, {from: accounts[0]} )
            );  
        } );

        it("Should not be possible for anyone else to add tokens", async ()=>{
            await truffleAssert.reverts(
                dex.addToken(LINKB32, link.address, {from: accounts[1]} )
            );
        } );
    });

    describe("Limit order tests", function (){

        it("The user must have ETH deposited such that deposited eth >= buy order value", async ()=>{
            await truffleAssert.reverts( 
                dex.createLimitOrder(LINKB32, Side.BUY, 10, 1)
            );
            
            //top up and check if it passes
            await dex.addFunds({from: accounts[0], value: ETH10});
            await truffleAssert.passes ( 
                // Try same create, this time it should pass.
                dex.createLimitOrder(LINKB32, Side.BUY, 10, 1)
            );    
        } );

        it("The user must have enough tokens deposited such that token balance >= sell order amount", async ()=>{
            await truffleAssert.reverts(
                //  create limit order - expect to fail.
                dex.createLimitOrder(LINKB32, Side.SELL, 10, 1)
            );
            
            await link.approve(dex.address, 10); 
            await dex.deposit (10, LINKB32, {from: accounts[0]}); //deposit 10 LINK

            await truffleAssert.passes (
                // This should pass now
                await dex.createLimitOrder(LINKB32, Side.SELL, 10, 1)
            ); 

        } );

        it("The BUY order book should be ordered on price from highest to lowest starting at index 0", async ()=>{
            const buyOrders = [1,5,3,2,6]; // order prices to create
            await dex.addFunds({from: accounts[0], value: ETH10});

            for (i=0; i < buyOrders.length; i++){ // create some BUY orders
                await dex.createLimitOrder(LINKB32, Side.BUY, 1, buyOrders[i]);
            }
            
            let orderBook = await dex.getOrderBook(LINKB32, Side.BUY);


            assert(orderBook.length > 0);
            // assert that each buy order in the array is smaller than the one before
            let sorted = true;

            for (i=0; i < orderBook.length - 1; i++){
                let firstOrder = orderBook[i];
                let nextOrder = orderBook[i+1];
                firstOrder.price >= nextOrder.price ? sorted = true : sorted = false;
            }
            assert(sorted, "ORDER BOOK NOT SORTED");
        } );

        it("The SELL  order book should be ordered on price from lowest to highest starting at index 0", async ()=>{
            const sellOrders = [1,5,3,2,6]; // order prices to create

            await link.approve(dex.address, 10); 
            await dex.deposit(10, LINKB32); // deposit 10 Tokens so we can create sell orders

            for (i=0; i < sellOrders.length - 1; i++){ // create some BUY orders
                await dex.createLimitOrder(LINKB32, Side.SELL, 1, sellOrders[i]);
            }
            
            let orderBook = await dex.getOrderBook(LINKB32, Side.SELL);
            assert(orderBook.length > 0);

            // assert that each buy order in the array is smaller than the one before
            let sorted = true;
            for (i=0; i < orderBook.length - 1; i++){
                const firstOrder = orderBook[i];
                const nextOrder = orderBook[i+1];
                firstOrder.price <= nextOrder.price ? sorted = true : sorted = false;
            }
            assert(sorted, "ORDER BOOK NOT SORTED");
        } );

        it("The User should not be able to create limit orders for not supported tokens", async ()=>{
            const AAVEB32 = web3.utils.fromUtf8("AAVE");

            console.log("HERE!");
            await dex.addFunds({from: accounts[0], value: ETH10});

            await truffleAssert.reverts( //create BUY order of unlisted token should fail
                dex.createLimitOrder(AAVEB32, Side.BUY, 0.1, 1)
            );
            console.log("HERE!");
            await truffleAssert.reverts( //create SELL order of unlisted token should fail
                dex.createLimitOrder(AAVEB32, Side.SELL, 0.1, 1)
            );

            //now use LINK
            console.log("HERE!");
            await link.approve(dex.address, 10); 
            await dex.deposit(10, LINKB32); // deposit 10 Tokens for orders
            await truffleAssert.passes( //create BUY order should succeed
                dex.createLimitOrder(LINKB32, Side.BUY, 0.1, 1)
            );
            console.log("HERE!");
            await truffleAssert.passes( //create SELL order of unlisted token should fail
                dex.createLimitOrder(LINKB32, Side.SELL, 0.1, 1)
            );
        } );
    });

    describe("Market order tests", function(){
        it("Should throw an error when submitting a SELL order with insufficient token balances.", async () => {
            let balance = await dex.balances(accounts[0], LINKB32);
            assert.equal(parseInt(balance), 0, "Initial LINK balance not 0");

            await truffleAssert.reverts(
                dex.createMarketOrder(Side.SELL, LINKB32, 10)
            );
        });

        it("Should throw an error when submitting a BUY order with insufficient ETH balance", async () => {
            let balance = await dex.balances(accounts[0], ETHB32);
            assert.equal(parseInt(balance), 0, "Initial ETH balance not 0");

            await truffleAssert.reverts(
                dex.createMarketOrder(Side.BUY, LINKB32, 10)
            );

        });

        it("Should be possible to submit market orders even if the order books are empty", async () => {
            dex.addFunds({from: accounts[0], value: ETH10});

            let orderBook = dex.getOrderBook(LINKB32, Side.BUY);
            assert(orderBook.length == 0, "Buy side order book not empty!");

            await truffleAssert.passes(
                dex.createMarketOrder(Side.BUY, LINKB32, 10)
            );
        });

        it("A market order should be filled until complete, or the order book is empty", async () => {
            let orderBook = dex.getOrderBook(LINKB32, Side.BUY);
            assert(orderBook.length == 0, "Buy side order book not empty!");

            // We need a couple of SELL orders to be able to fill the buy order.
            // We'll do this from 3 different accounts, with 3 different prices.

            await dex.addToken(LINKB32, link.address);

            await link.transfer(accounts[1], 100);
            await link.transfer(accounts[2], 100);
            await link.transfer(accounts[3], 100);

            await link.approve(dex.address, 100, {from:accounts[1]});
            await link.approve(dex.address, 100, {from:accounts[2]});
            await link.approve(dex.address, 100, {from:accounts[3]});

            await dex.deposit(10, LINKB32, {from:accounts[1]});
            await dex.deposit(10, LINKB32, {from:accounts[2]});
            await dex.deposit(10, LINKB32, {from:accounts[3]});

            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 100, {from: accounts[1]});
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 200, {from: accounts[2]});
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 300, {from: accounts[3]});

            await dex.createMarketOrder(Side.BUY, LINKB32, 20);
            
            // This should be filled with the first two sell orders, leaving one with amount 10.
            orderBook = dex.getOrderBook(LINKB32, Side.BUY);
            assert(orderBook.length == 0, "Buy market order was not filled");

            orderBook = dex.getOrderBook(LINKB32, Side.SELL);
            assert(orderBook.length == 1 && orderBook[0].amount == 10, "Sell side order[0] has unexpected amount. Should be 10 is :" + orderBook[0].amount);

            // And we'll check if the order is filled until the order book is empty.
            await dex.createMarketOrder(Side.BUY, LINKB32, 15);

            orderBook = dex.getOrderBook(LINKB32, Side.SELL);
            assert(orderBook.length == 0, "Sell side order book should be empty");

            orderBook = dex.getOrderBook(LINKB32, Side.BUY);
            assert(orderBook.length == 1 && orderBook[0].amount == 5, "Buy market order[0] has unexpected amount. Should be 5 is :" + orderBook[0].amount);            
        });    

        it("The filled orders should be removed from the order book", async () =>{
            let orderBook = dex.getOrderBook(LINKB32, Side.BUY);
            assert(orderBook.length == 0, "Buy side order book not empty!");

            // We need a couple of SELL orders to be able to fill the buy order.
            // We'll do this from 3 different accounts, with 3 different prices.

            await dex.addToken(LINKB32, link.address);

            await link.transfer(accounts[1], 100);
            await link.transfer(accounts[2], 100);
            await link.transfer(accounts[3], 100);

            await link.approve(dex.address, 100, {from:accounts[1]});
            await link.approve(dex.address, 100, {from:accounts[2]});
            await link.approve(dex.address, 100, {from:accounts[3]});

            await dex.deposit(10, LINKB32, {from:accounts[1]});
            await dex.deposit(10, LINKB32, {from:accounts[2]});
            await dex.deposit(10, LINKB32, {from:accounts[3]});

            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 100, {from: accounts[1]});
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 200, {from: accounts[2]});
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 300, {from: accounts[3]});

            await dex.createMarketOrder(Side.BUY, LINKB32, 20);
            
            // This should be filled with the first two sell orders, leaving one with amount 10.
            orderBook = dex.getOrderBook(LINKB32, Side.SELL);
            assert(orderBook.length == 1, "Two filled sell order should have been removed. Order book length should be 1, is :" + orderBook.length);    
        });

        it("The balances should adjust as the orders get filled", async () =>{
            // We need a couple of SELL orders and a BUY oder, to compare balances.
            // We'll do this from 3 different accounts, with 3 different prices.

            await dex.addToken(LINKB32, link.address);

            await link.transfer(accounts[1], 100);
            await link.transfer(accounts[2], 100);
            await link.transfer(accounts[3], 100);

            await link.approve(dex.address, 100, {from:accounts[1]});
            await link.approve(dex.address, 100, {from:accounts[2]});
            await link.approve(dex.address, 100, {from:accounts[3]});

            await dex.deposit(10, LINKB32, {from:accounts[1]});
            await dex.deposit(10, LINKB32, {from:accounts[2]});
            await dex.deposit(10, LINKB32, {from:accounts[3]});

            // Save the balances of account 1 and 2 for comparison after we submitted the market BUY order

            let balanceOne = parseInt(await dex.balances(accounts[1], LINKB32));
            let balanceTwo = parseInt(await dex.balances(accounts[2], LINKB32));

            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 100, {from: accounts[1]});
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 200, {from: accounts[2]});
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 300, {from: accounts[3]});

            await dex.createMarketOrder(Side.BUY, LINKB32, 15);

            let balanceOnePost = parseInt(await dex.balances(accounts[1], LINKB32));
            let balanceTwoPost = parseInt(await dex.balances(accounts[2], LINKB32));
            assert(balanceOne - 10 == balanceOnePost && balanceTwo - 5 == balanceTwoPost, "Balances not adjusted correctly");
        });
    });
} );
