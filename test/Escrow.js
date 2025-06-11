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

    describe("Deposits", () => {
        it("Updates contract balance", async () => {
            const transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) })
            await transaction.wait()
            const result = await escrow.getBalance()
            expect(result).to.be.equal(tokens(5))
        })
    })

    describe("Inspection", () => {
        it("Updates inspection status", async () => {
            const transaction = await escrow.connect(inspector).updateInspectionStatus(1, true)
            await transaction.wait()
            const result = await escrow.inspectionPassed(1)
            expect(result).to.be.equal(true)
        })
    })

    describe("Approval", () => {
        it("Updates approval status", async () => {
            let transaction = await escrow.connect(lender).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(seller).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            expect(await escrow.approval(1, lender.address)).to.be.equal(true)
            expect(await escrow.approval(1, seller.address)).to.be.equal(true)
            expect(await escrow.approval(1, buyer.address)).to.be.equal(true)
        })
    })

    describe("Cancel sale", () => {
        it("Returns earnest money to buyer when sale is cancelled", async () => {
            // Get initial balances
            const initialBuyerBalance = await ethers.provider.getBalance(buyer.address)

            // Deposit earnest money
            const transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) })
            const receipt = await transaction.wait()

            // Verify contract has the earnest money
            expect(await escrow.getBalance()).to.be.equal(tokens(5))

            // Cancel the sale
            const cancelTx = await escrow.cancelSale(1)
            const cancelReceipt = await cancelTx.wait()

            // Verify contract balance is 0
            expect(await escrow.getBalance()).to.be.equal(0)

            // Get final buyer balance
            const finalBuyerBalance = await ethers.provider.getBalance(buyer.address)

            // Calculate gas costs for both transactions
            const depositGasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice)
            const cancelGasCost = cancelReceipt.gasUsed.mul(cancelReceipt.effectiveGasPrice)
            const totalGasCost = depositGasCost.add(cancelGasCost)

            // Verify buyer received their money back (accounting for gas costs)
            expect(finalBuyerBalance).to.be.closeTo(
                initialBuyerBalance.sub(totalGasCost),
                ethers.utils.parseEther("0.1") // Allow for some gas cost variation
            )
        })
    })

    describe("Sale", () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) })
            await transaction.wait()

            transaction = await escrow.connect(inspector).updateInspectionStatus(1, true)
            await transaction.wait()

            transaction = await escrow.connect(seller).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(lender).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            await lender.sendTransaction({ to: escrow.address, value: tokens(5) })

            transaction = await escrow.connect(seller).finalizeSale(1)
            await transaction.wait()
        })

        it("Updates ownership", async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address)
        })

        it("Updates balance", async () => {
            expect(await escrow.getBalance()).to.be.equal(0)
        })
    })
})
