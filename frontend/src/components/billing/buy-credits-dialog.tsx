"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Coins, X } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { useCredits } from "@/components/billing/credits-provider";

const PACKS = [100, 500, 1000];
const MIN = 10;
const MAX = 10000;

type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  theme: { color: string };
  handler: (res: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load the payment window. Check your connection."));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid: () => Promise<void> | void;
};

/** Buy credits: 1 ₹ = 1 credit, paid through Razorpay Checkout. */
export function BuyCreditsDialog({ open, onOpenChange, onPaid }: Props) {
  const { getToken } = useAuth();
  const { testMode, connectCost, questionCost } = useCredits();
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = Number.isInteger(amount) && amount >= MIN && amount <= MAX;

  const pay = async () => {
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      await loadCheckout();
      const token = await getToken();
      const order = await apiFetch<{ order_id: string; key_id: string; amount: number }>(
        "/api/v1/billing/orders",
        token,
        { method: "POST", body: { amount } }
      );
      const checkout = new window.Razorpay!({
        key: order.key_id,
        amount: order.amount * 100,
        currency: "INR",
        order_id: order.order_id,
        name: "InsightFlow",
        description: `${order.amount} credits`,
        theme: { color: "#e05a8f" },
        modal: { ondismiss: () => setBusy(false) },
        handler: (res) => {
          void (async () => {
            try {
              await apiFetch("/api/v1/billing/verify", await getToken(), {
                method: "POST",
                body: {
                  order_id: res.razorpay_order_id,
                  payment_id: res.razorpay_payment_id,
                  signature: res.razorpay_signature,
                },
              });
              await onPaid();
              onOpenChange(false);
            } catch (err) {
              // The payment went through; the webhook will still add the credits.
              setError(
                err instanceof Error
                  ? `${err.message} If you were charged, your credits will appear shortly.`
                  : "Couldn't confirm the payment. If you were charged, your credits will appear shortly."
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the payment. Try again.");
      setBusy(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, var(--flow-pink) 55%, transparent), transparent 70%)," +
              "color-mix(in oklab, var(--flow-ink) 22%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          <div
            className="relative flex flex-col gap-4 rounded-3xl border border-(--flow-cream) p-6"
            style={{
              boxShadow: "0 50px 90px -30px color-mix(in oklab, var(--flow-magenta) 55%, transparent)",
              backgroundImage:
                "linear-gradient(150deg, var(--flow-peach), var(--flow-pink) 60%, var(--flow-lavender))",
            }}
          >
            <DialogPrimitive.Close
              aria-label="Close"
              disabled={busy}
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-(--flow-cream)/70 text-(--flow-ink) disabled:opacity-50"
            >
              <X weight="bold" className="size-4" />
            </DialogPrimitive.Close>

            <div className="flex items-center gap-2">
              <Coins weight="fill" className="size-6 text-(--flow-cream)" />
              <DialogPrimitive.Title className="font-(family-name:--font-zeyada) text-[34px] leading-none font-normal text-(--flow-ink)">
                Buy credits
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Description className="font-(family-name:--font-zeyada) text-[21px] leading-snug font-normal text-(--flow-ink)/75">
              Connecting an app costs {connectCost} credits and each AI question costs {questionCost}.
            </DialogPrimitive.Description>

            <div className="flex gap-2">
              {PACKS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={`flex-1 rounded-2xl px-3 py-3 font-(family-name:--font-zeyada) text-[26px] leading-none font-normal transition-transform active:scale-[0.97] ${
                    amount === p
                      ? "bg-(--flow-cream) text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)]"
                      : "bg-(--flow-cream)/45 text-(--flow-ink)"
                  }`}
                >
                  ₹{p}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-(--flow-cream)/60 px-4 py-2.5">
              <span className="font-(family-name:--font-zeyada) text-[22px] leading-none text-(--flow-ink)/80">Custom ₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN}
                max={MAX}
                value={Number.isNaN(amount) ? "" : amount}
                onChange={(e) => setAmount(e.target.value === "" ? NaN : Math.floor(Number(e.target.value)))}
                className="w-full bg-transparent text-lg text-(--flow-ink) outline-none"
                aria-label="Custom amount in rupees"
              />
            </label>

            {!valid && (
              <p className="font-(family-name:--font-zeyada) text-[20px] leading-none text-(--flow-coral)">
                Enter an amount between ₹{MIN} and ₹{MAX.toLocaleString("en-IN")}.
              </p>
            )}
            {error && (
              <p role="alert" className="font-(family-name:--font-zeyada) text-[20px] leading-snug text-(--flow-coral)">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void pay()}
              disabled={!valid || busy}
              className="bg-gradient-flow inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Opening payment…" : valid ? `Pay ₹${amount.toLocaleString("en-IN")} for ${amount.toLocaleString("en-IN")} credits` : "Pay"}
            </button>
            {testMode && (
              <p className="text-center text-xs text-(--flow-ink)/55">Test mode: use Razorpay&apos;s test card, no real money moves.</p>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
