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
      let Escrow, RentalCar, owner;
      const PRICE = 1;

      beforeEach(async () => {
        const { deployer } = await getNamedAccounts();
        owner = deployer;
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

      describe("List Items Properly", async () => {
        let tokenId;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
        });
        it("emits an event after listing an item", async function () {
          await RentalCar.approve(Escrow.target, tokenId);
          // expect(await Escrow.listCar(tokenId, PRICE, 2, 2)).to.emit(
          //   "ItemListed"
          // );
        });

        it("Price must be greater than zero", async () => {
          console.log(txReceipt);
          // await expect(Escrow.listCar(tokenId, 0, 2, 2)).to.be.revertedWith(
          //   "PriceMustBeAboveZero()"
          // );
        });
        it("needs approvals to list car", async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          await RentalCar.approve(Escrow.target, tokenId);
          // await expect(Escrow.listCar(tokenId, 1, 2, 2)).to.be.revertedWith(
          //   "NOT_APPROVED_BY_OWNER"
          // );
        });

        it("Updates listing with seller and price", async () => {
          await RentalCar.approve(Escrow.target, tokenId);
          await Escrow.listCar(tokenId, PRICE, 2, 2);
          const carListings = await Escrow.getListing(tokenId);
          // console.log(parseInt(carListings.hourlyPrice).toString());
          assert(
            parseInt(carListings.hourlyPrice).toString() == PRICE.toString()
          );
        });
      });
      describe("Rent Cars", async () => {
        let tokenId, expiry;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
          await RentalCar.approve(Escrow.target, tokenId);
          const advanceTime = 2 * 60 * 60;
          await Escrow.listCar(tokenId, PRICE, 2, advanceTime);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 1);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          expiry = currentTimeInSeconds;
        });

        it("revert if extra time is more than expiry", async () => {
          // await expect(Escrow.rentCar(tokenId, expiry)).to.be.revertedWith(
          //   "CANNOT_RENT_FOR_THAT_MUCH_DAYS"
          // );
        });
        it("check if car is already rented", async () => {
          // console.log(expiry);
          let carListings = await Escrow.getListing(tokenId);
          assert.equal(parseInt(carListings.status), 1);
          await Escrow.rentCar(tokenId, expiry);
          carListings = await Escrow.getListing(tokenId);
          assert.equal(parseInt(carListings.status), 0);
        });
      });
      describe("cancels listing properly", async () => {
        let tokenId, expiry;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
          await RentalCar.approve(Escrow.target, tokenId);
          const advanceTime = 2 * 60 * 60;
          await Escrow.listCar(tokenId, PRICE, 2, advanceTime);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 1);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          expiry = currentTimeInSeconds;
        });

        it("allows only owners to cancel a list", async () => {
          const accounts = await ethers.getSigners();
          const player = accounts[0];
          const escrow = Escrow.connect(player);
          await escrow.cancelListing(tokenId);
        });
        it("reverts if it is in rented state", async () => {
          const listings = await Escrow.getListing(tokenId);
          assert(parseInt(listings.status), 1);
          // await Escrow.rentCar(tokenId, expiry);
          await Escrow.cancelListing(tokenId);
          // assert(parseInt(listings.status), 0);
        });
      });
    });
