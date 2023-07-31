const {ethers} = require('hardhat');
async function main(){
await deployments.fixture("RentalCar")
const factory = await ethers.getContractFactory("RentalCar");
const contract = await factory.deploy();
console.log(contract.address);
}
main().then(()=>{
    process.exit(0);
}).catch(err=>{
    console.error(err);
    process.exit(1);
})