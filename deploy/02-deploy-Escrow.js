const {ethers} = require("hardhat")

module.exports = async({deployments, getNamedAccounts})=>{
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();

    log("----deploying Escrow");
     
    const RentalCar = await ethers.getContract("RentalCar",deployer);
    const amount = ethers.parseEther("0.01");
    const address = RentalCar.target;
    
    const Escrow = await deploy("Escrow",{
        from: deployer,
        args: [address, amount],
        log:true
    })
    log("Contract deployed at",Escrow.address);
}

module.exports.tags = ["all","Escrow"]