const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
    let buyer, seller, inspector, lender, realEstate, escrow;

    beforeEach(async () => {
        [buyer, seller, inspector, lender] = await ethers.getSigners();

        // Deploy Real Estate
        const RealEstate = await ethers.getContractFactory('RealEstate');
        realEstate = await RealEstate.deploy();

        // Mint a property
        let transaction = await realEstate.connect(seller).mint("https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS");
        await transaction.wait();

        // Deploy Escrow
        const Escrow = await ethers.getContractFactory('Escrow');
        escrow = await Escrow.deploy(
            realEstate.address,
            seller.address,
            inspector.address,
            lender.address,
        )

        // Approve property
        transaction = await realEstate.connect(seller).approve(escrow.address, 1);
        await transaction.wait();

        // List property
        transaction = await escrow.connect(seller).list(1, buyer.address, tokens(10), tokens(5));
        await transaction.wait();
    })

    describe("Deployment", () => {
        it("Returns NFT address", async () => {
            expect(await escrow.nftAddress()).to.be.equal(realEstate.address)
        })

        it("Returns seller", async () => {
            expect(await escrow.seller()).to.be.equal(seller.address);
        })

        it("Returns inspector", async () => {
            expect(await escrow.inspector()).to.be.equal(inspector.address);
        })

        it("Returns lender", async () => {
            expect(await escrow.lender()).to.be.equal(lender.address);
        })
    })

    describe("Listing", () => {
        it("Updates ownership", async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
        })

        it("Updates is listed", async () => {
            const result = await escrow.isListed(1);
            expect(result).to.be.equal(true);
        })

        it("Returns buyer", async () => {
            const result = await escrow.buyer(1);
            expect(result).to.be.equal(buyer.address)
        })

        it("Returns purchase price", async () => {
            const result = await escrow.purchasePrice(1);
            expect(result).to.be.equal(tokens(10))
        })

        it("Returns escrow amount", async () => {
            const result = await escrow.escrowAmount(1);
            expect(result).to.be.equal(tokens(5));
        })

        // TODO: write test "Only seller can call list method"
        // TODO: write test "Possible to receive Eth by calling list method (check payable functionality)"
    })
})
