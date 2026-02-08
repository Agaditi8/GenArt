import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const GenArtModule = buildModule("GenArtModule", (m) => {
  const genArt = m.contract("GenArt");

  return { genArt };
});

export default GenArtModule;