const Roulette = artifacts.require("Roulette");
const RouletteMock = artifacts.require("RouletteMock");

module.exports = function (deployer) {
    deployer.deploy(Roulette);
    deployer.deploy(RouletteMock);
}