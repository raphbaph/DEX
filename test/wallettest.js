const Dex = artifacts.require("Dex");
const Link = artifacts.require("Link");
const truffleAssert = require('truffle-assertions');

contract("Dex", accounts => {
    it("Should only be possible for owner to add tokens", async ()=>{
        let dex = await Dex.deployed();
        let link = await Link.deployed();

        await truffleAssert.passes (
            await dex.addToken(web3.utils.fromUtf8("LINK"), link.address, {from: accounts[0]} )
        );  
    /*   
        try {
            await dex.addToken(web3.utils.fromUtf8("AAVE"), link.address, {from: accounts[1]} );
            throw null;
        }
        catch(error){
            assert(error, "Expected transaction to fail, but it didn't");

        }
    */        
    } );

    it("Should not be possible for anyone else to add tokens", async ()=>{
        let dex = await Dex.deployed();
        let link = await Link.deployed();

        await truffleAssert.reverts (
            await dex.addToken(web3.utils.fromUtf8("AAVE"), link.address, {from: accounts[1]} )
        );  
    } );
} )