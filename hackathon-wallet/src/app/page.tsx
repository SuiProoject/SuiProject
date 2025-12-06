"use client";

import { useEffect, useState } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

// --- AYARLAR ---
const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b";
const CLIENT_ID = "pikhmq1ra3gfr4emzjjt56kzu0pd4v"; 

// 🔴 BURAYA KENDİ PACKAGE ID'Nİ YAPIŞTIR (Deploy sonrası terminalde çıkan ID)
const PACKAGE_ID = "0x3f60ec52273d0ac7c0c98ad1dfe51c4e5d2f62e9713a97d4f1a2c55834c81cc4"; 
const MODULE_NAME = "payment"; // Move dosyasındaki modül adı
const FUNCTION_NAME = "send_sui"; // Fonksiyon adı

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("Yükleniyor...");
  const [loading, setLoading] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  
  // Yeni State'ler
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>(""); // Kullanıcının gireceği miktar

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
  // 🔥 MOVE KONTRAKTI ÇAĞIRAN FONKSİYON
  // -------------------------------------------------------------------
  const sendSuiViaContract = async () => {
    if (!address) return alert("Bağlı hesap yok!");
    if (!amount || isNaN(Number(amount))) return alert("Geçerli bir miktar girin!");

    setLoading(true);
    setTxDigest(null);

    try {
      const client = new SuiClient({ url: getFullnodeUrl("testnet") });
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });

      const tx = new Transaction();

      // 1. MIST Dönüşümü: Kullanıcı "1" girerse bu 1 SUI'dir (1 milyar MIST)
      // Ondalık sayıları (0.5 gibi) desteklemek için matematik işlemi yapıyoruz.
      const amountInMist = BigInt(Math.floor(Number(amount) * 1_000_000_000));

      // 2. Move Call (Kontrat Çağrısı)
      // Fonksiyon imzan: send_sui(payment_coin: &mut Coin<SUI>, recipient: address, amount: u64)
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [
          tx.gas,                 // Senin cüzdanındaki Gas coini (payment_coin olarak geçer)
          tx.pure.address(recipient), // Alıcı adresi
          tx.pure.u64(amountInMist),  // Gönderilecek miktar
        ],
      });

      // 3. İmzala ve Gönder
      const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
      });

      setTxDigest(result.digest);
      alert("✅ Kontrat üzerinden transfer başarılı!");
    } catch (err) {
      console.error("Gönderim hatası:", err);
      alert("❌ İşlem başarısız! Console'u kontrol et.");
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
        Sui Move Contract Demo
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

          {/* --- INPUT ALANLARI --- */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs text-gray-400 ml-1">Alıcı Adresi</label>
              <input
                type="text"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded-lg text-sm border border-gray-600 focus:border-blue-500 outline-none"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-400 ml-1">Miktar (SUI)</label>
              <input
                type="number"
                placeholder="Örn: 0.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded-lg text-sm border border-gray-600 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <button
            disabled={loading || recipient.length < 10 || !amount}
            onClick={sendSuiViaContract}
            className={`w-full py-4 rounded-xl font-bold text-lg transition ${
              loading
                ? "bg-gray-700 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "İşleniyor..." : "🚀 Kontrat ile Gönder"}
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