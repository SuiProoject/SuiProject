"use client";

import { useEffect, useState } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions"; // <-- YENİ EKLENDİ

// --- BURALARI KENDİ BİLGİLERİNLE DOLDUR ---
const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b"; 
const CLIENT_ID = "pikhmq1ra3gfr4emzjjt56kzu0pd4v"; // Twitch veya Google ID

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("Yükleniyor...");
  const [loading, setLoading] = useState(false); // İşlem yapılıyor mu?
  const [txDigest, setTxDigest] = useState<string | null>(null); // İşlem kodu

  const enokiFlow = new EnokiFlow({ apiKey: ENOKI_API_KEY });

  // Giriş Fonksiyonu
  const handleLogin = async () => {
    const redirectUrl = window.location.origin;
    const authUrl = await enokiFlow.createAuthorizationURL({
      provider: "twitch", // Veya "google"
      clientId: CLIENT_ID,
      redirectUrl: redirectUrl,
      network: "testnet",
    });
    window.location.href = authUrl;
  };

  // Çıkış Fonksiyonu
  const handleLogout = () => {
    enokiFlow.logout();
    window.location.href = "/";
  };

  const sendTransaction = async () => {
    if (!address) return;
    setLoading(true);
    setTxDigest(null);

    try {
      // 1. Client'ı başlat
      const client = new SuiClient({ url: getFullnodeUrl("testnet") });

      // 2. Enoki'den "Anahtarını" (Signer) al
      // Bu anahtar, işlemi imzalamak için kullanılacak
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });

      // 3. İşlem bloğunu oluştur
      const tx = new Transaction();
      const amount = 10000000; // 0.01 SUI
      
      // Kendine para gönderme komutlarını ekle
      const [coin] = tx.splitCoins(tx.gas, [amount]);
      tx.transferObjects([coin], address);

      // 4. STANDART İŞLEM GÖNDERİMİ (Enoki metodu yerine bunu kullanıyoruz)
      // "Param var, gaz ücretini ben öderim" diyoruz.
      const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: {
          showEffects: true, // İşlem sonucunu detaylı görmek için
        },
      });

      console.log("İşlem Başarılı!", result);
      setTxDigest(result.digest);
      alert("✅ İşlem Başarılı! Explorer'dan kontrol edebilirsin.");

    } catch (error) {
      console.error("Transfer hatası:", error);
      alert("❌ İşlem başarısız oldu. Konsola bak (F12).");
    } finally {
      setLoading(false);
    }
  };

  // Sayfa Yüklenince

  useEffect(() => {
    async function checkLogin() {
      if (window.location.hash.includes("id_token")) {
        await enokiFlow.handleAuthCallback();
        window.history.replaceState(null, "", window.location.pathname);
      }

      // Kullanıcı oturumu var mı?
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });
      const userAddr = keypair.toSuiAddress();
      setAddress(userAddr);

      // Bakiye Çek
      const client = new SuiClient({ url: getFullnodeUrl("testnet") });
      const coins = await client.getCoins({ owner: userAddr });
      const totalMist = coins.data.reduce((acc, coin) => acc + parseInt(coin.balance), 0);
      setBalance((totalMist / 1_000_000_000).toFixed(2) + " SUI");
    }
    
    checkLogin().catch((e) => console.log("Giriş yapılmamış"));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans">
      <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
        Sui zkLogin Demo
      </h1>

      {!address ? (
        <button
          onClick={handleLogin}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-xl transition shadow-lg transform hover:scale-105"
        >
          Twitch ile Başla
        </button>
      ) : (
        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 text-center shadow-2xl max-w-md w-full">
          <div className="flex justify-between items-center mb-6">
             <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">CONNECTED</span>
             <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-sm">Çıkış</button>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-1">Cüzdan Adresin</p>
            <p className="font-mono text-yellow-300 break-all bg-gray-900 p-2 rounded text-xs">{address}</p>
          </div>

          <div className="mb-8">
            <p className="text-gray-400 text-sm mb-1">Bakiye</p>
            <p className="text-4xl font-bold text-white">{balance}</p>
          </div>

          {/* İŞLEM BUTONU */}
          <button 
            onClick={sendTransaction}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition ${
              loading ? "bg-gray-600 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30 shadow-lg"
            }`}
          >
            {loading ? "İşlem Onaylanıyor..." : "💸 Kendine 0.01 SUI Gönder"}
          </button>

          {txDigest && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-green-400 text-sm font-bold mb-2">✅ İşlem Onaylandı!</p>
              <a 
                href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                target="_blank"
                className="text-blue-400 text-sm underline hover:text-blue-300 break-all"
              >
                İşlemi Explorer'da Gör ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}