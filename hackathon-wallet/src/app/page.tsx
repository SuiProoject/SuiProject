"use client";

import { useEffect, useState } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

// --- BURALARI DOLDUR ---
const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b"; // <-- Enoki Portal'dan aldığın Key
const CLIENT_ID = "pikhmq1ra3gfr4emzjjt56kzu0pd4v"; // <-- Twitch veya Google Client ID'si

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("Yükleniyor...");

  // Enoki kurulumu
  const enokiFlow = new EnokiFlow({ apiKey: ENOKI_API_KEY });

  // 1. Giriş Butonuna Basılınca
  const handleLogin = async () => {
    // Mevcut sayfa adresi (http://localhost:3000)
    const redirectUrl = window.location.origin;

    const authUrl = await enokiFlow.createAuthorizationURL({
      provider: "twitch", // Eğer Google ID aldıysan buraya "google" yaz
      clientId: CLIENT_ID,
      redirectUrl: redirectUrl,
      network: "testnet",
    });

    window.location.href = authUrl;
  };

  // 2. Sayfa Açılınca (Girişten dönüldü mü kontrolü)
  useEffect(() => {
    async function checkLogin() {
      // URL'de "id_token" var mı?
      if (window.location.hash.includes("id_token")) {
        try {
          // Girişi tamamla
          await enokiFlow.handleAuthCallback();
          
          // Kullanıcının cüzdan adresini al
          const keypair = await enokiFlow.getKeypair({ network: "testnet" });
          const userAddr = keypair.toSuiAddress();
          setAddress(userAddr);
          
          // URL'yi temizle
          window.history.replaceState(null, "", window.location.pathname);

          // Bakiyeyi sorgula
          const client = new SuiClient({ url: getFullnodeUrl("testnet") });
          const coins = await client.getCoins({ owner: userAddr });
          
          // Basit bakiye hesabı (MIST -> SUI)
          const totalMist = coins.data.reduce((acc, coin) => acc + parseInt(coin.balance), 0);
          setBalance((totalMist / 1_000_000_000).toFixed(2) + " SUI");

        } catch (e) {
          console.error("Giriş hatası:", e);
        }
      }
    }
    
    checkLogin();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8">Sui zkLogin Hackathon</h1>

      {!address ? (
        // --- GİRİŞ EKRANI ---
        <button
          onClick={handleLogin}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition"
        >
          Twitch ile Giriş Yap
        </button>
      ) : (
        // --- GİRİŞ YAPILDI EKRANI ---
        <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center">
          <h2 className="text-2xl text-green-400 mb-4">✅ Giriş Başarılı!</h2>
          
          <div className="mb-4">
            <p className="text-gray-400 text-sm">Cüzdan Adresin:</p>
            <p className="font-mono text-yellow-300 break-all">{address}</p>
          </div>

          <div className="mb-6">
            <p className="text-gray-400 text-sm">Bakiye:</p>
            <p className="text-3xl font-bold">{balance}</p>
          </div>

          <a 
            href={`https://suiscan.xyz/testnet/account/${address}`}
            target="_blank"
            className="text-blue-400 underline hover:text-blue-300"
          >
            Explorer'da Gör
          </a>
        </div>
      )}
    </div>
  );
}