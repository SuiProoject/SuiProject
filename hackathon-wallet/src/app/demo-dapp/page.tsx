"use client";

import { useEffect, useState } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

// --- AYARLAR ---
const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b";
const CLIENT_ID = "pikhmq1ra3gfr4emzjjt56kzu0pd4v";
// Buraya "Payment" modülünü kullanacağız ama "Kahve Dükkanı" gibi göstereceğiz
const PACKAGE_ID = "0x3f60ec52273d0ac7c0c98ad1dfe51c4e5d2f62e9713a97d4f1a2c55834c81cc4"; 
const MODULE_NAME = "payment"; 
const FUNCTION_NAME = "send_sui"; 

// Dükkanın (Demo dApp) Sahibi Adresi (Paralar buraya gelecek)
const SHOP_ADDRESS = "0x7d20dcdb2bca4f508ea9613994683eb4e76e9c4ed274648c2215206056402839"; 

export default function DemoShop() {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const enokiFlow = new EnokiFlow({ apiKey: ENOKI_API_KEY });

  // 1. GİRİŞ: dApp içinde gömülü login
  const handleLogin = async () => {
    const authUrl = await enokiFlow.createAuthorizationURL({
      provider: "twitch", // veya twitter/twitch
      clientId: CLIENT_ID,
      redirectUrl: window.location.href, // Login sonrası buraya dön
      network: "testnet",
    });
    window.location.href = authUrl;
  };

  // 2. TEK TIKLA SATIN ALMA (Ephemeral Key Gücü)
  const buyCoffee = async () => {
    setLoading(true);
    try {
      const client = new SuiClient({ url: getFullnodeUrl("testnet") });
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });
      
      const tx = new Transaction();
      // Kahve fiyatı: 0.01 SUI
      const price = BigInt(10000000); 

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [
          tx.gas,
          tx.pure.address(SHOP_ADDRESS), 
          tx.pure.u64(price),
        ],
      });

      await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
      });

      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
    setLoading(false);
  };

  useEffect(() => {
    // Sayfa yüklenince oturumu kontrol et
    (async () => {
        if (window.location.hash.includes("id_token")) {
            await enokiFlow.handleAuthCallback();
            window.history.replaceState(null, "", window.location.pathname);
        }
        try {
            const keypair = await enokiFlow.getKeypair({ network: "testnet" });
            setUserAddress(keypair.toSuiAddress());
        } catch {}
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 to-yellow-50 flex flex-col items-center justify-center font-sans text-gray-800">
      
      {/* ÜST KISIM: Simüle Edilmiş Oyun/Market Logosu */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold text-orange-600 mb-2">☕ CyberCoffee</h1>
        <p className="text-gray-600">The First Walletless Coffee Shop on Sui</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border-4 border-orange-200">
        
        {/* ÜRÜN GÖRSELİ */}
        <div className="bg-orange-50 rounded-xl p-6 mb-6 flex justify-center items-center h-40">
           <div className="text-8xl">☕</div>
        </div>

        <h2 className="text-2xl font-bold mb-1">Morning Brew</h2>
        <p className="text-gray-400 mb-6">Fiyat: 0.01 SUI</p>

        {/* --- GİRİŞ YAPILMAMIŞSA --- */}
        {!userAddress ? (
            <div className="text-center">
                <p className="text-sm text-gray-500 mb-4">Satın almak için UniPass ile bağlan</p>
                <button 
                    onClick={handleLogin}
                    className="w-full bg-black text-white font-bold py-4 rounded-xl hover:scale-105 transition shadow-lg flex items-center justify-center gap-2"
                >
                    Login with UniPass ⚡
                </button>
            </div>
        ) : (
            // --- GİRİŞ YAPILMIŞSA (Walletless Experience) ---
            <div>
                <button 
                    onClick={buyCoffee}
                    disabled={loading || status === 'success'}
                    className={`w-full py-4 rounded-xl font-bold text-xl text-white shadow-lg transition hover:scale-105 ${
                        status === 'success' ? 'bg-green-500' : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                >
                    {loading ? "İşleniyor..." : status === 'success' ? "Afiyet Olsun! ✓" : "Satın Al (Tek Tık)"}
                </button>
                
                {status === 'success' && (
                    <p className="text-green-600 text-xs text-center mt-3 font-bold">
                        İşlem hash ve imza arka planda tamamlandı!
                    </p>
                )}
                
                {/* HATA DÜZELTİLDİ: </button> yerine </p> yapıldı */}
                <p className="text-xs text-gray-300 text-center mt-4">
                    Logged in as: {userAddress.slice(0,6)}...
                </p>
            </div>
        )}
      </div>
    </div>
  );
}