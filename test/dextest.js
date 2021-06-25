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

    it("Should only be possible for owner to add tokens", async ()=>{
        await truffleAssert.passes (
            await dex.addToken(web3.utils.fromUtf8("LINK"), link.address, {from: accounts[0]} )
        );  
     } );

    it("Should not be possible for anyone else to add tokens", async ()=>{
        try{
            await dex.addToken(web3.utils.fromUtf8("AAVE"), link.address, {from: accounts[1]} );
        }
        catch(error){
            console.log("ERROR: " + error);
            assert(error);
        }
    } );

    it("The user must have ETH deposited such that deposited eth >= buy order value", async ()=>{
        try{ 
            await dex.createLimitOrder(LINKB32, Side.BUY, 10, 1);
        }
        catch(error){
            assert(error);
        }
        
        //top up and check if it passes
        await dex.addFunds({from: accounts[0], value: ETH10});
        await truffleAssert.passes ( 
            // Try same create, this time it should pass.
            await dex.createLimitOrder(LINKB32, Side.BUY, 10, 1)
        );    
    } );

    it("The user must have enough tokens deposited such that token balance >= sell order amount", async ()=>{
        try{
            //  create limit order - expect to fail.
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 1);
        }
        catch(error){
            assert(error);
        } 
        
        await link.approve(dex.address, 10); 
        await dex.deposit (10, LINKB32, {from: accounts[0]}); //deposit 10 LINK

        await truffleAssert.passes (
            // This should pass now
            await dex.createLimitOrder(LINKB32, Side.SELL, 10, 1)
        ); 

    } );

    it("The BUY order book should be ordered on price from highest to lowest starting at index 0", async ()=>{
        const buyOrders = [1,5,3,2,6]; // order prices to create
        await dex.addFunds({from: accounts[0],value: ETH10});

        for (i=0; i < buyOrders.length; i++){ // create some BUY orders
            await dex.createLimitOrder(LINKB32, Side.BUY, 1, buyOrders[i]);
        }
        
        let orderBook = await dex.getOrderBook(LINKB32, Side.BUY);


        assert(orderBook.length > 0);
        // assert that each buy order in the array is smaller than the one before
        let sorted = true;

        for (i=0; i < orderBook.length - 2; i++){
            let firstOrder = orderBook[i];
            let nextOrder = orderBook[i+1];
           firstOrder.price >= nextOrder.price ? sorted = true : sorted = false;
        }
        assert(!sorted, "ORDER BOOK NOT SORTED");
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
        assert(!sorted, "ORDER BOOK NOT SORTED");
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
