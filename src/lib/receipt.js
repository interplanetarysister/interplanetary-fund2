import { jsPDF } from "jspdf";
import { format } from "date-fns";

// Local iFund transaction details only; never invent a PayPal receipt URL or
// imply sandbox transactions are real charitable donations.
export function downloadReceipt(donation) {
  if (donation?.status !== "completed" || donation?.receipt_available !== true) {
    throw new Error("Verified transaction details are not available.");
  }
  const isTest = donation.environment === "sandbox";
  const doc = new jsPDF();
  const title = isTest ? "Interplanetary Fund — SANDBOX TEST RECORD" : "Interplanetary Fund — Donation Details";
  doc.setFontSize(17);
  doc.text(title, 20, 25);
  doc.setDrawColor(14, 165, 233); doc.setLineWidth(0.8); doc.line(20, 30, 190, 30);
  const date = donation.created_date && !Number.isNaN(new Date(donation.created_date).getTime()) ? format(new Date(donation.created_date), "MMMM d, yyyy") : "Unavailable";
  const currency = String(donation.currency || "USD");
  const amount = (value) => currency + " " + Number(value || 0).toFixed(2);
  doc.setFontSize(10);
  const lines = [
    ["Environment", isTest ? "SANDBOX — simulated funds" : "LIVE"],
    ["iFund reference", String(donation.id || "")],
    ["Date", date],
    ["Campaign", donation.campaign_title || donation.campaign_id || "Campaign"],
    ["Gift to campaign", amount(donation.amount)],
    ...(Number(donation.platform_support_amount || 0) > 0 ? [["Separate optional platform support", amount(donation.platform_support_amount)]] : []),
    ...(Number(donation.processing_fee || 0) > 0 ? [["Processor charge", amount(donation.processing_fee)]] : []),
    ...(Number.isFinite(Number(donation.total_charged)) ? [["Total charged", amount(donation.total_charged)]] : []),
    ["Provider payment status", "Completed"],
    ["Payment method", String(donation.payment_method || "PayPal")],
  ];
  let y = 45;
  for (const [label, value] of lines) {
    doc.setFont(undefined, "bold"); doc.text(label + ":", 20, y);
    doc.setFont(undefined, "normal"); doc.text(String(value).slice(0, 67), 84, y);
    y += 10;
  }
  doc.setFontSize(9); doc.setTextColor(115);
  doc.text(isTest
    ? "TEST ONLY. No money moved. Not a donation or tax receipt."
    : "This is an IFund transaction summary, not an official PayPal or tax receipt.", 20, Math.min(275, y + 10));
  doc.save("ifund-" + (isTest ? "sandbox-test" : "donation-details") + "-" + String(donation.id || "record").replace(/[^a-zA-Z0-9_-]/g, "") + ".pdf");
}