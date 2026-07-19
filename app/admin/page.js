"use client";

import { useEffect, useRef, useState } from "react";

const nextStatus = { ASSIGNED: "OUT_FOR_DELIVERY", OUT_FOR_DELIVERY: "DELIVERED" };
const nextStatusLabel = { ASSIGNED: "Mark Out for Delivery", OUT_FOR_DELIVERY: "Mark Delivered" };
const catNames = { nashta: "नाश्ता", bhojan: "भोजन", nonveg: "नॉन-वेज" };

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("orders");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("jimlo_admin_key") : null;
    if (saved) {
      setKey(saved);
      testKey(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function testKey(k) {
    try {
      const res = await fetch("/api/orders", { headers: { "x-admin-key": k } });
      if (res.ok) {
        setAuthed(true);
        setAuthError("");
        localStorage.setItem("jimlo_admin_key", k);
      } else {
        setAuthError("गलत पासवर्ड · Wrong password");
      }
    } catch (e) {
      setAuthError("Network error");
    }
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto min-h-screen flex flex-col justify-center px-6">
        <h1 className="font-display font-extrabold text-2xl mb-1">Zimlo Admin</h1>
        <p className="text-sm text-[#8a8378] mb-5">व्यवस्थापक पासवर्ड डालें · Enter admin password</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && testKey(key)}
          className="border-[1.5px] border-[#E7E0D2] rounded-2xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-orange"
          placeholder="Password"
          autoFocus
        />
        {authError && <p className="text-sm text-red-600 mb-3">{authError}</p>}
        <button
          onClick={() => testKey(key)}
          className="text-white rounded-2xl py-3.5 font-bold font-display"
          style={{ background: "linear-gradient(135deg, #FF7A1A, #E85D04)" }}
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-extrabold text-2xl">Zimlo Admin</h1>
        <button
          onClick={() => {
            localStorage.removeItem("jimlo_admin_key");
            setAuthed(false);
            setKey("");
          }}
          className="text-xs font-semibold text-[#948c7e] border border-[#E7E0D2] rounded-xl px-3 py-1.5"
        >
          Log out
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {[
          ["orders", "📋 Orders"],
          ["menu", "🍽️ Menu"],
          ["settings", "⚙️ Settings"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm font-bold border ${
              tab === k ? "bg-charcoal text-white border-charcoal" : "bg-white border-[#E7E0D2] text-[#8a8378]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "orders" && <OrdersTab adminKey={key} />}
      {tab === "menu" && <MenuTab adminKey={key} />}
      {tab === "settings" && <SettingsTab adminKey={key} />}
    </div>
  );
}

/* ========================================================================= */

function OrdersTab({ adminKey }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("NEW");
  const pollRef = useRef(null);

  async function load() {
    try {
      const res = await fetch("/api/orders", { headers: { "x-admin-key": adminKey } });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch (e) {
      /* ignore transient errors */
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 8000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateOrder(id, patch) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
    else alert("Update failed — try logging in again.");
  }

  const buckets = {
    NEW: orders.filter((o) => o.status === "REQUESTED"),
    PAYMENT: orders.filter((o) => o.status === "CONFIRMED" && !o.paymentReceived),
    ACTIVE: orders.filter(
      (o) => (o.status === "CONFIRMED" && o.paymentReceived) || ["ASSIGNED", "OUT_FOR_DELIVERY"].includes(o.status)
    ),
    DELIVERED: orders.filter((o) => o.status === "DELIVERED"),
  };
  const filtered = filter === "ALL" ? orders : buckets[filter] || [];

  return (
    <>
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          ["NEW", `New (${buckets.NEW.length})`],
          ["PAYMENT", `Awaiting Payment (${buckets.PAYMENT.length})`],
          ["ACTIVE", `Active (${buckets.ACTIVE.length})`],
          ["DELIVERED", `Delivered (${buckets.DELIVERED.length})`],
          ["ALL", `All (${orders.length})`],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              filter === k ? "bg-charcoal text-white border-charcoal" : "bg-white border-[#E7E0D2] text-[#8a8378]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="text-sm text-[#948c7e]">No orders in this view.</p>}

      <div className="flex flex-col gap-3">
        {filtered.map((o) => (
          <OrderCard key={o.id} order={o} onUpdate={(patch) => updateOrder(o.id, patch)} />
        ))}
      </div>
    </>
  );
}

function OrderCard({ order, onUpdate }) {
  const [price, setPrice] = useState(order.itemPrice ?? "");
  const [delivery, setDelivery] = useState(order.deliveryCharge ?? 0);
  const [partner, setPartner] = useState(order.deliveryPartner ?? "");

  let extra = null;
  try {
    extra = order.extraData ? JSON.parse(order.extraData) : null;
  } catch (e) {
    extra = null;
  }

  return (
    <div className="bg-white rounded-2xl border border-[#F0EAE0] p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-bold text-sm flex items-center gap-1.5">
            {order.category === "food" ? "🍽️ Food" : "💬 Custom"}
            <span className="text-[#a89f8d] font-normal">#JML{order.id}</span>
          </div>
          <div className="text-[11.5px] text-[#948c7e] mt-0.5">
            {order.customerName} · {order.customerPhone} · {new Date(order.createdAt).toLocaleString("en-IN")}
          </div>
        </div>
        <StatusPill status={order.status} paymentReceived={order.paymentReceived} />
      </div>

      <div className="text-[13px] bg-[#FBF7EF] rounded-xl p-3 mb-3">
        {extra && Array.isArray(extra) ? (
          <ul className="list-disc pl-4">
            {extra.map((l, i) => (
              <li key={i}>
                {l.qty}x {l.name} — ₹{l.price} each
              </li>
            ))}
          </ul>
        ) : (
          order.requestText
        )}
      </div>

      {order.status === "REQUESTED" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Item price ₹"
              className="flex-1 border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
              placeholder="Delivery ₹"
              className="flex-1 border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!price) return alert("Set the item price first");
                onUpdate({ status: "CONFIRMED", itemPrice: Number(price), deliveryCharge: Number(delivery) || 0 });
              }}
              className="flex-1 bg-jimlogreen text-white rounded-xl py-2.5 text-sm font-bold"
            >
              ✅ Accept
            </button>
            <button
              onClick={() => {
                const r = prompt("Reason for rejecting (shown to customer):", "Currently unavailable");
                if (r === null) return;
                onUpdate({ status: "REJECTED", rejectionReason: r });
              }}
              className="flex-1 bg-[#C0392B] text-white rounded-xl py-2.5 text-sm font-bold"
            >
              ❌ Reject
            </button>
          </div>
        </div>
      )}

      {order.status === "CONFIRMED" && !order.paymentReceived && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold">
            कुल राशि: ₹{order.totalPrice}{" "}
            {order.paymentClaimed ? (
              <span className="text-orangedeep">— customer ने भुगतान की पुष्टि की है ✅</span>
            ) : (
              <span className="text-[#948c7e]">— customer का payment अभी claim नहीं हुआ</span>
            )}
          </div>
          <button
            onClick={() => onUpdate({ paymentReceived: true })}
            className="bg-jimlogreen text-white rounded-xl py-2.5 text-sm font-bold"
          >
            💰 Payment Verified — मुझे पैसा मिल गया
          </button>
        </div>
      )}

      {order.status === "CONFIRMED" && order.paymentReceived && (
        <div className="flex flex-col gap-2">
          <input
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            placeholder="Delivery partner name"
            className="border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              if (!partner.trim()) return alert("Enter delivery partner name");
              onUpdate({ status: "ASSIGNED", deliveryPartner: partner.trim() });
            }}
            className="bg-charcoal text-white rounded-xl py-2.5 text-sm font-bold"
          >
            Assign & Mark Assigned
          </button>
        </div>
      )}

      {["ASSIGNED", "OUT_FOR_DELIVERY"].includes(order.status) && (
        <button
          onClick={() => onUpdate({ status: nextStatus[order.status] })}
          className="w-full bg-charcoal text-white rounded-xl py-2.5 text-sm font-bold"
        >
          {nextStatusLabel[order.status]}
        </button>
      )}

      {order.status === "DELIVERED" && (
        <div className="text-xs font-semibold text-[#948c7e]">
          Total ₹{order.totalPrice} · {order.deliveryPartner}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, paymentReceived }) {
  const label = status === "CONFIRMED" && !paymentReceived ? "AWAITING PAYMENT" : status.replace("_", " ");
  const colors = {
    REQUESTED: "bg-[#FFF1DC] text-orangedeep",
    "AWAITING PAYMENT": "bg-[#FFE9CC] text-[#B15E00]",
    CONFIRMED: "bg-[#DCEBFF] text-[#2563A8]",
    ASSIGNED: "bg-[#EAE0FF] text-[#6C3FBE]",
    "OUT FOR DELIVERY": "bg-[#FFE7D1] text-orangedeep",
    DELIVERED: "bg-[#E1F3E5] text-jimlogreen",
    REJECTED: "bg-[#FBE1E1] text-[#C0392B]",
    CANCELLED: "bg-[#EEE7D8] text-[#948c7e]",
  };
  return <div className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${colors[label] || ""}`}>{label}</div>;
}

/* ========================================================================= */

function MenuTab({ adminKey }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ category: "nashta", name: "", price: "", unit: "plate" });

  async function load() {
    // admin needs to see unavailable items too, but our public GET only returns
    // available ones — fetch via the same endpoint, it's fine for now since we
    // don't hide items from admin in this simple version
    const res = await fetch("/api/menu");
    const data = await res.json();
    setItems(data.items || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function addItem() {
    if (!newItem.name.trim() || !newItem.price) return alert("नाम और price दोनों भरें");
    const res = await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(newItem),
    });
    if (res.ok) {
      setNewItem({ category: newItem.category, name: "", price: "", unit: "plate" });
      load();
    } else {
      alert("Add failed");
    }
  }

  async function updateItem(id, patch) {
    const res = await fetch(`/api/menu/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
  }

  async function deleteItem(id) {
    if (!confirm("यह item हटा दें?")) return;
    const res = await fetch(`/api/menu/${id}`, { method: "DELETE", headers: { "x-admin-key": adminKey } });
    if (res.ok) load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-[#F0EAE0] p-4">
        <div className="font-bold text-sm mb-3">+ नया Item जोड़ें</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            className="border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2 text-sm"
          >
            <option value="nashta">नाश्ता</option>
            <option value="bhojan">भोजन</option>
            <option value="nonveg">नॉन-वेज</option>
          </select>
          <select
            value={newItem.unit}
            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
            className="border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2 text-sm"
          >
            <option value="plate">Plate</option>
            <option value="piece">Piece / नग</option>
          </select>
        </div>
        <div className="grid grid-cols-[1fr_100px] gap-2 mb-3">
          <input
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            placeholder="Item का नाम"
            className="border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            placeholder="₹ Price"
            className="border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <button onClick={addItem} className="w-full bg-orange text-white rounded-xl py-2.5 text-sm font-bold">
          + Add Item
        </button>
      </div>

      {["nashta", "bhojan", "nonveg"].map((cat) => (
        <div key={cat}>
          <div className="font-display font-bold text-lg mb-2">{catNames[cat]}</div>
          <div className="flex flex-col gap-2">
            {items
              .filter((i) => i.category === cat)
              .map((item) => (
                <MenuItemRow key={item.id} item={item} onUpdate={(p) => updateItem(item.id, p)} onDelete={() => deleteItem(item.id)} />
              ))}
            {items.filter((i) => i.category === cat).length === 0 && (
              <p className="text-xs text-[#948c7e]">कोई item नहीं है</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuItemRow({ item, onUpdate, onDelete }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [unit, setUnit] = useState(item.unit);
  const dirty = name !== item.name || Number(price) !== item.price || unit !== item.unit;

  return (
    <div className="bg-white rounded-xl border border-[#F0EAE0] p-3 flex items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 border border-[#E7E0D2] rounded-lg px-2 py-1.5 text-sm" />
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-20 border border-[#E7E0D2] rounded-lg px-2 py-1.5 text-sm"
      />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border border-[#E7E0D2] rounded-lg px-2 py-1.5 text-xs">
        <option value="plate">Plate</option>
        <option value="piece">नग</option>
      </select>
      {dirty && (
        <button
          onClick={() => onUpdate({ name, price: Number(price), unit })}
          className="bg-jimlogreen text-white rounded-lg px-2.5 py-1.5 text-xs font-bold"
        >
          Save
        </button>
      )}
      <button onClick={onDelete} className="text-[#C0392B] text-xs font-bold px-2">
        ✕
      </button>
    </div>
  );
}

/* ========================================================================= */

function SettingsTab({ adminKey }) {
  const [settings, setSettings] = useState({ upiId: "", brandName: "", contactPhone: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => d.settings && setSettings(d.settings));
  }, []);

  async function save() {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert("Save failed");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#F0EAE0] p-5 max-w-md flex flex-col gap-4">
      <div>
        <label className="block font-semibold text-sm mb-1.5">UPI ID (payment यहाँ आएगा)</label>
        <input
          value={settings.upiId}
          onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
          className="w-full border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2.5 text-sm"
          placeholder="yourname@upi"
        />
      </div>
      <div>
        <label className="block font-semibold text-sm mb-1.5">Brand Name</label>
        <input
          value={settings.brandName}
          onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
          className="w-full border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="block font-semibold text-sm mb-1.5">Contact / WhatsApp नंबर (customer को दिखेगा)</label>
        <input
          value={settings.contactPhone}
          onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
          className="w-full border-[1.5px] border-[#E7E0D2] rounded-xl px-3 py-2.5 text-sm"
          placeholder="98XXXXXXXX"
        />
      </div>
      <button onClick={save} className="bg-charcoal text-white rounded-xl py-3 text-sm font-bold">
        {saved ? "✅ Saved" : "Save Settings"}
      </button>
    </div>
  );
}
