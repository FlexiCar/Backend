const {
  ethers,
  deployments,
  getNamedAccounts,
  network,
  waffle,
} = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains } = require("../../helper-hardhatConfig");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Escrow", () => {
      let Escrow, RentalCar;
      const PRICE = ethers.parseEther("0.01");
      // const TOKEN_ID = 0;

      beforeEach(async () => {
        const { deployer } = await getNamedAccounts();
        await deployments.fixture();
        Escrow = await ethers.getContract("Escrow", deployer);
        RentalCar = await ethers.getContract("RentalCar", deployer);
      });
      it("intializes constructor", async () => {
        const address = await Escrow.s_nftAddress();
        const fee = await Escrow.s_fee();

        expect(address).to.equal(RentalCar.target);
        expect(fee).to.not.equal(0);
      });

      describe("List Items Propely", async () => {
        it("Price must be greater than zero", async () => {
          const tx = await RentalCar.createNft("testURI");
          await tx.wait();
           const tx1 = await RentalCar.createNft("testUR/kjkjdpe4rI");
           await tx1.wait();
         console.log(tx1);
          const TOKEN_ID = await RentalCar.getTotalSupply();
          // = await RentalCar.getTotalSupply();
          console.log(TOKEN_ID);
          expect(await Escrow.listCar(TOKEN_ID, 2, 2, 2)).to.be.reverted;
        });
      });
    });
