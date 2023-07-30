const {} = require("hardhat")

module.exports = async({getNamedAccounts, deployments})=>{
    const {deploy,log} = deployments;
    const {deployer} = await getNamedAccounts();
   log ("Going to deploy RentalCar")
   log(deployer);
    await deploy("RentalCar",{
        from : deployer,
        args : ['Sam',"s"],
        log : true
    });
    log("Contract deployed");

    module.exports.tags = ['RentalCar'];
} 