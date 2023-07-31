const { ethers, deployments, getNamedAccounts, network } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains } = require("../../helper-hardhatConfig");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Escrow", () => {
      let Escrow, RentalCar;

      beforeEach(async () => {
        const {deployer} = await getNamedAccounts();
        await deployments.fixture();
        Escrow = await ethers.getContract("Escrow", deployer)
        RentalCar = await ethers.getContract("RentalCar", deployer);
      });
      it("intializes constructor", async () => {
        const address = await Escrow.s_nftAddress();
        const fee = await Escrow.s_fee();

        expect(address).to.equal(RentalCar.target);
        expect(fee).to.not.equal(0);
      });
    });
