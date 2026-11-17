"use client";

import { useState } from "react";
import { translations, Language } from "./locales/translations";
import { supabase } from '../lib/supabase';
interface Room {
  id: string;
  number: string;
  tier: string;
  nameKey: "standardRoom" | "deluxeRoom" | "suiteRoom";
  descKey: "standardDesc" | "deluxeDesc" | "suiteDesc";
  priceETB: number;
  priceUSD: number;
  isAvailable: boolean;
  amenities: string[];
  accentGradient: string;
}

interface BookingRecord {
  id: string;
  reference: string;
  guestName: string;
  guestPhone: string;
  roomId: string;
  roomNumber: string;
  roomNameKey: "standardRoom" | "deluxeRoom" | "suiteRoom";
  nights: number;
  totalETB: number;
  paymentMethod: string;
  isPaid: boolean;
  createdAt: string;
}

const INITIAL_ROOMS: Room[] = [
  {
    id: "rm-101",
    number: "101",
    tier: "DELUXE WING",
    nameKey: "standardRoom",
    descKey: "standardDesc",
    priceETB: 4500,
    priceUSD: 38,
    isAvailable: true,
    amenities: ["King Bed", "Fiber Wi-Fi", "City View", "Rain Shower"],
    accentGradient: "from-amber-900/90 via-stone-900 to-stone-950",
  },
  {
    id: "rm-204",
    number: "204",
    tier: "EXECUTIVE FLOOR",
    nameKey: "deluxeRoom",
    descKey: "deluxeDesc",
    priceETB: 8200,
    priceUSD: 68,
    isAvailable: true,
    amenities: ["Private Lounge", "Buffet Breakfast", "Balcony", "Airport Shuttle"],
    accentGradient: "from-yellow-900/80 via-stone-900 to-stone-950",
  },
  {
    id: "rm-301",
    number: "301",
    tier: "ROYAL PENTHOUSE",
    nameKey: "suiteRoom",
    descKey: "suiteDesc",
    priceETB: 16500,
    priceUSD: 135,
    isAvailable: true,
    amenities: ["Panoramic View", "Jacuzzi Spa", "Private Dining", "24/7 Butler"],
    accentGradient: "from-amber-700/80 via-stone-900 to-stone-950",
  },
];

export default function SkylightHotelPlatform() {
  const [lang, setLang] = useState<Language>("en");
  const [activeTab, setActiveTab] = useState<"guest" | "admin">("guest");
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Booking Modal State
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Telebirr");
  const [nights, setNights] = useState(1);
  const [latestRef, setLatestRef] = useState<string | null>(null);

  // Transaction Verifier State
  const [txRef, setTxRef] = useState("");
  const [verificationResult, setVerificationResult] = useState<{
    type: "success" | "pending" | "error";
    message: string;
  } | null>(null);

  const t = translations[lang];

  // Create Booking
 const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !guestName.trim() || !guestPhone.trim()) return;

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const refCode = `HTL-${selectedRoom.number}-${randomCode}`;
    const totalETB = selectedRoom.priceETB * nights;

    const newBooking: BookingRecord = {
      id: `bk-${Date.now()}`,
      reference: refCode,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.number,
      roomNameKey: selectedRoom.nameKey,
      nights,
      totalETB,
      paymentMethod,
      isPaid: false,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Save booking permanently to Supabase cloud database
    const { error } = await supabase.from('bookings').insert([
      {
        reference: newBooking.reference,
        guest_name: newBooking.guestName,
        guest_phone: newBooking.guestPhone,
        room_number: newBooking.roomNumber,
        nights: newBooking.nights,
        total_etb: newBooking.totalETB,
        payment_method: newBooking.paymentMethod,
        is_paid: newBooking.isPaid,
      }
    ]);
if (error) {
      console.error("Error saving booking:", error.message);
      alert("Failed to save booking to database: " + error.message);
      return; // Stops here if Supabase fails so we don't fake a success
    }

    console.log("Booking successfully saved to cloud database!");

    setBookings((prev) => [newBooking, ...prev]);
    setRooms((prev) =>
      prev.map((rm) =>
        rm.id === selectedRoom.id ? { ...rm, isAvailable: false } : rm
      )
    );

    setLatestRef(refCode);
    setTxRef(refCode);
    setSelectedRoom(null);
    setGuestName("");
    setGuestPhone("");
    setNights(1);
  };

  // Verify Transaction against active bookings or bank format
  const handleVerifyTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = txRef.trim().toUpperCase();
    if (!cleaned) return;

    const matched = bookings.find((b) => b.reference === cleaned);

    if (matched) {
      // Automatically mark booking as verified paid when verified
      setBookings((prev) =>
        prev.map((b) => (b.id === matched.id ? { ...b, isPaid: true } : b))
      );
      setVerificationResult({
        type: "success",
        message: `VERIFIED • Guest: ${matched.guestName} | Suite ${matched.roomNumber} | ${matched.totalETB.toLocaleString()} ETB (${matched.paymentMethod}) — Confirmed & Cleared.`,
      });
    } else if (cleaned.startsWith("FT") || cleaned.startsWith("TX") || cleaned.length >= 8) {
      setVerificationResult({
        type: "pending",
        message: `BANK REF LOGGED • Reference ${cleaned} queued for CBE / Telebirr settlement matching.`,
      });
    } else {
      setVerificationResult({
        type: "error",
        message: `UNRECOGNIZED FORMAT • Please enter a valid Booking Reference (HTL-XXX-XXXX) or Bank Transaction ID.`,
      });
    }
  };

  // Admin: Approve Payment
  const handleApprovePayment = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, isPaid: true } : b))
    );
  };

  // Admin: Check Out Guest (releases room back to available)
  const handleCheckOut = (booking: BookingRecord) => {
    setRooms((prev) =>
      prev.map((rm) =>
        rm.id === booking.roomId ? { ...rm, isAvailable: true } : rm
      )
    );
    setBookings((prev) => prev.filter((b) => b.id !== booking.id));
  };

  const totalConfirmedRevenue = bookings
    .filter((b) => b.isPaid)
    .reduce((sum, b) => sum + b.totalETB, 0);

  const occupiedCount = rooms.filter((r) => !r.isAvailable).length;
  const availableCount = rooms.filter((r) => r.isAvailable).length;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917] flex flex-col justify-between selection:bg-[#C5A059] selection:text-white">
      {/* Top Luxury Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E7E0D5] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          {/* Hotel Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C1917] border border-[#C5A059] flex items-center justify-center text-[#C5A059] font-serif text-xl font-bold shadow-sm">
              D
            </div>
            <div>
              <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-wide text-[#1C1917]">
                DAWIT <span className="text-[#B0893E]">HOTEL</span>
              </h1>
              <p className="text-[10px] tracking-[0.2em] text-stone-500 uppercase font-medium">
                {t.brandSub}
              </p>
            </div>
          </div>

          {/* Portal Switcher + Language Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#F3EFEA] p-1 rounded-full border border-[#E2D9CC] flex items-center">
              <button
                onClick={() => setActiveTab("guest")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeTab === "guest"
                    ? "bg-[#1C1917] text-[#E6C785] shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {t.guestView}
              </button>
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === "admin"
                    ? "bg-[#1C1917] text-[#E6C785] shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {t.staffView}
                {bookings.length > 0 && (
                  <span className="bg-[#C5A059] text-stone-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {bookings.length}
                  </span>
                )}
              </button>
            </div>

            <select
              aria-label={t.selectLang}
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="bg-white text-[#1C1917] text-xs font-semibold border border-[#D8CEC0] rounded-full px-3.5 py-2 focus:outline-none focus:border-[#B0893E] shadow-2xs cursor-pointer"
            >
              <option value="en">EN • English</option>
              <option value="am">AM • አማርኛ</option>
              <option value="ti">TI • ትግርኛ</option>
              <option value="om">OM • Afaan Oromo</option>
              <option value="fr">FR • Français</option>
            </select>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      {activeTab === "guest" ? (
        <main className="flex-1">
          {/* Skylight Signature Hero Banner */}
          <section className="relative bg-[#1C1917] text-white overflow-hidden border-b-4 border-[#C5A059]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(197,160,89,0.22),_transparent_60%)]" />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 relative z-10 text-center">
              <span className="inline-block text-[11px] font-bold tracking-[0.25em] text-[#E6C785] uppercase border border-[#C5A059]/40 bg-[#C5A059]/10 px-4 py-1.5 rounded-full mb-5">
                ★★★★★ {t.heroTag}
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white max-w-3xl mx-auto leading-tight mb-5">
                {t.title}
              </h2>
              <p className="text-stone-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
                {t.subtitle}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="#suites"
                  className="bg-[#C5A059] hover:bg-[#B0893E] text-[#1C1917] font-bold text-sm px-7 py-3.5 rounded-full transition shadow-lg"
                >
                  {t.bookNow}
                </a>
                <a
                  href="#verify"
                  className="bg-white/10 hover:bg-white/15 text-white border border-white/25 font-semibold text-sm px-7 py-3.5 rounded-full transition"
                >
                  {t.verifyQuick}
                </a>
              </div>
            </div>
          </section>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            {/* Booking Confirmation Toast Banner */}
            {latestRef && (
              <div className="mb-10 p-5 bg-emerald-950 text-white rounded-2xl border border-[#C5A059] shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm">
                  <span className="text-[#E6C785] font-bold uppercase tracking-wider text-xs block mb-1">
                    ✓ RESERVATION REGISTERED
                  </span>
                  {t.bookingSuccess}{" "}
                  <span className="font-mono font-bold text-lg text-[#E6C785] bg-black/40 px-3 py-0.5 rounded-lg ml-1">
                    {latestRef}
                  </span>
                </div>
                <button
                  onClick={() => setLatestRef(null)}
                  className="text-xs text-stone-300 hover:text-white px-3 py-1 rounded-lg border border-white/20"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Curated Suites Grid */}
            <section id="suites" className="mb-16">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1917] mb-2">
                  {t.roomsHeading}
                </h3>
                <div className="w-16 h-0.5 bg-[#C5A059] mx-auto mb-3" />
                <p className="text-sm text-stone-600">{t.roomsSub}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white rounded-2xl border border-[#E7E0D5] overflow-hidden shadow-sm hover:shadow-xl transition flex flex-col justify-between group"
                  >
                    {/* Top Architectural Card Header */}
                    <div>
                      <div
                        className={`h-36 bg-gradient-to-br ${room.accentGradient} p-5 flex flex-col justify-between relative`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold tracking-[0.2em] text-[#E6C785] uppercase">
                            {room.tier}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                              room.isAvailable
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-400/30"
                            }`}
                          >
                            {room.isAvailable ? t.available : t.occupied}
                          </span>
                        </div>

                        <div className="flex items-end justify-between">
                          <span className="font-serif text-3xl font-bold text-white/90">
                            Suite {room.number}
                          </span>
                          <span className="text-xs text-stone-300">
                            ${room.priceUSD} USD
                          </span>
                        </div>
                      </div>

                      {/* Suite Details */}
                      <div className="p-6">
                        <h4 className="font-serif text-xl font-bold text-[#1C1917] mb-2">
                          {t[room.nameKey]}
                        </h4>
                        <p className="text-sm text-stone-600 leading-relaxed mb-5">
                          {t[room.descKey]}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {room.amenities.map((item) => (
                            <span
                              key={item}
                              className="text-[11px] font-medium bg-[#F6F2EC] text-stone-700 px-2.5 py-1 rounded-md border border-[#E7E0D5]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Pricing & CTA */}
                    <div className="px-6 pb-6 pt-3 border-t border-[#F0EAE1] flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xl font-extrabold text-[#1C1917]">
                          {room.priceETB.toLocaleString()} ETB
                        </span>
                        <span className="text-xs text-stone-500 block">
                          {t.perNight}
                        </span>
                      </div>

                      <button
                        disabled={!room.isAvailable}
                        onClick={() => setSelectedRoom(room)}
                        className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide uppercase transition ${
                          room.isAvailable
                            ? "bg-[#1C1917] hover:bg-[#B0893E] text-[#E6C785] hover:text-white shadow-sm cursor-pointer"
                            : "bg-stone-200 text-stone-400 cursor-not-allowed"
                        }`}
                      >
                        {room.isAvailable ? t.selectRoom : t.occupied}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Luxury Transaction Verification Desk */}
            <section
              id="verify"
              className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E2D9CC] p-6 sm:p-8 shadow-md"
            >
              <div className="text-center mb-6">
                <span className="text-[11px] font-bold tracking-[0.2em] text-[#B0893E] uppercase">
                  CBE • TELEBIRR • CHAPA • SWIFT
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1C1917] mt-1">
                  {t.verifyTitle}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  {t.verifySub}
                </p>
              </div>

              <form onSubmit={handleVerifyTransaction} className="space-y-4">
                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder={t.placeholderTx}
                  className="w-full bg-[#FAF8F5] border border-[#D8CEC0] rounded-xl px-4 py-3.5 text-sm font-mono text-[#1C1917] focus:outline-none focus:border-[#B0893E]"
                />
                <button
                  type="submit"
                  className="w-full bg-[#1C1917] hover:bg-[#2E2925] text-[#E6C785] font-bold text-sm py-3.5 rounded-xl transition shadow-sm cursor-pointer"
                >
                  {t.verifyBtn}
                </button>
              </form>

              {verificationResult && (
                <div
                  className={`mt-5 p-4 rounded-xl text-xs sm:text-sm font-medium border ${
                    verificationResult.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : verificationResult.type === "pending"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-rose-50 text-rose-900 border-rose-300"
                  }`}
                >
                  {verificationResult.message}
                </div>
              )}
            </section>
          </div>
        </main>
      ) : (
        /* RECEPTIONIST / ADMIN OPERATIONS PORTAL */
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10">
          <div className="mb-8">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#B0893E] uppercase">
              HOTEL OPERATIONS DASHBOARD
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1917]">
              {t.adminTitle}
            </h2>
            <p className="text-sm text-stone-600">{t.adminSub}</p>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-[#E7E0D5] shadow-2xs">
              <span className="text-xs font-semibold text-stone-500 uppercase">
                {t.totalRevenue}
              </span>
              <p className="text-2xl font-extrabold text-[#1C1917] mt-1">
                {totalConfirmedRevenue.toLocaleString()} ETB
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#E7E0D5] shadow-2xs">
              <span className="text-xs font-semibold text-stone-500 uppercase">
                {t.activeGuests}
              </span>
              <p className="text-2xl font-extrabold text-[#B0893E] mt-1">
                {occupiedCount} / {rooms.length}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#E7E0D5] shadow-2xs">
              <span className="text-xs font-semibold text-stone-500 uppercase">
                {t.availableRoomsCount}
              </span>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                {availableCount}
              </p>
            </div>
          </div>

          {/* Guest Ledger Table */}
          <div className="bg-white rounded-2xl border border-[#E7E0D5] shadow-sm overflow-hidden">
            {bookings.length === 0 ? (
              <div className="p-12 text-center text-sm text-stone-500">
                {t.noBookings}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F6F2EC] border-b border-[#E7E0D5] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                      <th className="py-3.5 px-4">{t.guestCol}</th>
                      <th className="py-3.5 px-4">{t.roomCol}</th>
                      <th className="py-3.5 px-4">{t.refCol}</th>
                      <th className="py-3.5 px-4">{t.amountCol}</th>
                      <th className="py-3.5 px-4">{t.statusCol}</th>
                      <th className="py-3.5 px-4 text-right">{t.actionCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EAE1] text-sm">
                    {bookings.map((bk) => (
                      <tr key={bk.id} className="hover:bg-[#FAF8F5]">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#1C1917]">{bk.guestName}</div>
                          <div className="text-xs text-stone-500">{bk.guestPhone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold">Suite {bk.roomNumber}</span>
                          <span className="text-xs text-stone-500 block">
                            {bk.nights} night(s) • {bk.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#B0893E]">
                          {bk.reference}
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          {bk.totalETB.toLocaleString()} ETB
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              bk.isPaid
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {bk.isPaid ? t.paidStatus : t.pendingStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {!bk.isPaid && (
                            <button
                              onClick={() => handleApprovePayment(bk.id)}
                              className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              {t.approvePay}
                            </button>
                          )}
                          <button
                            onClick={() => handleCheckOut(bk)}
                            className="text-xs font-bold bg-stone-800 hover:bg-stone-950 text-[#E6C785] px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            {t.checkOut}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Luxury Reservation Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#D8CEC0] rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#B0893E] uppercase">
              {selectedRoom.tier} • SUITE {selectedRoom.number}
            </span>
            <h3 className="font-serif text-2xl font-bold text-[#1C1917] mt-1 mb-5">
              {t.modalTitle}
            </h3>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  {t.guestName}
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D8CEC0] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#B0893E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  {t.guestPhone}
                </label>
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D8CEC0] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#B0893E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    {t.nights}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={nights}
                    onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#FAF8F5] border border-[#D8CEC0] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#B0893E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    {t.paymentMethod}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D8CEC0] rounded-xl px-3 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#B0893E]"
                  >
                    <option value="Telebirr">Telebirr</option>
                    <option value="CBE Mobile">CBE Mobile</option>
                    <option value="Chapa / Card">Chapa / Visa</option>
                    <option value="Cash at Desk">Cash at Desk</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#E7E0D5] flex justify-between items-center">
                <span className="text-xs font-semibold text-stone-600">
                  {t.totalPrice}:
                </span>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-[#1C1917] block">
                    {(selectedRoom.priceETB * nights).toLocaleString()} ETB
                  </span>
                  <span className="text-[11px] text-stone-500">
                    (${(selectedRoom.priceUSD * nights).toLocaleString()} USD)
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoom(null)}
                  className="w-1/3 py-3 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold uppercase transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 rounded-xl bg-[#1C1917] hover:bg-[#B0893E] text-[#E6C785] hover:text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  {t.confirmBooking}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Luxury Footer with Developer Signature */}
      <footer className="bg-[#1C1917] text-stone-400 border-t-2 border-[#C5A059] py-7 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-center md:text-left">
            <span className="font-serif text-sm font-bold text-white tracking-wider">
              DAWIT HOTEL MANAGEMENT SYSTEM
            </span>
            <p className="text-stone-500 mt-0.5">
              © 2026 All Rights Reserved • Enterprise Hospitality Architecture
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 bg-white/5 border border-[#C5A059]/30 px-4 py-2.5 rounded-full text-stone-200">
            <span>
              {t.developedBy}{" "}
              <strong className="text-[#E6C785] font-bold">Dawit Tesfay</strong>
            </span>
            <span className="text-stone-600">|</span>
            <a
              href="tel:+251985076136"
              className="hover:text-[#E6C785] transition"
            >
              📞 +251 985 076 136
            </a>
            <span className="text-stone-600">|</span>
            <a
              href="mailto:dawiittesfay@gmail.com"
              className="hover:text-[#E6C785] transition"
            >
              ✉️ dawiittesfay@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}