import "../styles/globals.css";
import { Web3ReactProvider } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";

const getLibrary = (provider) => {
  return new Web3Provider(provider);
};

function MyApp({ Component, pageProps }) {
  return (
    <div style={{ backgroundColor: "white" }}>
    <style>{`html, body { background-color: white; }`}</style>
  <Web3ReactProvider getLibrary={getLibrary}>
      <Component {...pageProps} />
    </Web3ReactProvider>

  </div>
    
  );
}

export default MyApp;