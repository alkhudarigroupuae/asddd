"use client";

import { useState, useEffect, useRef } from "react";
import { getTokenLogoUrl } from "@/lib/tokenLogos";
import { getNetworkByChainId } from "@/lib/networks";

interface SuccessAnimationProps {
  contractAddress: string;
  txHash: string;
  explorerTxUrl: string;
  explorerAddressUrl: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  chainId?: number;
  deployCostWei?: string;
  transferCostWei?: string;
  nativeSymbol?: string;
  contractType?: "simple" | "swapAsset" | "usdtz";
  onClose: () => void;
}

function weiToEther(wei: string): string {
  try {
    const w = BigInt(wei);
    const div = 1e18;
    const whole = w / BigInt(div);
    const frac = w % BigInt(div);
    const fracStr = frac.toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "") || "0";
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return "—";
  }
}

export function SuccessAnimation({
  contractAddress,
  txHash,
  explorerTxUrl,
  explorerAddressUrl,
  tokenName,
  tokenSymbol,
  tokenDecimals = 18,
  chainId,
  deployCostWei,
  transferCostWei,
  nativeSymbol = "ETH",
  contractType,
  onClose,
}: SuccessAnimationProps) {
  const deployCost = deployCostWei ? weiToEther(deployCostWei) : null;
  const transferCost = transferCostWei ? weiToEther(transferCostWei) : null;
  const totalWei =
    deployCostWei && transferCostWei
      ? (BigInt(deployCostWei) + BigInt(transferCostWei)).toString()
      : deployCostWei ?? transferCostWei ?? null;
  const totalCost = totalWei ? weiToEther(totalWei) : null;
  const [addToWalletStatus, setAddToWalletStatus] = useState<"idle" | "done" | "error">("idle");
  const [copyLinkStatus, setCopyLinkStatus] = useState<"idle" | "copied" | "error">("idle");
  const [copyContractStatus, setCopyContractStatus] = useState<"idle" | "copied" | "error">("idle");
  const [priceForReceiver, setPriceForReceiver] = useState("");
  const autoAskedRef = useRef(false);
  const linkNetwork = chainId ? getNetworkByChainId(chainId) : undefined;

  const shareLink =
    typeof window !== "undefined"
      ? (() => {
          let url = `${window.location.origin}${window.location.pathname || "/"}?add=${encodeURIComponent(contractAddress)}&symbol=${encodeURIComponent(tokenSymbol)}&decimals=${tokenDecimals}${chainId ? `&chainId=${chainId}` : ""}`;
          if (priceForReceiver.trim() !== "") url += `&price=${encodeURIComponent(priceForReceiver.trim())}`;
          return url;
        })()
      : "";

  const copyShareLink = () => {
    if (!shareLink) {
      setCopyLinkStatus("error");
      return;
    }
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopyLinkStatus("copied");
      setTimeout(() => setCopyLinkStatus("idle"), 2000);
    }).catch(() => setCopyLinkStatus("error"));
  };

  const copyContractAddress = () => {
    navigator.clipboard.writeText(contractAddress).then(() => {
      setCopyContractStatus("copied");
      setTimeout(() => setCopyContractStatus("idle"), 2000);
    }).catch(() => setCopyContractStatus("error"));
  };

  const doAddToWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setAddToWalletStatus("error");
      return;
    }
    const address = String(contractAddress ?? "").trim();
    const symbol = String(tokenSymbol ?? "").trim();
    if (!address || !symbol) {
      setAddToWalletStatus("error");
      return;
    }
    try {
      const logoUrl = getTokenLogoUrl(symbol);
      await (window.ethereum as { request: (args: unknown) => Promise<unknown> }).request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address,
            symbol,
            decimals: Number(tokenDecimals) || 18,
            image: logoUrl ?? undefined,
          },
        },
      });
      setAddToWalletStatus("done");
    } catch {
      setAddToWalletStatus("error");
    }
  };

  useEffect(() => {
    if (autoAskedRef.current) return;
    autoAskedRef.current = true;
    if (typeof window === "undefined" || !window.ethereum) {
      setAddToWalletStatus("error");
      return;
    }
    const address = String(contractAddress ?? "").trim();
    const symbol = String(tokenSymbol ?? "").trim();
    if (!address || !symbol) {
      setAddToWalletStatus("error");
      return;
    }
    (window.ethereum as { request: (args: unknown) => Promise<unknown> })
      .request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address,
            symbol,
            decimals: Number(tokenDecimals) || 18,
            image: getTokenLogoUrl(symbol) ?? undefined,
          },
        },
      })
      .then(() => setAddToWalletStatus("done"))
      .catch(() => setAddToWalletStatus("error"));
  }, [contractAddress, tokenSymbol, tokenDecimals]);

  const handleAddToMetaMask = () => {
    setAddToWalletStatus("idle");
    doAddToWallet();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4">
      <div
        className="animate-success-pop w-full max-w-md rounded-2xl border border-slate-600 bg-slate-800 p-6 shadow-2xl"
        role="alert"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            {getTokenLogoUrl(tokenSymbol) ? (
              <img
                src={getTokenLogoUrl(tokenSymbol)!}
                alt=""
                className="h-14 w-14 rounded-full border-2 border-indigo-500/50 bg-slate-800 object-contain"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-indigo-500 bg-indigo-500/20">
                <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="text-start">
              <h3 className="text-lg font-bold text-slate-100">تم نشر التوكن</h3>
              <p className="mt-0.5 text-sm text-slate-400">
                {tokenName} ({tokenSymbol})
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-slate-600 bg-slate-700/50 px-3 py-2 text-xs text-slate-200">
          إذا استخدمت MetaMask: طلبنا من المحفظة إضافة {tokenSymbol}. أكّد النافذة المنبثقة ليظهر في محفظتك.
        </p>
        <p className="mt-2 rounded-xl border border-slate-600 bg-slate-700/50 px-3 py-2 text-xs text-slate-200">
          <strong>لماذا يظهر سعر $0 في المحفظة؟</strong> المحفظة تأخذ أسعار التوكنات من بورصات (مثل CoinGecko). التوكن اللي أنت نشرته عقد جديد — ما فيه مصدر سعر له، فالمحفظة تعرض $0. لا يمكن «ربط» سعر USDT الرسمي بعقدك من داخل التطبيق. السعر يظهر في المحفظة بعد إدراج التوكن وإضافة سيولة في بورصة (Uniswap، PancakeSwap، إلخ). لو التوكن مستقر (مثل USDT) فقيمته المعتادة قريبة من $1 عند التداول.
        </p>

        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <p className="font-medium text-emerald-100">استخدم Trust Wallet أو لم يظهر التوكن؟</p>
          <p className="mt-1">افتح Trust Wallet → اختر الشبكة الصحيحة (Ethereum أو BSC) → إعدادات المحفظة أو القائمة → إضافة توكن مخصص (Custom Token) → الصق عنوان العقد، الرمز {tokenSymbol}، الخانات العشرية {tokenDecimals}. أو انسخ عنوان العقد بالزر أدناه.</p>
        </div>

        {(deployCost !== null || transferCost !== null || totalCost !== null) && (
          <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
            <p className="font-medium text-indigo-100">تكلفة النشر والتحويل</p>
            {deployCost !== null && <p>نشر العقد: {deployCost} {nativeSymbol}</p>}
            {transferCost !== null && <p>تحويل العرض: {transferCost} {nativeSymbol}</p>}
            {totalCost !== null && (deployCost !== null || transferCost !== null) && <p className="mt-1 font-medium">المجموع: {totalCost} {nativeSymbol}</p>}
          </div>
        )}
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          إذا ظهر في MetaMask تحذير «Unverified Token»: هذا عادي. لإزالته، تحقق من العقد في المستكشف (Verify Contract) ثم أعد تحميل المحفظة.
        </p>
        <div className="mt-4 rounded-xl border-2 border-red-500/40 bg-red-500/15 px-3 py-2 text-xs text-red-100">
          <p className="font-bold">لو ظهر Balance 0 في نافذة MetaMask:</p>
          <p className="mt-1">(1) تأكد أنك على <strong>نفس الشبكة</strong> (Ethereum أو BSC) اللي نشرت عليها. (2) اضغط Add token ثم افتح قائمة الأصول — الرصيد قد يظهر بعد الإضافة. (3) لو في الخطوة 1 اخترت «العقد أدناه» أو «عنوان آخر» كمستلم، كامل العرض ذهب لذلك العنوان وليس محفظتك — لذلك رصيدك 0. انشر من جديد واختر «محفظتي» لاستلام التوكنات عندك.</p>
        </div>

        {contractType === "usdtz" && (
          <p className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
            <strong>للمالك (مستلم التوكن):</strong> لمعرفة عنوان الناشر لتدفع له، افتح العقد في المستكشف واستدعِ الدالة <span className="font-mono">deployer()</span> — العنوان الظاهر هو من أنشأ التوكن وأرسله لك.
          </p>
        )}

        <div className="mt-6 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-400">عنوان العقد (أضفه في MetaMask أو Trust Wallet لرؤية الرصيد)</span>
            <span className="flex items-center gap-2">
              <a href={explorerAddressUrl} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-indigo-400 hover:underline">
                {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
              </a>
              <button
                type="button"
                onClick={copyContractAddress}
                className="rounded-lg border border-slate-500 bg-slate-700/70 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
              >
                {copyContractStatus === "copied" ? "تم النسخ" : "نسخ العنوان"}
              </button>
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">رقم المعاملة (Tx)</span>
            <a href={explorerTxUrl} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-indigo-400 hover:underline">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </div>
          <a
            href={explorerAddressUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-center text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            تحقق من العقد في المستكشف (إزالة تحذير Unverified Token)
          </a>
          <p className="mt-2 text-center text-xs text-slate-500">
            في المحفظة قد تظهر المعاملة: To: 0x0000 و Value: 0 ETH — هذا طبيعي عند نشر العقد، المبلغ المدفوع هو الغاز فقط.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleAddToMetaMask}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {addToWalletStatus === "done" ? "تمت الإضافة للمحفظة" : addToWalletStatus === "error" ? "أضف التوكن للمحفظة (اضغط للمحاولة أو أضفه يدوياً في Trust Wallet)" : "أضف التوكن للمحفظة (MetaMask / Trust إن دعمت)"}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="success-price-receiver" className="text-xs text-slate-400">سعر العرض للمستلم ($):</label>
            <input
              id="success-price-receiver"
              name="priceForReceiver"
              type="text"
              inputMode="decimal"
              placeholder="1"
              value={priceForReceiver}
              onChange={(e) => setPriceForReceiver(e.target.value)}
              className="w-20 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <span className="text-xs text-slate-500">ثم انسخ الرابط — المستلم يرى السعر على الشاشة</span>
          </div>
          <button
            type="button"
            onClick={copyShareLink}
            className="w-full rounded-xl border border-slate-500 bg-slate-700/50 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
          >
            {copyLinkStatus === "copied" ? "تم نسخ الرابط — أرسله للمستلم" : copyLinkStatus === "error" ? "نسخ الرابط (حاول مرة أخرى)" : "نسخ رابط المشاركة (المستلم يضيف التوكن بضغطة واحدة)"}
          </button>
          <div className="flex gap-3">
            <a
              href={explorerTxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl border border-slate-500 bg-slate-700/50 py-2.5 text-center text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              عرض في المستكشف
            </a>
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">
              تم
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
