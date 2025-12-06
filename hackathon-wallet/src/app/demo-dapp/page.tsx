"use client";

import React, { useEffect, useState, useMemo } from "react";
import { EnokiFlow } from "@mysten/enoki";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import clsx from "clsx";
import { QRCodeSVG } from "qrcode.react";

// --- TİP TANIMLAMALARI ---

type Product = {
  id: string;
  name: string;
  price: number;
  desc: string;
};

type CartItem = { 
  id: string; 
  qty: number 
};

interface QrCodePaymentProps {
  totalMist: bigint;
  shopAddress: string;
}

// -------------------------

/** ===== CONFIG - burayı kendi değerlerinle güncelle ===== */
const ENOKI_API_KEY = "enoki_public_ce1bb4cc0289b93f071e03a024fd6a7b";
const CLIENT_ID = "pikhmq1ra3gfr4emzjjt56kzu0pd4v";
const PACKAGE_ID = "0x3f60ec52273d0ac7c0c98ad1dfe51c4e5d2f62e9713a97d4f1a2c55834c81cc4";
const MODULE_NAME = "payment";
const FUNCTION_NAME = "send_sui";
const SHOP_ADDRESS = "0x524b788d82f765ec0abdd0976d25af2bff2e8e7031e9bb5bef26ef06f3c0cf3f";
/** ====================================================== */

/** Product catalog (SUI prices in decimal) */
const PRODUCTS: Product[] = [
  { id: "americano", name: "Americano", price: 0.05, desc: "Sıcak, sade ve güçlü." },
  { id: "latte", name: "Latte", price: 0.08, desc: "Sütlü, yumuşak." },
  { id: "ice-americano", name: "Ice Americano", price: 0.06, desc: "Soğuk, ferahlatıcı." },
  { id: "ice-latte", name: "Ice Latte", price: 0.09, desc: "Buzlu ve kremsi." },
  { id: "chai-latte", name: "Chai Latte", price: 0.085, desc: "Baharatlı sütlü çay." },
  { id: "flat-white", name: "Flat White", price: 0.075, desc: "Yoğun espresso + ince süt." },
];


// --- QR KOD BİLEŞENİ ---
const QrCodePayment: React.FC<QrCodePaymentProps> = ({ totalMist, shopAddress }) => {
    const paymentUrl = useMemo(() => {
        const encodedMist = totalMist.toString();
        return `sui:transfer?recipient=${shopAddress}&amount=${encodedMist}`;
    }, [totalMist, shopAddress]);

    if (totalMist <= BigInt(0)) return null;

    return (
        <div className="mt-4 p-4 border border-cyan-700 rounded-lg bg-gray-900 text-center animate-pulse-slow">
            <h4 className="text-sm font-bold text-pink-500 mb-3">SCAN & PAY</h4>
            
            <div className="flex justify-center bg-white p-2 rounded-lg inline-block">
                <QRCodeSVG 
                    value={paymentUrl} 
                    size={150} 
                    level="H"
                    includeMargin={true}
                />
            </div>

            <p className="text-xs text-gray-500 mt-3">
                Cüzdanınızla bu kodu tarayın. Tutar: {(Number(totalMist) / 1e9).toFixed(3)} SUI
            </p>
            <p className="text-xs text-gray-600 break-all mt-1">
                 {shopAddress.slice(0, 10)}...{shopAddress.slice(-8)}
            </p>
        </div>
    );
};
// --- QR KOD BİLEŞENİ SONU ---


export default function Page() {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [purchaseCount, setPurchaseCount] = useState<number>(0);
  const [showNftCongrats, setShowNftCongrats] = useState(false);
  
  // YENİ STATE: Cüzdan görünürlüğü (Default: false/gizli)
  const [isWalletVisible, setIsWalletVisible] = useState(false);

  const enoki = new EnokiFlow({ apiKey: ENOKI_API_KEY });
  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  const purchasesKey = (addr: string | null) => `sui_coffee_purchases_${addr ?? "anon"}`;

  useEffect(() => {
    (async () => {
      try {
        if (window.location.hash.includes("id_token")) {
          try { await enoki.handleAuthCallback(); } catch {}
          window.history.replaceState(null, "", window.location.pathname);
        }

        const signer = await enoki.getKeypair({ network: "testnet" });
        if (!signer) return;
        const addr = signer.toSuiAddress();
        setUserAddress(addr);

        const stored = localStorage.getItem(purchasesKey(addr));
        setPurchaseCount(stored ? Number(stored) : 0);

        try {
          const coins = await client.getCoins({ owner: addr });
          const total = coins.data.reduce((acc, c) => acc + Number(c.balance), 0);
          setBalance((total / 1e9).toFixed(3) + " SUI");
        } catch (e) {
          setBalance(null);
        }
      } catch {
        // not logged in / ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cart helpers
  const addToCart = (prodId: string) => {
    setCart((prev) => {
      const found = prev.find((p) => p.id === prodId);
      if (found) return prev.map((p) => (p.id === prodId ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { id: prodId, qty: 1 }];
    });
  };

  const removeFromCart = (prodId: string) => setCart((prev) => prev.filter((p) => p.id !== prodId));

  const changeQty = (prodId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(prodId); return; }
    setCart((prev) => prev.map((p) => (p.id === prodId ? { ...p, qty } : p)));
  };

  const cartTotalSui = () =>
    cart.reduce((sum, item) => {
      const prod = PRODUCTS.find((p) => p.id === item.id);
      if (!prod) return sum;
      return sum + prod.price * item.qty;
    }, 0);

  // Login/Logout
  const handleLogin = async () => {
    const redirectUrl = window.location.origin;
    const authUrl = await enoki.createAuthorizationURL({
      provider: "twitch",
      clientId: CLIENT_ID,
      redirectUrl,
      network: "testnet",
    });
    window.location.href = authUrl;
  };

  const handleLogout = async () => {
    try { enoki.logout(); } catch {}
    if (userAddress) localStorage.removeItem(purchasesKey(userAddress));
    setUserAddress(null);
    setBalance(null);
    setCart([]);
    setPurchaseCount(0);
    setIsWalletVisible(false); // Çıkış yapınca görünümü sıfırla
  };

  // Enoki/UniPass ile ödeme akışı
  const checkoutEnoki = async () => {
    if (!userAddress) { setStatusMsg("Önce UniPass ile bağlanın."); return; }
    if (cart.length === 0) { setStatusMsg("Sepet boş."); return; }

    setLoading(true);
    setStatusMsg(null);

    try {
      const signer = await enoki.getKeypair({ network: "testnet" });
      if (!signer) throw new Error("Cüzdan alınamadı.");

      const totalSui = cartTotalSui();
      const totalMist = BigInt(Math.floor(totalSui * 1_000_000_000));

      if (totalMist <= BigInt(0)) throw new Error("Toplam 0 olamaz.");

      const tx = new Transaction();

      // moveCall ile ödeme
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [
          tx.gas, 
          tx.pure.address(SHOP_ADDRESS),
          tx.pure.u64(totalMist),
        ],
      });

      const result = await client.signAndExecuteTransaction({
        signer,
        transaction: tx,
        options: { showEffects: true },
      });

      // success logic
      setStatusMsg("Ödeme başarılı! Teşekkürler ☕️");
      const bought = cart.reduce((s, it) => s + it.qty, 0);
      setCart([]);

      const prev = Number(localStorage.getItem(purchasesKey(userAddress)) ?? 0);
      const now = prev + bought;
      if (userAddress) localStorage.setItem(purchasesKey(userAddress), String(now));
      setPurchaseCount(now);

      if (now >= 15) setShowNftCongrats(true);

      if ((result as any)?.digest) {
        setStatusMsg((prevMsg) => `${prevMsg} (tx: ${(result as any).digest})`);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg("Ödeme başarısız: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  };

  // MIST cinsinden toplam tutar
  const totalSui = cartTotalSui();
  const totalMist = BigInt(Math.floor(totalSui * 1_000_000_000));
  const remainingForNft = Math.max(0, 15 - purchaseCount);


  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 font-mono text-cyan-400">
      <div className="w-full max-w-5xl grid lg:grid-cols-3 gap-8">
        {/* LEFT: Branding + campaign */}
        <div className="col-span-1 bg-gray-800 rounded-2xl p-6 shadow-xl shadow-cyan-900/50 border border-cyan-700/50">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold text-pink-500 neon-text-pink">Sui Coffee // CYBER Edition</h1>
            <p className="text-sm text-gray-400">Buy coffee with SUI — pocket friendly & speedy</p>
          </div>

          {/* Campaign Section */}
          <div className="mb-5 p-4 rounded-lg bg-gray-900 border border-green-500 neon-glow-green">
            <h3 className="font-bold text-green-400">SYSTEM // PROMO ACTIVE</h3>
            <p className="text-sm text-gray-300 mt-2">
              15 kahve içene <span className="font-semibold text-pink-500">Cart Curt</span> NFT hediye!
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Progress: <span className="font-medium text-cyan-400">{purchaseCount}</span> / 15
            </p>
            <div className="w-full bg-gray-700 h-2 rounded mt-3 overflow-hidden">
              <div
                className="h-2 bg-pink-500 neon-glow-pink"
                style={{ width: `${Math.min(100, (purchaseCount / 15) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {remainingForNft > 0
                ? `[STATUS]: ${remainingForNft} units until NFT mint.`
                : "[STATUS]: CLAIM READY. Awaiting ADMIN mint."}
            </p>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold text-cyan-400">// WALLET INTERFACE</h4>
                {/* GİZLE / GÖSTER TOGGLE BUTONU */}
                {userAddress && (
                    <button 
                        onClick={() => setIsWalletVisible(!isWalletVisible)}
                        className="text-[10px] uppercase border border-cyan-700 px-2 py-0.5 rounded text-cyan-200 hover:bg-cyan-900 hover:text-white transition"
                    >
                        {isWalletVisible ? "[HIDE DATA]" : "[REVEAL]"}
                    </button>
                )}
            </div>

            {userAddress ? (
              <>
                {/* Cüzdan Adresi - Sansürlü/Açık */}
                <div 
                    onClick={() => setIsWalletVisible(!isWalletVisible)}
                    className={clsx(
                        "text-xs font-mono break-all bg-gray-900 p-2 rounded border border-cyan-500/50 cursor-pointer transition-all",
                        !isWalletVisible ? "text-gray-500" : "text-cyan-300"
                    )}
                >
                    {isWalletVisible 
                        ? userAddress 
                        : `${userAddress.slice(0, 6)}...******...${userAddress.slice(-4)}`
                    }
                </div>

                {/* Bakiye - Blur/Açık */}
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>Balance:</span>
                    <span className={clsx(
                        "font-bold transition-all",
                        isWalletVisible ? "text-white" : "text-gray-600 blur-[3px]"
                    )}>
                        {balance ?? "Loading..."}
                    </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="mt-3 w-full text-xs py-2 rounded bg-red-700/50 text-red-400 border border-red-400 hover:bg-red-700 neon-glow-red"
                >
                  [LOGOUT]
                </button>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="mt-2 w-full bg-cyan-600 text-black py-3 rounded-lg font-bold border border-cyan-400 hover:bg-cyan-700 neon-glow-cyan"
              >
                // CONNECT: UniPass
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500 pt-4 border-t border-gray-700">
            <p className="mb-1">Protocol: <span className="font-medium">Sui Coffee</span></p>
            <p className="mb-1">Network Status: <span className="text-green-400">ONLINE</span></p>
            <p className="mb-1">Admin: {SHOP_ADDRESS.slice(0, 8)}...</p>
          </div>
        </div>

        {/* CENTER: Product grid */}
        <div className="col-span-1 lg:col-span-1 bg-gray-800 rounded-2xl p-6 shadow-xl shadow-cyan-900/50 border border-cyan-700/50 overflow-auto">
          <h2 className="text-lg font-bold mb-4 text-cyan-400">// MENU SCAN</h2>
          <div className="grid grid-cols-1 gap-4">
            {PRODUCTS.map((p) => {
              const inCart = cart.find((c) => c.id === p.id);
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:border-pink-500 transition duration-150">
                  <div>
                    <div className="text-sm font-semibold text-white">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.desc}</div>
                    <div className="text-xs text-green-400 font-medium mt-1">{p.price} SUI</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-cyan-700 rounded">
                      <button
                        onClick={() => changeQty(p.id, Math.max(0, (inCart?.qty ?? 0) - 1))}
                        className="px-3 py-1 text-sm text-red-400"
                      >
                        −
                      </button>
                      <div className="px-4 text-sm text-white">{inCart?.qty ?? 0}</div>
                      <button
                        onClick={() => addToCart(p.id)}
                        className="px-3 py-1 text-sm border-l border-cyan-700 bg-gray-900 text-green-400 hover:text-green-500"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => addToCart(p.id)}
                      className="ml-2 text-xs bg-pink-600 text-white px-3 py-2 rounded border border-pink-500 hover:bg-pink-700 neon-glow-pink"
                    >
                      ADD TO CART
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Cart + Checkout */}
        <div className="col-span-1 bg-gray-800 rounded-2xl p-6 shadow-xl shadow-cyan-900/50 border border-cyan-700/50">
          <h3 className="text-lg font-bold mb-4 text-cyan-400">// CART INTERFACE</h3>

          {cart.length === 0 ? (
            <div className="text-sm text-gray-500">Cart is empty. Please select item(s) to proceed.</div>
          ) : (
            <div className="space-y-3 mb-4">
              {cart.map((it) => {
                const prod = PRODUCTS.find((p) => p.id === it.id);
                if (!prod) return null;
                return (
                  <div key={it.id} className="flex items-center justify-between border-b border-gray-700 pb-2">
                    <div>
                      <div className="text-sm font-medium text-white">{prod.name} × {it.qty}</div>
                      <div className="text-xs text-gray-500">Price: <span className="text-green-400">{(prod.price * it.qty).toFixed(3)} SUI</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(it.id, it.qty - 1)} className="text-xs px-2 py-1 border border-red-400 rounded text-red-400 hover:bg-red-900 transition">−</button>
                      <button onClick={() => changeQty(it.id, it.qty + 1)} className="text-xs px-2 py-1 border border-green-400 rounded text-green-400 hover:bg-green-900 transition">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 border-t border-cyan-700 pt-4">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm text-gray-500">// TOTAL COST</div>
              <div className="font-bold text-2xl text-pink-500 neon-text-pink">{totalSui.toFixed(3)} SUI</div>
            </div>

            {/* UniPass/Enoki ile Ödeme Butonu */}
            {userAddress && (
                <button
                onClick={checkoutEnoki}
                disabled={loading || cart.length === 0}
                className={clsx(
                    "w-full py-3 rounded-lg text-black font-bold transition neon-glow-cyan mb-3",
                    loading ? "bg-gray-600 cursor-not-allowed text-gray-400" : "bg-cyan-400 hover:bg-cyan-500 border border-cyan-300"
                )}
                >
                {loading ? "[PROCESSING... STAND BY]" : "PAY WITH SUI (UniPass/Enoki)"}
                </button>
            )}
            
            {/* QR KOD ALANI - OTOMATİK GÖSTERİM (Gerçek QR) */}
            {cart.length > 0 && (
                 <QrCodePayment totalMist={totalMist} shopAddress={SHOP_ADDRESS} />
            )}

            {statusMsg && <p className="text-xs mt-3 text-center text-gray-400">{statusMsg}</p>}
          </div>
        </div>
      </div>

      {/* NFT Modal */}
      {showNftCongrats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl shadow-pink-900/70 border border-pink-500">
            <h2 className="text-xl font-bold mb-2 text-pink-500 neon-text-pink">TRANSACTION COMPLETE. 🎉</h2>
            <p className="text-sm text-gray-300 mb-4">
              15 units purchased. <span className="font-semibold text-green-400">Cart Curt</span> NFT access granted.
            </p>
            <p className="text-xs text-gray-500 mb-4">(Admin will manually mint the NFT to your address.)</p>
            <button
              onClick={() => setShowNftCongrats(false)}
              className="mt-2 bg-green-600 text-black py-2 px-6 rounded-lg font-bold border border-green-400 hover:bg-green-700 neon-glow-green"
            >
              [CLOSE WINDOW]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}