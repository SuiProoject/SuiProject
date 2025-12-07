"use client";

import React, { useEffect, useState } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import QRCode from "react-qr-code";

// CONFIG TO DO: .env
const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b";
const CLIENT_ID =     "pikhmq1ra3gfr4emzjjt56kzu0pd4v";
const PACKAGE_ID =    "0x3f60ec52273d0ac7c0c98ad1dfe51c4e5d2f62e9713a97d4f1a2c55834c81cc4";
const MODULE_NAME =   "payment";
const FUNCTION_NAME = "send_sui";
const SHOP_ADDRESS =  "0x524b788d82f765ec0abdd0976d25af2bff2e8e7031e9bb5bef26ef06f3c0cf3f";

const enoki = new EnokiFlow({ apiKey: ENOKI_API_KEY });
const client = new SuiClient({ url: getFullnodeUrl("testnet") });

const PRODUCTS = [
  { id: "americano", name: "Americano", price: 0.05, desc: "Sıcak espresso" },
  { id: "latte", name: "Latte", price: 0.08, desc: "Sütlü kahve" },
  { id: "ice-americano", name: "Ice Americano", price: 0.06, desc: "Buzlu espresso" },
  { id: "ice-latte", name: "Ice Latte", price: 0.09, desc: "Buzlu sütlü" },
  { id: "chai-latte", name: "Chai Latte", price: 0.085, desc: "Baharatlı çay" },
  { id: "flat-white", name: "Flat White", price: 0.075, desc: "Yoğun kahve" },
];

export default function Page() {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [cart, setCart] = useState<Array<{id: string; qty: number}>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [purchaseCount, setPurchaseCount] = useState<number>(0);
  const [showNft, setShowNft] = useState<boolean>(false);
  const [walletVisible, setWalletVisible] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrCopied, setQrCopied] = useState<boolean>(false);

  const storageKey = (addr: string | null) => `sui_coffee_${addr ?? "anon"}`;

  useEffect(() => {
    (async () => {
      try {
        // Twitch callback'i işle
        if (window.location.hash.includes("id_token")) {
          try { 
            await enoki.handleAuthCallback(); 
            window.history.replaceState(null, "", window.location.pathname);
            window.location.reload();
            return;
          } catch (err) {
            console.error("Auth callback error:", err);
          }
        }

        // Cüzdan bilgisini al
        const signer = await enoki.getKeypair({ network: "testnet" });
        if (!signer) return;
        
        const addr = signer.toSuiAddress();
        setUserAddress(addr);

        // Satın alma sayısını localStorage'dan yükle
        const stored = localStorage.getItem(storageKey(addr));
        setPurchaseCount(stored ? Number(stored) : 0);

        // Bakiye sorgula
        try {
          const coins = await client.getCoins({ owner: addr });
          const total = coins.data.reduce((acc, c) => acc + Number(c.balance), 0);
          setBalance((total / 1e9).toFixed(3) + " SUI");
        } catch {}
      } catch {}
    })();
  }, []);

  const addToCart = (id: string) => {
    setCart((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) return prev.map((p) => (p.id === id ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { id, qty: 1 }];
    });
  };

  const changeQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    setCart((prev) => prev.map((p) => (p.id === id ? { ...p, qty } : p)));
  };

  const cartTotal = () =>
    cart.reduce((sum, item) => {
      const prod = PRODUCTS.find((p) => p.id === item.id);
      return sum + (prod ? prod.price * item.qty : 0);
    }, 0);

  const handleLogin = async () => {
    const redirectUrl = window.location.origin + window.location.pathname;
    const authUrl = await enoki.createAuthorizationURL({
      provider: "twitch",
      clientId: CLIENT_ID,
      redirectUrl,
      network: "testnet",
    });
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    try { enoki.logout(); } catch {}
    if (userAddress) localStorage.removeItem(storageKey(userAddress));
    setUserAddress(null);
    setBalance(null);
    setCart([]);
    setPurchaseCount(0);
    setWalletVisible(false);
  };

  const checkout = async () => {
    if (!userAddress) {
      setStatusMsg("Önce giriş yapın");
      return;
    }
    if (cart.length === 0) {
      setStatusMsg("Sepet boş");
      return;
    }

    const totalSui = cartTotal();
    const currentBalance = balance ? parseFloat(balance.replace(" SUI", "")) : 0;
    
    if (currentBalance < totalSui) {
      setStatusMsg(`❌ Yetersiz bakiye! Bakiyeniz: ${currentBalance.toFixed(3)} SUI`);
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      const signer = await enoki.getKeypair({ network: "testnet" });
      if (!signer) throw new Error("Cüzdan alınamadı");

      const totalMist = BigInt(Math.floor(totalSui * 1_000_000_000));

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [tx.gas, tx.pure.address(SHOP_ADDRESS), tx.pure.u64(totalMist)],
      });

      await client.signAndExecuteTransaction({
        signer,
        transaction: tx,
        options: { showEffects: true },
      });

      setStatusMsg("✅ Ödeme başarılı!");
      const bought = cart.reduce((s, it) => s + it.qty, 0);
      setCart([]);

      const prev = Number(localStorage.getItem(storageKey(userAddress)) ?? 0);
      const now = prev + bought;
      localStorage.setItem(storageKey(userAddress), String(now));
      setPurchaseCount(now);

      if (now >= 15) setShowNft(true);
    } catch (err: any) {
      setStatusMsg("❌ Ödeme başarısız: " + (err?.message ?? ""));
    } finally {
      setLoading(false);
    }
  };

  const copyQrAddress = () => {
    navigator.clipboard.writeText(SHOP_ADDRESS);
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
  };

  const totalSui = cartTotal();
  const remaining = Math.max(0, 15 - purchaseCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 mb-2">
            ☕ Sui Coffee Shop
          </h1>
          <p className="text-gray-400">Pay with SUI • Fast & Secure</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT: Wallet & Campaign */}
          <div className="bg-gray-800/80 backdrop-blur rounded-2xl p-6 border border-gray-700">
            <h3 className="text-cyan-400 font-bold mb-4">🎯 Kampanya</h3>
            <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-lg p-4 mb-4 border border-pink-500/30">
              <p className="text-sm text-gray-200">15 kahve = <span className="font-bold text-pink-400">NFT Hediye!</span></p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>İlerleme</span>
                  <span>{purchaseCount}/15</span>
                </div>
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-cyan-400 to-pink-500 transition-all"
                    style={{ width: `${Math.min(100, (purchaseCount / 15) * 100)}%` }}
                  />
                </div>
              </div>
              {remaining > 0 ? (
                <p className="text-xs text-gray-400 mt-2">{remaining} kahve daha!</p>
              ) : (
                <p className="text-xs text-green-400 mt-2">✅ NFT kazandınız!</p>
              )}
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-cyan-400 font-bold text-sm">💼 Cüzdan</h4>
                {userAddress && (
                  <button
                    onClick={() => setWalletVisible(!walletVisible)}
                    className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300 hover:bg-gray-600"
                  >
                    {walletVisible ? "Gizle" : "Göster"}
                  </button>
                )}
              </div>

              {userAddress ? (
                <>
                  <div className="bg-gray-900 p-3 rounded">
                    <div 
                      onClick={() => setWalletVisible(!walletVisible)}
                      className="text-xs font-mono cursor-pointer break-all mb-2"
                    >
                      {walletVisible ? (
                        <span className="text-cyan-300">{userAddress}</span>
                      ) : (
                        <span className="text-gray-500">
                          {userAddress.slice(0, 8)}...{userAddress.slice(-8)}
                        </span>
                      )}
                    </div>
                    {walletVisible && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(userAddress);
                          setStatusMsg("Adres kopyalandı!");
                          setTimeout(() => setStatusMsg(null), 2000);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        📋 Kopyala
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-2 text-xs">
                    <span className="text-gray-400">Bakiye:</span>
                    <span className={walletVisible ? "text-white font-bold" : "text-gray-600 blur-sm"}>
                      {balance ?? "..."}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full mt-3 py-2 bg-red-600/50 text-red-200 rounded hover:bg-red-600 text-sm"
                  >
                    Çıkış Yap
                  </button>
                </>
              ) : (
                <button
                  onClick={handleLogin}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-bold hover:from-cyan-600 hover:to-blue-600"
                >
                  🔐 Twitch ile Giriş
                </button>
              )}
            </div>
          </div>

          {/* CENTER: Products */}
          <div className="bg-gray-800/80 backdrop-blur rounded-2xl p-6 border border-gray-700">
            <h3 className="text-cyan-400 font-bold mb-4">📋 Menü</h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {PRODUCTS.map((p) => {
                const inCart = cart.find((c) => c.id === p.id);
                return (
                  <div key={p.id} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 hover:border-cyan-500 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-white">{p.name}</h4>
                        <p className="text-xs text-gray-400">{p.desc}</p>
                      </div>
                      <span className="text-green-400 font-bold">{p.price} SUI</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 bg-gray-800 rounded px-2">
                        <button
                          onClick={() => changeQty(p.id, (inCart?.qty ?? 0) - 1)}
                          className="text-red-400 px-2 py-1"
                        >
                          −
                        </button>
                        <span className="text-white w-8 text-center">{inCart?.qty ?? 0}</span>
                        <button
                          onClick={() => addToCart(p.id)}
                          className="text-green-400 px-2 py-1"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => addToCart(p.id)}
                        className="px-4 py-1 bg-pink-600 text-white rounded hover:bg-pink-700 text-sm"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Cart & Checkout */}
          <div className="bg-gray-800/80 backdrop-blur rounded-2xl p-6 border border-gray-700">
            <h3 className="text-cyan-400 font-bold mb-4">🛒 Sepet</h3>

            {cart.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Sepet boş</p>
            ) : (
              <div className="space-y-2 mb-4">
                {cart.map((it) => {
                  const prod = PRODUCTS.find((p) => p.id === it.id);
                  if (!prod) return null;
                  return (
                    <div key={it.id} className="flex justify-between items-center bg-gray-900/50 p-2 rounded">
                      <div>
                        <p className="text-white text-sm">{prod.name} × {it.qty}</p>
                        <p className="text-xs text-green-400">{(prod.price * it.qty).toFixed(3)} SUI</p>
                      </div>
                      <button
                        onClick={() => changeQty(it.id, 0)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-gray-700 pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400">Toplam</span>
                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">
                  {totalSui.toFixed(3)} SUI
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {userAddress && cart.length > 0 && (
                  <button
                    onClick={checkout}
                    disabled={loading}
                    className="col-span-2 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-bold hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50"
                  >
                    {loading ? "İşleniyor..." : "💳 Ödeme Yap"}
                  </button>
                )}
                
                {cart.length > 0 && (
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="col-span-2 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold border border-gray-600"
                  >
                    📱 QR ile Öde
                  </button>
                )}
              </div>

              {statusMsg && (
                <p className="text-sm text-center mt-3 text-gray-300">{statusMsg}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR MODAL - Slush Wallet Compatible */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white text-gray-900 rounded-2xl p-8 max-w-sm w-full relative shadow-2xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-center mb-2">QR ile Öde</h2>
            <p className="text-gray-500 text-center text-sm mb-6">
              Slush, Suiet veya Surf Wallet ile QR'u tarayın
            </p>

            <div className="flex justify-center mb-6 bg-white p-4 rounded-xl border-2 border-gray-100">
              <QRCode
                value={`${SHOP_ADDRESS}:${Math.floor(totalSui * 1_000_000_000)}`}
                size={200}
                level="M"
              />
            </div>

            <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 p-4 rounded-lg mb-4 border border-pink-500/30">
              <p className="text-center text-lg font-bold text-gray-900">
                {totalSui.toFixed(3)} SUI
              </p>
              <p className="text-center text-xs text-gray-500 mt-1">Ödenecek Tutar</p>
            </div>

            <div className="bg-gray-100 p-3 rounded-lg mb-4">
              <p className="text-xs text-gray-500 mb-1 text-center">Alıcı Adres</p>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-gray-700 truncate flex-1">{SHOP_ADDRESS}</p>
                <button
                  onClick={copyQrAddress}
                  className="ml-2 text-blue-600 font-bold text-xs uppercase hover:text-blue-800"
                >
                  {qrCopied ? "✓" : "Kopyala"}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800 text-center">
                💡 QR kod alıcı adresi ve tutarı içerir. Cüzdanınız desteklemiyorsa tutarı manuel girin.
              </p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* NFT Modal */}
      {showNft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-purple-900 rounded-2xl p-8 max-w-md border-2 border-pink-500 shadow-2xl">
            <h2 className="text-2xl font-bold text-pink-400 mb-3 text-center">🎉 TEBRİKLER!</h2>
            <p className="text-gray-200 text-center mb-4">
              15 kahve aldınız! <span className="font-bold text-green-400">Cart Curt NFT</span> kazandınız.
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">
              NFT adresinize gönderilecek.
            </p>
            <button
              onClick={() => setShowNft(false)}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-600"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}