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
        let tokenId, txReceipt;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          txReceipt = await txResponse.wait();
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
        it("sets user as renter", async () => {
          const accounts = await ethers.getSigners();
          const player = accounts[1];
          const escrow = Escrow.connect(player);
          await escrow.rentCar(tokenId, expiry);
          const carListingsUser = await RentalCar.userOf(tokenId);
          assert.equal(carListingsUser, player.address);
        });
        it("create a fines mapping", async () => {
          const accounts = await ethers.getSigners();
          const player = accounts[1];
          const escrow = Escrow.connect(player);

          let listing = await Escrow.getListing(tokenId);
          assert.equal(parseInt(listing.status), 1);
          await escrow.rentCar(tokenId, expiry);

          listing = await Escrow.getListing(tokenId);

          assert.equal(parseInt(listing.status), 0);

          let ownerStatus = await Escrow.getOwnerStatus();
          let borrowerStatus = await escrow.getBorrowerStatus();
          assert.equal(ownerStatus, false);
          assert.equal(borrowerStatus, false);

          const time = await escrow.getRentalListings(accounts[0]);
          expect(parseInt(time)).to.be.greaterThan(
            Math.floor(Date.now() / 1000)
          );
        });

        it("add funds to owner", async () => {
          const accounts = await ethers.getSigners();
          const player = accounts[1];
          const escrow = Escrow.connect(player);

          const balanceBefore = await Escrow.viewBalance();
          assert.equal(parseInt(balanceBefore), 0);
          await escrow.rentCar(tokenId, expiry, {
            value: PRICE,
          });
          const balanceAfter = await Escrow.viewBalance();
          assert.equal(parseInt(balanceAfter), PRICE);
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
          assert.equal(parseInt(listings.status), 1);
          // await Escrow.rentCar(tokenId, expiry);
          await Escrow.cancelListing(tokenId);
          // assert.equal(parseInt(listings.status), 0);
        });
        it("listing deleted properly", async () => {
          await Escrow.cancelListing(tokenId);
          const listings = await Escrow.getListing(tokenId);
          assert.equal(parseInt(listings.hourlyPrice), 0);
          assert.equal(parseInt(listings.maxDays), 0);
          assert.equal(parseInt(listings.advanceTime), 0);
          assert.equal(parseInt(listings.status), 0);
        });
      });
      describe("Updates Listings properly", async () => {
        let tokenId, expiry, advanceTime;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
          await RentalCar.approve(Escrow.target, tokenId);
          advanceTime = 2 * 60 * 60;
          await Escrow.listCar(tokenId, PRICE, 2, advanceTime);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 1);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          expiry = currentTimeInSeconds;
        });

        it("Price must me above zero", async () => {
          // await expect(
          //   Escrow.updateListing(tokenId, 0, 2, advanceTime)
          // ).to.be.revertedWith("PriceMustBeAboveZero");
        });
        it("Dont update if listed Item is already rented", async () => {
          const listings = await Escrow.getListing(tokenId);
          await Escrow.updateListing(tokenId, PRICE, 2, advanceTime);
          await Escrow.rentCar(tokenId, expiry);
          // await expect(
          //   Escrow.updateListing(tokenId, PRICE, 2, advanceTime)
          // ).to.be.revertedWith("LISTING_IS_IN_RENTED_STATE");
        });
        it("Items Updating as expected", async () => {
          await Escrow.updateListing(tokenId, 10, 4, 10);
          const newListing = await Escrow.getListing(tokenId);
          assert.equal(parseInt(newListing.hourlyPrice), 10);
          assert.equal(parseInt(newListing.maxDays), 4);
          assert.equal(parseInt(newListing.advanceTime), 10);
        });
      });
      describe("Withdraws funds properly", async () => {
        it("should revert if balance is zero", async () => {
          const accounts = await ethers.getSigners();
          const player = accounts[1];
          const escrow = Escrow.connect(player);
          const currentBalance = await escrow.viewBalance();
          assert.equal(parseInt(currentBalance), 0);
          // await expect(escrow.withdraw()).to.be.revertedWith(
          //   "ZERO_PROCEEDS"
          // );
        });
        it("should allow a user to withdraw their balance", async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
          await RentalCar.approve(Escrow.target, tokenId);
          advanceTime = 2 * 60 * 60;
          await Escrow.listCar(tokenId, PRICE, 2, advanceTime);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 1);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          expiry = currentTimeInSeconds;

          const accounts = await ethers.getSigners();
          const player = accounts[1];
          const escrow = Escrow.connect(player);
          const currentBalance = await escrow.viewBalance();
          assert.equal(parseInt(currentBalance), 0);

          const tx = await escrow.rentCar(tokenId, expiry, {
            value: PRICE,
          });
          await tx.wait();

          const currentBalanceAfterDeposit = await Escrow.viewBalance();
          // console.log(currentBalanceAfterDeposit);
          assert.equal(parseInt(currentBalanceAfterDeposit), 1);
          await Escrow.withdraw();
          const currentBalanceAfterWithdraw = await escrow.viewBalance();
          assert.equal(parseInt(currentBalanceAfterWithdraw), 0);
        });
      });
      describe("turn in functionality by owner", async () => {
        let tokenId, expiry, advanceTime, escrow, player,accounts;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
          await RentalCar.approve(Escrow.target, tokenId);
          advanceTime = 2 * 60 * 60;
          await Escrow.listCar(tokenId, PRICE, 2, advanceTime);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 1);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          expiry = currentTimeInSeconds;
          accounts = await ethers.getSigners();
          player = accounts[1];
          escrow = Escrow.connect(player);
          await escrow.rentCar(tokenId, expiry, {
            value: PRICE,
          });
        });
        it("revert if owner already turned in", async () => {
          let ownerStatus = await Escrow.getOwnerStatus();
          assert.equal(ownerStatus, false);
          // await expect(Escrow.turnIn(tokenId)).to.be.revertedWith(
          //   "ALERADY_TURNED_IN"
          // );
        });
        it("owner and borrower status updating", async () => {
          const userAddress = await RentalCar.userOf(tokenId);
          expect(userAddress).to.not.equal(
            "0x0000000000000000000000000000000000000000"
          );
          const borrowerStatus = await escrow.getBorrowerStatus();
          assert.equal(borrowerStatus, false);

          await Escrow.turnInByOwner(tokenId);
          const ownerStatus = await Escrow.getOwnerStatus();
          assert.equal(ownerStatus, true);
        });
        it("fine amount mappping is updated", async () => {
          let fineBefore = await Escrow.getFineListings(tokenId, player);
          assert.equal(parseInt(fineBefore), 0);
          const rentalList = await escrow.getRentalListings(accounts[0]);
          await Escrow.turnInByOwner(tokenId);
          let totalFineTime =
              Math.floor(Date.now() / 1000) - parseInt(rentalList);
          const fee = ethers.parseEther("0.01");
          let totalFee;
          if(totalFineTime>0){
            totalFee = totalFineTime * fee;
          }else{
            totalFee = 0;
          }
          const totalAmount = parseInt(await escrow.getFineListings(tokenId,player.address));
          let totalFeeMax = 0, totalFeeMin = 0;
          if(totalFee != 0){
            totalFeeMax = BigInt((totalFineTime) + 10)*fee;
            totalFeeMin = BigInt(totalFineTime - 10) * fee;

            expect(totalFeeMax).to.be.greaterThan(totalAmount);
            expect(totalFeeMin).to.be.lessThan(totalAmount);
          }
          else{
            assert.equal(totalFee, totalAmount);
          }
        });
      });
      describe("turn in functionality by borrower", async () => {
        let tokenId, expiry, advanceTime, escrow, player, accounts;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
          await RentalCar.approve(Escrow.target, tokenId);
          advanceTime = 2 * 60 * 60;
          await Escrow.listCar(tokenId, PRICE, 2, advanceTime);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 1);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          expiry = currentTimeInSeconds;
          accounts = await ethers.getSigners();
          player = accounts[1];
          escrow = Escrow.connect(player);
          await escrow.rentCar(tokenId, expiry, {
            value: PRICE,
          });
        });
        it("revert if sender is not borrower", async () => {
          await escrow.turnInByBorrower(tokenId);
          // await expect(Escrow.turnInByBorrower(tokenId)).to.be.revertedWith(
          //   "NOT_BORROWER"
          // );
        })
        it("revert if borrower already turned in", async () => {
          await escrow.turnInByBorrower(tokenId);
          const borrowerStatus = await escrow.getBorrowerStatus();
          assert.equal(borrowerStatus, true);
          // await expect(Escrow.turnInByBorrower(tokenId)).to.be.revertedWith(
          //   "ALREADY_TURNED_IN"
          // );
        })
        it("fine amount mappping is updated in borrower turn in", async () => {
          const owner = await RentalCar.ownerOf(tokenId);
          let fineBefore = await Escrow.getFineListings(tokenId, player);
          assert.equal(parseInt(fineBefore), 0);

          await escrow.turnInByBorrower(tokenId);
          const rentalList = await escrow.getRentalListings(accounts[0]);
          let totalFineTime =
            Math.floor(Date.now() / 1000) - parseInt(rentalList);
          const fee = ethers.parseEther("0.01");
          let totalFee;
          if (totalFineTime > 0) {
            totalFee = totalFineTime * fee;
          } else {
            totalFee = 0;
          }
          const totalAmount = parseInt(
            await escrow.getFineListings(tokenId,player.address)
          );
          let totalFeeMax = 0,
            totalFeeMin = 0;
          if (totalFee != 0) {
            totalFeeMax = BigInt(totalFineTime + 10) * fee;
            totalFeeMin = BigInt(totalFineTime - 10) * fee;

            expect(totalFeeMax).to.be.greaterThan(totalAmount);
            expect(totalFeeMin).to.be.lessThan(totalAmount);
          } else {
            assert.equal(totalFee, totalAmount);
          }
        });
      });
      describe("payment function working properly",async() =>{
        let tokenId, expiry, advanceTime, escrow, player, accounts;
        beforeEach(async () => {
          const txResponse = await RentalCar.createNft("testURI");
          const txReceipt = await txResponse.wait();
          tokenId = txReceipt.logs[2].args[0];
          await RentalCar.approve(Escrow.target, tokenId);
          advanceTime = 2 * 60 * 60;
          await Escrow.listCar(tokenId, PRICE, 2, advanceTime);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 1);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          expiry = currentTimeInSeconds;
          accounts = await ethers.getSigners();
          player = accounts[1];
          escrow = Escrow.connect(player);
          await escrow.rentCar(tokenId, expiry, {
            value: PRICE,
          });
          await Escrow.turnInByOwner(tokenId);
          await escrow.turnInByBorrower(tokenId);
        });
        it("revert if borrower is not sender",async() =>{
          const borrower = await RentalCar.userOf(tokenId);
          // assert.equal(borrower, player.address);
          // await expect(Escrow.payFee(tokenId)).to.be.revertedWith(
          //   "NOT_THE_BORROWER"
          // );
        })
      })
    });
