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
const ETH10 = web3.utils.toWei('10', 'ether');

contract("Dex", accounts => {

    let dex;
    let link;

    before(async function(){
        dex = await Dex.deployed();
        link = await Link.deployed();
        await dex.addToken(LINKB32, link.address);
    });

    it("The user must have ETH deposited such that deposited eth >= buy order value", async ()=>{
        let ethBalance = parseInt(dex.getFunds(accounts[0])); // Get the current ETH balance for accounts[0]
        ethBalance++;

        await truffleAssert.reverts ( 
            // Then create an Order for one more ETH than available, expect to fail.
            await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), Side.BUY, ethBalance, 1)
        );
        
        //top up and check if it passes
        await dex.addFunds({value: ETH10});
        await truffleAssert.passes ( 
            // Try same create, this time it should pass.
            await dex.createLimitOrder(web3.utils.fromUtf8("LINK"), Side.BUY, ethBalance, 1)
        );    
    } );

    it("The user must have enough tokens deposited such that token balance >= sell order amount", async ()=>{
         // Get the current LINK balance for accounts[0], if 0 deposit 10
         let linkBalance = parseInt(dex.balances(accounts[0], LINKB32));
         if(linkBalance) { linkBalance++; }
         else {
             await dex.deposit (10, LINKB32);
             linkBalance = 11;
         }

        await truffleAssert.reverts (
            // Then create limit order for one more ETH than available, expect to fail.
            await dex.createLimitOrder(LINKB32, Side.SELL, linkBalance, 1)
        );  
        
        await dex.deposit (10, LINKB32); //deposit 10 more

        await truffleAssert.passes (
            // This should pass now
            await dex.createLimitOrder(LINKB32, Side.SELL, linkBalance, 1)
        ); 

    } );

    it("The BUY order book should be ordered on price from highest to lowest starting at index 0", async ()=>{
        const buyOrders = [1,5,3,2,6]; // order prices to create
        await link.approve(dex.address, 1000); // approve dex for deposit

        await dex.addFunds({value: ETH10});

        for (i=0; i < buyOrders.length; i++){ // create some BUY orders
            await dex.createLimitOrder(LINKB32, Side.BUY, 0.1, buyOrders[i]);
        }
        
        const orderBook = dex.getOrderBook();

        // assert that each buy order in the array is smaller than the one before
        for (i=0; i < orderBook.length - 1; i++){
            const firstOrder = orderBook[i];
            const nextOrder = orderBook[i+1];
            assert(firstOrder.price > nextOrder.price);
        }
    } );

    it("The SELL  order book should be ordered on price from lowest to highest starting at index 0", async ()=>{
        const sellOrders = [1,5,3,2,6]; // order prices to create

        await dex.deposit(10, LINKB32); // deposit 10 Tokens so we can create sell orders

        for (i=0; i < sellOrders.length; i++){ // create some BUY orders
            await dex.createLimitOrder(LINKB32, Side.SELL, 0.1, sellOrders[i]);
        }
        
        const orderBook = dex.getOrderBook();

        // assert that each buy order in the array is smaller than the one before
        for (i=0; i < orderBook.length - 1; i++){
            const firstOrder = orderBook[i];
            const nextOrder = orderBook[i+1];
            assert(firstOrder.price < nextOrder.price);
        }
    } );

    it("The User should not be able to create limit orders for not supported tokens", async ()=>{
        const AAVEB32 = web3.utils.fromUtf8("AAVE");
        truffleAssert.reverts( //create BUY order of unlisted token should fail
            dex.createLimitOrder(AAVEB32, Side.BUY, 0.1, 1)
        );
        truffleAssert.reverts( //create SELL order of unlisted token should fail
            dex.createLimitOrder(AAVEB32, Side.SELL, 0.1, 1)
        );

        //now use LINK
        truffleAssert.passes( //create BUY order should succeed
            dex.createLimitOrder(LINKB32, Side.BUY, 0.1, 1)
        );
        truffleAssert.passes( //create SELL order of unlisted token should fail
            dex.createLimitOrder(LINKB32, Side.SELL, 0.1, 1)
        );
    } );

} );
