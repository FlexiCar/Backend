const {} = require("hardhat")

module.exports = async({getNamedAccounts, deployments})=>{
    const {deploy,log} = deployments;
    const {deployer} = await getNamedAccounts();
   log ("Going to deploy RentalCar")
   const RentalCar = await deploy("RentalCar",{
        from : deployer,
        args : ['Sam',"s"],
        log : true
    });
    

    // const contract = await ethers.getContract("RentalCar");
    // log (contract);
    log("Contract deployed",RentalCar);

    module.exports.tags = ['RentalCar'];
} 