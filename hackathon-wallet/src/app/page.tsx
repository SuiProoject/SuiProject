"use client";

import { useEffect, useState } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import QRCode from "react-qr-code";

// --- AYARLAR ---
const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b";
const CLIENT_ID = "pikhmq1ra3gfr4emzjjt56kzu0pd4v"; 
const PACKAGE_ID = "0x3f60ec52273d0ac7c0c98ad1dfe51c4e5d2f62e9713a97d4f1a2c55834c81cc4"; 
const MODULE_NAME = "payment"; 
const FUNCTION_NAME = "send_sui"; 

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("Yükleniyor...");
  const [loading, setLoading] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  
  // --- STATE'LER ---
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>(""); 
  const [showAddress, setShowAddress] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [copied, setCopied] = useState(false); // Modal içindeki kopyalama için
  const [mainCopied, setMainCopied] = useState(false); // Ana ekrandaki kopyalama için

  const enokiFlow = new EnokiFlow({ apiKey: ENOKI_API_KEY });

  // --- Giriş ---
  const handleLogin = async () => {
    const redirectUrl = window.location.origin;
    const authUrl = await enokiFlow.createAuthorizationURL({
      provider: "twitch",
      clientId: CLIENT_ID,
      redirectUrl,
      network: "testnet",
    });
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    enokiFlow.logout();
    window.location.href = "/";
  };

  // --- KOPYALAMA FONKSİYONLARI ---
  
  // 1. Ana ekrandaki küçük buton için
  const copyAddressMain = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setMainCopied(true);
      setTimeout(() => setMainCopied(false), 2000);
    }
  };

  // 2. Modal içindeki buton için
  const copyToClipboardModal = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDisplayAddress = () => {
    if (!address) return "";
    if (showAddress) return address;
    return `${address.slice(0, 6)}...****...${address.slice(-4)}`;
  };

  // --- TRANSFER İŞLEMİ ---
  const sendSuiViaContract = async () => {
    if (!address) return alert("Bağlı hesap yok!");
    if (!amount || isNaN(Number(amount))) return alert("Geçerli bir miktar girin!");

    setLoading(true);
    setTxDigest(null);

    try {
      const client = new SuiClient({ url: getFullnodeUrl("testnet") });
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });
      const tx = new Transaction();
      const amountInMist = BigInt(Math.floor(Number(amount) * 1_000_000_000));

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [
          tx.gas,                 
          tx.pure.address(recipient), 
          tx.pure.u64(amountInMist),  
        ],
      });

      const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
      });

      setTxDigest(result.digest);
      alert("✅ Transfer başarılı!");
    } catch (err) {
      console.error("Hata:", err);
      alert("❌ İşlem başarısız!");
    }
    setLoading(false);
  };

  // --- SAYFA YÜKLENİNCE ---
  useEffect(() => {
    (async () => {
      try {
        if (window.location.hash.includes("id_token")) {
          await enokiFlow.handleAuthCallback();
          window.history.replaceState(null, "", window.location.pathname);
        }

        const keypair = await enokiFlow.getKeypair({ network: "testnet" });
        const userAddr = keypair.toSuiAddress();
        setAddress(userAddr);

        const client = new SuiClient({ url: getFullnodeUrl("testnet") });
        const coins = await client.getCoins({ owner: userAddr });
        const total = coins.data.reduce((acc, c) => acc + Number(c.balance), 0);
        setBalance((total / 1e9).toFixed(3) + " SUI");
      } catch (e) {
        console.log("Giriş yok.");
      }
    })();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans relative">
      <h1 className="text-4xl font-bold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
        UniPass Demo
      </h1>

      {!address && (
        <button
          onClick={handleLogin}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-xl transition shadow-lg transform hover:scale-105"
        >
          Twitch ile Giriş Yap
        </button>
      )}

      {address && (
        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl max-w-md w-full relative z-10">
          <div className="flex justify-between items-center mb-6">
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">
              CONNECTED
            </span>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-sm">
              Çıkış
            </button>
          </div>

          <p className="text-gray-400 text-sm mb-1">Cüzdan Adresin</p>
          
          {/* --- ADRES ALANI (GİZLEME + KOPYALAMA) --- */}
          <div className="flex items-center bg-gray-900 p-3 rounded mb-5 justify-between border border-gray-700">
            <div className="flex items-center gap-2 overflow-hidden">
                <p className="font-mono text-yellow-300 text-xs truncate">
                {getDisplayAddress()}
                </p>
                
                {/* KOPYALAMA BUTONU */}
                <button 
                    onClick={copyAddressMain}
                    className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-gray-800"
                    title="Adresi Kopyala"
                >
                    {mainCopied ? (
                        // Tik İkonu (Yeşil)
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#4ade80" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    ) : (
                        // Kopyala İkonu
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                    )}
                </button>
            </div>

            {/* GİZLE/GÖSTER BUTONU */}
            <button 
              onClick={() => setShowAddress(!showAddress)}
              className="text-gray-400 hover:text-white transition ml-2"
              title={showAddress ? "Gizle" : "Göster"}
            >
              {showAddress ? (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                   <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
              ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                 </svg>
              )}
            </button>
          </div>
          {/* ------------------------------------- */}

          <p className="text-gray-400 text-sm mb-1">Bakiye</p>
          <p className="text-4xl font-bold mb-8">{balance}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
               onClick={sendSuiViaContract}
               disabled={loading}
               className="bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold transition text-center"
            >
               {loading ? "..." : "Gönder"}
            </button>
            <button
               onClick={() => setIsReceiveOpen(true)}
               className="bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-bold transition text-center border border-gray-600"
            >
               Sui Al ⬇️
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <input
              type="text"
              placeholder="Alıcı Adresi (0x...)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg text-sm border border-gray-600 focus:border-blue-500 outline-none"
            />
            <input
              type="number"
              placeholder="Miktar (SUI)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg text-sm border border-gray-600 focus:border-blue-500 outline-none"
            />
          </div>

          {txDigest && (
            <div className="mt-4 p-3 bg-green-500/10 rounded border border-green-500/30">
              <p className="text-green-400 text-sm font-bold">✓ İşlem Başarılı!</p>
            </div>
          )}
        </div>
      )}

      {isReceiveOpen && address && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white text-gray-900 rounded-2xl p-8 max-w-sm w-full relative shadow-2xl animate-fadeIn">
            <button 
              onClick={() => setIsReceiveOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl"
            >
              ✕
            </button>
            
            <h2 className="text-2xl font-bold text-center mb-2">Sui Yükle</h2>
            <p className="text-gray-500 text-center text-sm mb-6">
              Aşağıdaki QR kodu taratarak veya adresi kopyalayarak bu hesaba SUI gönderebilirsin.
            </p>

            <div className="flex justify-center mb-6 bg-white p-2 rounded-xl border-2 border-gray-100">
               <QRCode 
                 value={address} 
                 size={180}
                 viewBox={`0 0 256 256`}
               />
            </div>

            <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-between mb-4">
               <p className="text-xs font-mono text-gray-600 truncate w-48">{address}</p>
               <button 
                 onClick={copyToClipboardModal}
                 className="text-blue-600 font-bold text-xs uppercase hover:text-blue-800"
               >
                 {copied ? "Kopyalandı!" : "Kopyala"}
               </button>
            </div>

            <button
               onClick={() => setIsReceiveOpen(false)}
               className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition"
            >
               Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}