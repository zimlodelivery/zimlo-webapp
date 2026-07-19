"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const categoryLabels = {
  nashta: "नाश्ता · Nashta",
  bhojan: "भोजन · Bhojan",
  nonveg: "नॉन-वेज · Non-Veg",
};
const categoryEmoji = { nashta: "🍵", bhojan: "🍛", nonveg: "🍗" };

const steps = [
  { key: "CONFIRMED", title: "Payment Pending", sub: "QR स्कैन करके भुगतान करें" },
  { key: "PAID", title: "Payment Verified", sub: "आपका भुगतान मिल गया" },
  { key: "ASSIGNED", title: "Delivery Assigned", sub: "Partner पिकअप के लिए निकल गया" },
  { key: "OUT_FOR_DELIVERY", title: "Out for Delivery", sub: "आपकी तरफ़ आ रहा है" },
  { key: "DELIVERED", title: "Delivered", sub: "आनंद लीजिए!" },
];

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [settings, setSettings] = useState({ brandName: "Zimlo", upiId: "", contactPhone: "" });
  const [menu, setMenu] = useState([]);
  const [activeCat, setActiveCat] = useState("nashta");
  const [cart, setCart] = useState({}); // { [menuItemId]: qty }

  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");

  const [customText, setCustomText] = useState("");
  const [confirmOrder, setConfirmOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    const n = localStorage.getItem("jimlo_name");
    const p = localStorage.getItem("jimlo_phone");
    if (n) setCustName(n);
    if (p) setCustPhone(p);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => d.settings && setSettings(d.settings))
      .catch(() => {});
    fetch("/api/menu")
      .then((r) => r.json())
      .then((d) => d.items && setMenu(d.items))
      .catch(() => {});
  }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function goHome() {
    setScreen("home");
  }

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menu.find((m) => m.id === Number(id));
        return item ? { ...item, qty } : null;
      })
      .filter(Boolean);
  }, [cart, menu]);

  const cartTotal = cartLines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);

  function setQty(id, qty) {
    setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));
  }

  // ---------------- submit food order ----------------
  async function submitFoodOrder() {
    if (cartLines.length === 0) return showToast("पहले कुछ items चुनें");
    if (!custName.trim() || !/^[0-9]{10}$/.test(custPhone.trim())) {
      return showToast("कृपया नाम और सही 10 अंक का मोबाइल नंबर भरें");
    }
    localStorage.setItem("jimlo_name", custName.trim());
    localStorage.setItem("jimlo_phone", custPhone.trim());

    const summary = cartLines.map((l) => `${l.qty}x ${l.name}`).join(", ");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "food",
          requestText: summary,
          extraData: cartLines.map((l) => ({ name: l.name, price: l.price, qty: l.qty })),
          itemPrice: cartTotal,
          customerName: custName.trim(),
          customerPhone: custPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "कुछ गलत हुआ, फिर कोशिश करें");
      setCart({});
      setConfirmOrder(data.order);
      setScreen("payment");
    } catch (e) {
      showToast("नेटवर्क समस्या — फिर कोशिश करें");
    }
  }

  // ---------------- submit custom order ----------------
  async function submitCustomOrder() {
    if (!customText.trim()) return showToast("कृपया अपनी ज़रूरत लिखें");
    if (!custName.trim() || !/^[0-9]{10}$/.test(custPhone.trim())) {
      return showToast("कृपया नाम और सही 10 अंक का मोबाइल नंबर भरें");
    }
    localStorage.setItem("jimlo_name", custName.trim());
    localStorage.setItem("jimlo_phone", custPhone.trim());

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "custom",
          requestText: customText.trim(),
          customerName: custName.trim(),
          customerPhone: custPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "कुछ गलत हुआ, फिर कोशिश करें");
      setCustomText("");
      setConfirmOrder(data.order);
      setScreen("payment");
    } catch (e) {
      showToast("नेटवर्क समस्या — फिर कोशिश करें");
    }
  }

  // ---------------- poll order status while on payment/status screen ----------------
  useEffect(() => {
    if (screen !== "payment" || !confirmOrder) return;
    if (["DELIVERED", "REJECTED", "CANCELLED"].includes(confirmOrder.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${confirmOrder.id}`);
        const data = await res.json();
        if (res.ok) setConfirmOrder(data.order);
      } catch (e) {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [screen, confirmOrder]);

  async function markPaid() {
    try {
      const res = await fetch(`/api/orders/${confirmOrder.id}/mark-paid`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setConfirmOrder(data.order);
        showToast("धन्यवाद! भुगतान की पुष्टि admin को भेज दी गई");
      }
    } catch (e) {
      showToast("नेटवर्क समस्या — फिर कोशिश करें");
    }
  }

  // ---------------- order history ----------------
  async function loadOrders() {
    if (!/^[0-9]{10}$/.test(custPhone.trim())) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/orders?phone=${custPhone.trim()}`);
      const data = await res.json();
      if (res.ok) setOrders(data.orders);
    } finally {
      setLoadingOrders(false);
    }
  }
  useEffect(() => {
    if (screen === "orders") loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  function trackOrder(o) {
    setConfirmOrder(o);
    setScreen("payment");
  }

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen relative flex flex-col bg-cream">
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-charcoal text-white px-5 py-2.5 rounded-2xl text-xs font-semibold max-w-[340px] text-center shadow-lg transition-transform duration-300 ${
          toast ? "translate-y-0" : "-translate-y-16"
        }`}
      >
        {toast}
      </div>

      <div className="flex-1 flex flex-col pb-24">
        {screen === "home" && (
          <HomeScreen
            brandName={settings.brandName}
            contactPhone={settings.contactPhone}
            openFood={() => setScreen("food-menu")}
            openCustom={() => setScreen("custom")}
            showToast={showToast}
          />
        )}

        {screen === "food-menu" && (
          <FoodMenuScreen
            menu={menu}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            cart={cart}
            setQty={setQty}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onBack={goHome}
            onViewCart={() => setScreen("cart")}
          />
        )}

        {screen === "cart" && (
          <CartScreen
            lines={cartLines}
            total={cartTotal}
            setQty={setQty}
            onBack={() => setScreen("food-menu")}
            custName={custName}
            setCustName={setCustName}
            custPhone={custPhone}
            setCustPhone={setCustPhone}
            onSubmit={submitFoodOrder}
          />
        )}

        {screen === "custom" && (
          <CustomScreen
            text={customText}
            setText={setCustomText}
            onBack={goHome}
            custName={custName}
            setCustName={setCustName}
            custPhone={custPhone}
            setCustPhone={setCustPhone}
            onSubmit={submitCustomOrder}
          />
        )}

        {screen === "payment" && confirmOrder && (
          <PaymentScreen order={confirmOrder} settings={settings} onBack={goHome} onMarkPaid={markPaid} />
        )}

        {screen === "orders" && (
          <OrdersScreen
            orders={orders}
            loading={loadingOrders}
            custPhone={custPhone}
            setCustPhone={setCustPhone}
            onLoad={loadOrders}
            onTrack={trackOrder}
          />
        )}

        {screen === "profile" && (
          <ProfileScreen
            custName={custName}
            setCustName={setCustName}
            custPhone={custPhone}
            setCustPhone={setCustPhone}
            showToast={showToast}
          />
        )}
      </div>

      <BottomNav screen={screen} setScreen={setScreen} goHome={goHome} />
    </div>
  );
}

/* ========================================================================= */

function BrandHeader({ brandName }) {
  return (
    <img src="/logo.png" alt="Zimlo" className="w-14 h-14 rounded-full object-cover shadow-lg" />
}

function HomeScreen({ brandName, contactPhone, openFood, openCustom, showToast }) {
  return (
    <>
      <BrandHeader brandName={brandName} />
      <div className="px-5 text-center mt-1 mb-6">
        <p className="text-[13px] text-[#6b6560] font-medium">भूख लगी? Zimlo.</p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-2">
        <button
          onClick={openFood}
          className="rounded-[28px] p-7 text-left shadow-lg active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg,#FFC93C,#FF7A1A)" }}
        >
          <div className="text-5xl mb-3">🍽️</div>
          <div className="font-display font-extrabold text-2xl text-white mb-1">खाना ऑर्डर करें</div>
          <div className="text-white/90 text-sm font-semibold">Food Menu — नाश्ता, भोजन, नॉन-वेज</div>
        </button>

        <button
          onClick={openCustom}
          className="rounded-[28px] p-7 text-left shadow-lg active:scale-[0.98] transition-transform bg-white border-2 border-[#F0EAE0]"
        >
          <div className="text-5xl mb-3">💬</div>
          <div className="font-display font-extrabold text-2xl text-charcoal mb-1">आपको क्या चाहिए?</div>
          <div className="text-[#8a8378] text-sm font-semibold">
            जो भी चाहिए यहाँ बताइए — हमारी टीम 2 मिनट में जवाब देगी
          </div>
        </button>
      </div>

      {contactPhone && (
        <button
          onClick={() => showToast(`कॉल करें: ${contactPhone}`)}
          className="fixed bottom-24 right-4 z-20 bg-jimlogreen text-white rounded-3xl px-4 py-3 font-bold text-xs flex items-center gap-1.5 shadow-lg"
          style={{ maxWidth: 410, right: "max(16px, calc(50% - 197px))" }}
        >
          📞 {contactPhone}
        </button>
      )}
    </>
  );
}

function BackHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 px-[18px] pt-4 pb-1">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-base">
        ←
      </button>
      <div className="font-display font-bold text-[19px]">{title}</div>
    </div>
  );
}

function FoodMenuScreen({ menu, activeCat, setActiveCat, cart, setQty, cartCount, cartTotal, onBack, onViewCart }) {
  const cats = ["nashta", "bhojan", "nonveg"];
  const items = menu.filter((m) => m.category === activeCat);

  return (
    <>
      <BackHeader title="🍽️ Food Menu" onBack={onBack} />
      <div className="flex gap-2 px-[18px] pt-2 pb-3 overflow-x-auto">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            className={`flex-none px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap ${
              activeCat === c ? "bg-charcoal text-white" : "bg-white border border-[#E7E0D2] text-[#8a8378]"
            }`}
          >
            {categoryEmoji[c]} {categoryLabels[c]}
          </button>
        ))}
      </div>

      <div className="px-[18px] flex flex-col gap-3">
        {items.length === 0 && <p className="text-sm text-[#948c7e] text-center py-10">इस category में अभी कोई item नहीं है</p>}
        {items.map((item) => {
          const qty = cart[item.id] || 0;
          return (
            <div key={item.id} className="bg-white rounded-2xl p-3.5 border border-[#F0EAE0] flex items-center justify-between">
              <div>
                <div className="font-bold text-[15px]">{item.name}</div>
                <div className="text-[12.5px] text-[#8a8378] font-medium">
                  ₹{item.price} / {item.unit === "piece" ? "नग" : "plate"}
                </div>
              </div>
              {qty === 0 ? (
                <button
                  onClick={() => setQty(item.id, 1)}
                  className="bg-orange text-white rounded-xl px-4 py-2 font-bold text-sm"
                >
                  + Add
                </button>
              ) : (
                <div className="flex items-center gap-3 bg-[#FFF1DC] rounded-xl px-2 py-1.5">
                  <button onClick={() => setQty(item.id, qty - 1)} className="w-7 h-7 rounded-lg bg-white font-bold text-orangedeep">
                    −
                  </button>
                  <span className="font-bold text-sm w-4 text-center">{qty}</span>
                  <button onClick={() => setQty(item.id, qty + 1)} className="w-7 h-7 rounded-lg bg-white font-bold text-orangedeep">
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-center z-[15]">
          <div className="w-full px-[18px] pb-6 pt-3" style={{ maxWidth: 430 }}>
            <button
              onClick={onViewCart}
              className="w-full text-white rounded-[18px] py-4 font-bold font-display flex justify-between items-center px-6 shadow-lg"
              style={{ background: "linear-gradient(135deg, #FF7A1A, #E85D04)" }}
            >
              <span>{cartCount} items · ₹{cartTotal}</span>
              <span>Cart देखें →</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function CartScreen({ lines, total, setQty, onBack, custName, setCustName, custPhone, setCustPhone, onSubmit }) {
  return (
    <>
      <BackHeader title="🛒 आपका ऑर्डर" onBack={onBack} />
      <div className="px-[18px] flex flex-col gap-3">
        {lines.map((l) => (
          <div key={l.id} className="bg-white rounded-2xl p-3.5 border border-[#F0EAE0] flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px]">{l.name}</div>
              <div className="text-[12.5px] text-[#8a8378]">₹{l.price} × {l.qty}</div>
            </div>
            <div className="flex items-center gap-3 bg-[#FFF1DC] rounded-xl px-2 py-1.5">
              <button onClick={() => setQty(l.id, l.qty - 1)} className="w-7 h-7 rounded-lg bg-white font-bold text-orangedeep">
                −
              </button>
              <span className="font-bold text-sm w-4 text-center">{l.qty}</span>
              <button onClick={() => setQty(l.id, l.qty + 1)} className="w-7 h-7 rounded-lg bg-white font-bold text-orangedeep">
                +
              </button>
            </div>
          </div>
        ))}

        <div className="bg-charcoal text-white rounded-2xl p-4 flex justify-between items-center font-bold">
          <span>Total</span>
          <span className="text-lg">₹{total}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-1">
          <div>
            <label className="block font-semibold text-[13px] mb-1.5">आपका नाम</label>
            <input
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="Name"
              className="w-full border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-orange"
            />
          </div>
          <div>
            <label className="block font-semibold text-[13px] mb-1.5">मोबाइल नंबर</label>
            <input
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit number"
              className="w-full border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-orange"
            />
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 flex justify-center z-[15]">
        <div className="w-full px-[18px] pb-6 pt-3" style={{ maxWidth: 430, background: "linear-gradient(to top, #FFF8ED 65%, transparent)" }}>
          <button
            onClick={onSubmit}
            className="w-full text-white rounded-[18px] py-4 text-base font-bold font-display shadow-lg"
            style={{ background: "linear-gradient(135deg, #FF7A1A, #E85D04)" }}
          >
            भुगतान करें · Pay ₹{total}
          </button>
        </div>
      </div>
    </>
  );
}

function CustomScreen({ text, setText, onBack, custName, setCustName, custPhone, setCustPhone, onSubmit }) {
  return (
    <>
      <BackHeader title="💬 आपको क्या चाहिए?" onBack={onBack} />
      <div className="px-[18px] pt-2 flex flex-col gap-4">
        <div className="bg-[#FFF1DC] rounded-2xl p-4 text-[13px] text-orangedeep font-medium">
          आपको जो भी चाहिए, यहाँ लिख दीजिए — हमारी टीम जल्द ही price बताकर जवाब देगी।
        </div>
        <div>
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="जैसे: मुझे मोबाइल चार्जर चाहिए / birthday cake कल के लिए चाहिए"
            className="w-full border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-orange resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-[13px] mb-1.5">आपका नाम</label>
            <input
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              className="w-full border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-orange"
            />
          </div>
          <div>
            <label className="block font-semibold text-[13px] mb-1.5">मोबाइल नंबर</label>
            <input
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-orange"
            />
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 flex justify-center z-[15]">
        <div className="w-full px-[18px] pb-6 pt-3" style={{ maxWidth: 430, background: "linear-gradient(to top, #FFF8ED 65%, transparent)" }}>
          <button
            onClick={onSubmit}
            className="w-full text-white rounded-[18px] py-4 text-base font-bold font-display shadow-lg"
            style={{ background: "linear-gradient(135deg, #FF7A1A, #E85D04)" }}
          >
            भेजें · Send Request
          </button>
        </div>
      </div>
    </>
  );
}

function PaymentScreen({ order, settings, onBack, onMarkPaid }) {
  const isRejected = order.status === "REJECTED";
  const isCancelled = order.status === "CANCELLED";
  const waitingForPrice = order.category === "custom" && order.status === "REQUESTED";
  const needsPayment = order.status === "CONFIRMED" && !order.paymentReceived;
  const afterPayment = ["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status) || (order.status === "CONFIRMED" && order.paymentReceived);

  const amount = order.totalPrice || order.itemPrice || 0;
  const upiLink = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.brandName || "Zimlo")}&am=${amount}&cu=INR&tn=${encodeURIComponent("Order JML" + order.id)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiLink)}`;

  let stepIdx = 0;
  if (order.status === "CONFIRMED" && order.paymentReceived) stepIdx = 1;
  if (order.status === "ASSIGNED") stepIdx = 2;
  if (order.status === "OUT_FOR_DELIVERY") stepIdx = 3;
  if (order.status === "DELIVERED") stepIdx = 4;

  return (
    <>
      <BackHeader title="Order Status" onBack={onBack} />
      <div className="px-[22px] pt-4 text-center">
        <p className="text-[#786f60] text-[13px] mb-4">
          Order <span className="font-bold text-maroon">#JML{order.id}</span>
        </p>

        {isRejected && (
          <div className="bg-white rounded-2xl p-6 border border-[#F0EAE0]">
            <div className="text-4xl mb-3">❌</div>
            <h2 className="font-display font-bold text-lg mb-1">माफ़ करें, यह request स्वीकार नहीं हुई</h2>
            {order.rejectionReason && <p className="text-sm text-[#8a8378]">{order.rejectionReason}</p>}
          </div>
        )}

        {waitingForPrice && (
          <div className="bg-white rounded-2xl p-6 border border-[#F0EAE0]">
            <div className="text-4xl mb-3">⏳</div>
            <h2 className="font-display font-bold text-lg mb-1">आपकी request भेज दी गई</h2>
            <p className="text-sm text-[#8a8378]">हमारी टीम जल्द ही price के साथ जवाब देगी — यह पेज अपने आप update हो जाएगा।</p>
          </div>
        )}

        {needsPayment && (
          <div className="bg-white rounded-2xl p-5 border border-[#F0EAE0]">
            <div className="font-display font-bold text-lg mb-1">कुल राशि · ₹{amount}</div>
            <p className="text-[12.5px] text-[#8a8378] mb-4">नीचे QR स्कैन करके भुगतान करें</p>
            <img src={qrUrl} alt="Payment QR" className="mx-auto rounded-2xl border border-[#F0EAE0]" width={220} height={220} />
            <p className="text-[11.5px] text-[#948c7e] mt-3 mb-4">UPI ID: {settings.upiId}</p>
            {!order.paymentClaimed ? (
              <button
                onClick={onMarkPaid}
                className="w-full text-white rounded-2xl py-3.5 font-bold font-display"
                style={{ background: "linear-gradient(135deg, #FF7A1A, #E85D04)" }}
              >
                ✅ मैंने भुगतान कर दिया है
              </button>
            ) : (
              <div className="bg-[#FFF1DC] text-orangedeep rounded-2xl py-3.5 font-bold text-sm">
                भुगतान की पुष्टि भेज दी गई — Admin verify कर रहे हैं
              </div>
            )}
          </div>
        )}

        {afterPayment && (
          <div className="bg-white rounded-[18px] p-5 text-left border border-[#F0EAE0]">
            {steps.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s.key} className={`step-line relative flex gap-3 pb-[22px] last:pb-0 ${done ? "done" : ""}`}>
                  <div
                    className={`w-[26px] h-[26px] rounded-full flex-none flex items-center justify-center text-xs font-bold z-[1] ${
                      done ? "bg-jimlogreen text-white" : active ? "bg-orange text-white" : "bg-[#EEE7D8] text-[#a89f8d]"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <div className="pt-0.5">
                    <div className="font-bold text-[13.5px]">{s.title}</div>
                    <div className="text-[11.5px] text-[#948c7e] mt-0.5">{s.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function OrdersScreen({ orders, loading, custPhone, setCustPhone, onLoad, onTrack }) {
  return (
    <>
      <div className="px-[18px] pt-5 pb-1">
        <div className="font-display font-bold text-[19px] mb-3">Your Orders</div>
        <div className="flex gap-2 mb-4">
          <input
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit mobile number"
            className="flex-1 border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-orange"
          />
          <button onClick={onLoad} className="bg-charcoal text-white rounded-2xl px-4 font-bold text-sm">
            Show
          </button>
        </div>
      </div>
      <div className="px-[18px] flex flex-col gap-3">
        {loading && <p className="text-center text-sm text-[#948c7e]">Loading…</p>}
        {!loading && orders.length === 0 && (
          <div className="text-center py-14 text-[#a89f8d]">
            <div className="text-4xl mb-2.5">🍽️</div>
            अभी कोई ऑर्डर नहीं
          </div>
        )}
        {orders.map((o) => (
          <div key={o.id} className="bg-white rounded-2xl p-3.5 border border-[#F0EAE0] flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="font-bold text-sm">{o.category === "food" ? "🍽️ Food" : "💬 Custom"} #JML{o.id}</div>
              <StatusBadge status={o.status} />
            </div>
            <div className="text-[12.5px] text-[#7a7266]">
              {o.requestText.length > 70 ? o.requestText.slice(0, 70) + "…" : o.requestText}
            </div>
            <button onClick={() => onTrack(o)} className="border-[1.5px] border-[#E7E0D2] rounded-xl py-2 text-xs font-bold">
              Track
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const colors = {
    REQUESTED: "bg-[#FFF1DC] text-orangedeep",
    CONFIRMED: "bg-[#DCEBFF] text-[#2563A8]",
    ASSIGNED: "bg-[#EAE0FF] text-[#6C3FBE]",
    OUT_FOR_DELIVERY: "bg-[#FFE7D1] text-orangedeep",
    DELIVERED: "bg-[#E1F3E5] text-jimlogreen",
    REJECTED: "bg-[#FBE1E1] text-[#C0392B]",
    CANCELLED: "bg-[#EEE7D8] text-[#948c7e]",
  };
  return <div className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg ${colors[status] || ""}`}>{status.replace("_", " ")}</div>;
}

function ProfileScreen({ custName, setCustName, custPhone, setCustPhone, showToast }) {
  return (
    <div className="px-[18px] pt-5">
      <div className="font-display font-bold text-[19px] mb-4">Profile</div>
      <div className="bg-white rounded-2xl p-5 border border-[#F0EAE0] text-center mb-5">
        <div className="w-16 h-16 rounded-full mx-auto mb-2.5 flex items-center justify-center text-2xl text-white font-bold bg-gradient-to-br from-yellow to-orange">
          {custName ? custName[0].toUpperCase() : "👤"}
        </div>
        <div className="font-bold text-base">{custName || "अपना नाम भरें"}</div>
        <div className="text-[12.5px] text-[#948c7e] mt-0.5">{custPhone ? `+91 ${custPhone}` : "No phone saved yet"}</div>
      </div>
      <label className="block font-semibold text-[13px] mb-1.5">नाम · Name</label>
      <input
        value={custName}
        onChange={(e) => setCustName(e.target.value)}
        className="w-full border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white mb-3.5 focus:outline-none focus:border-orange"
      />
      <label className="block font-semibold text-[13px] mb-1.5">मोबाइल नंबर · Phone</label>
      <input
        value={custPhone}
        onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
        className="w-full border-[1.5px] border-[#E7E0D2] rounded-2xl px-3.5 py-3 text-sm bg-white mb-4 focus:outline-none focus:border-orange"
      />
      <button
        onClick={() => {
          localStorage.setItem("jimlo_name", custName.trim());
          localStorage.setItem("jimlo_phone", custPhone.trim());
          showToast("Saved ✅");
        }}
        className="w-full text-white rounded-[18px] py-3.5 font-bold font-display"
        style={{ background: "linear-gradient(135deg, #FF7A1A, #E85D04)" }}
      >
        Save
      </button>
    </div>
  );
}

function BottomNav({ screen, setScreen, goHome }) {
  const items = [
    { key: "home", icon: "🏠", label: "Home", action: goHome },
    { key: "orders", icon: "📋", label: "Orders", action: () => setScreen("orders") },
    { key: "profile", icon: "👤", label: "Profile", action: () => setScreen("profile") },
  ];
  const active = ["home", "food-menu", "cart", "custom", "payment"].includes(screen) ? "home" : screen;

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center z-[16]">
      <div className="w-full flex bg-white border-t border-[#EFE8DA] pt-2.5 pb-[calc(9px+env(safe-area-inset-bottom))]" style={{ maxWidth: 430 }}>
        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.action}
            className={`flex-1 flex flex-col items-center gap-0.5 text-[10.5px] font-semibold ${
              active === it.key ? "text-orangedeep" : "text-[#b1a893]"
            }`}
          >
            <span className="text-[19px]">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
