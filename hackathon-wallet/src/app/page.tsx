"use client";

import { useEffect, useState } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b";
const CLIENT_ID = "pikhmq1ra3gfr4emzjjt56kzu0pd4v"; // Twitch client ID

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("Yükleniyor...");
  const [loading, setLoading] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string>("");

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

  // -------------------------------------------------------------------
  // 🔥 TEMEL GÖNDERİM FONKSİYONU (recipient parametreli)
  // -------------------------------------------------------------------
  const sendTo = async (to: string) => {
    if (!address) return alert("Bağlı hesap yok!");

    setLoading(true);
    setTxDigest(null);

    try {
      const client = new SuiClient({ url: getFullnodeUrl("testnet") });
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });

      const tx = new Transaction();
      const amount = 10_000_000; // 0.01 SUI

      const [coin] = tx.splitCoins(tx.gas, [amount]);
      tx.transferObjects([coin], to); // 🔥 İŞLEMİN KALBİ

      const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
      });

      setTxDigest(result.digest);
      alert("İşlem tamam!");
    } catch (err) {
      console.error("Gönderim hatası:", err);
      alert("Gönderim başarısız!");
    }

    setLoading(false);
  };

  // -------------------------------------------------------------------
  // 🔥 SAYFA YÜKLENİNCE — LOGIN + BAKİYE GETİRME
  // -------------------------------------------------------------------
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
        const total = coins.data.reduce(
          (acc, c) => acc + Number(c.balance),
          0
        );

        setBalance((total / 1e9).toFixed(3) + " SUI");
      } catch (e) {
        console.log("Giriş yok.");
      }
    })();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans">
      <h1 className="text-4xl font-bold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
        Sui zkLogin + Transfer Demo
      </h1>

      {/* --- GİRİŞ YOKSA --- */}
      {!address && (
        <button
          onClick={handleLogin}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-xl transition shadow-lg transform hover:scale-105"
        >
          Twitch ile Giriş Yap
        </button>
      )}

      {/* --- GİRİŞ VARSA --- */}
      {address && (
        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl max-w-md w-full">
          <div className="flex justify-between items-center mb-6">
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">
              CONNECTED
            </span>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Çıkış
            </button>
          </div>

          <p className="text-gray-400 text-sm mb-1">Cüzdan Adresin</p>
          <p className="font-mono text-yellow-300 break-all bg-gray-900 p-2 rounded text-xs mb-5">
            {address}
          </p>

          <p className="text-gray-400 text-sm mb-1">Bakiye</p>
          <p className="text-4xl font-bold mb-8">{balance}</p>

        
          {/* --- BAŞKASINA GÖNDERME INPUTU --- */}
          <input
            type="text"
            placeholder="Alıcı adresi..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full mb-4 p-3 bg-gray-700 rounded-lg text-sm"
          />

          <button
            disabled={loading || recipient.length < 10}
            onClick={() => sendTo(recipient)}
            className={`w-full py-4 rounded-xl font-bold text-lg transition ${
              loading
                ? "bg-gray-700 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Gönderiliyor..." : "📤 Başkasına 0.01 SUI Gönder"}
          </button>

          {txDigest && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-green-400 text-sm font-bold mb-2">
                ✓ İşlem Başarılı!
              </p>
              <a
                href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                target="_blank"
                className="text-blue-400 underline text-sm break-all"
              >
                Explorer'da görüntüle ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
