const { ethers, network, deployments, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhatConfig");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("RentalCar", () => {
      var RentalCar;

      beforeEach(async () => {
        const { deployer } = await getNamedAccounts();
        await deployments.fixture();
        RentalCar = await ethers.getContract("RentalCar", deployer);
      });

      it("Will initialise the constructor", async () => {
        //Check the constructor variables
        const name = await RentalCar.name();
        const symbol = await RentalCar.symbol();
        expect(name.toString()).to.equal("Sam");
        expect(symbol.toString()).to.equal("s");
      });

      describe("Will create NFT && Users will be able to rent", () => {
        let signer, url, escrow, lender;

        beforeEach(async () => {
          signer = (await ethers.getSigners())[0];
          lender = (await ethers.getSigners())[1];
          escrow = (await ethers.getSigners())[2];
          url = "https://www.google.com";
          const tx = await RentalCar.connect(signer).createNft(url);
          await tx.wait(1);
        });
        it("User is able to mint a NFT", async () => {
          const URI = await RentalCar.tokenURI(1);
          const owner = await RentalCar.ownerOf(1);
          assert.equal(URI.toString(), url);
          expect(owner).to.equal(signer.address);
        });

        it("Set the User of the nft ", async () => {
          await RentalCar.connect(signer).approve(escrow.address, 1);
          const currentDate = new Date();
          currentDate.setHours(currentDate.getHours() + 2);
          const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
          const tx = await RentalCar.connect(escrow).setUser(1, lender.address,currentTimeInSeconds);
          await tx.wait(1);
          const user = await RentalCar.userOf(1);
          const expires = await RentalCar.userExpires(1);
          expect(user).to.be.equal(lender.address);
          expect(parseInt(expires)).to.be.equal(currentTimeInSeconds);
        });
      });
    });
